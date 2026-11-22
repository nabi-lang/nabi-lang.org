// Browser checks of a built site: every page given loads without a
// script error or a missing file, passes the accessibility checks below
// in light and dark, at desktop and phone width, and the docs search
// finds a phrase that only the body text has. Then the WCAG 2.2 checks
// that need a reader's moves: focus is never under the sticky header
// (2.4.11), the header menus close on Escape and give the focus back to
// their button; and the search palette and the docs search's Packages
// group. Serves public/ itself, and answers for docs.nabi-lang.org (its
// latest/ from --version) and the registry's package list, so nothing
// leaves the machine. It ends with the bytes, gzipped, the first search
// of the docs reads.
//
// usage: node tests/browser.ts [--shots <dir>] [--version dev] [--out public] [page..]
//   page: `www:<path>`, `docs:<path>` (in the version, e.g.
//   `docs:learn/rosetta/`) or `pkg:<path>` (under /packages/); without
//   any, a representative set.
// Needs Chrome (CHROME_PATH, or the usual install paths).
import puppeteer, { type Browser, type HTTPRequest, type Page } from "puppeteer-core";
import { gzipSync } from "node:zlib";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import type { AddressInfo } from "node:net";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const k = args.indexOf(name);
  if (k < 0) return undefined;
  const v = args[k + 1];
  args.splice(k, 2);
  return v;
};
const shots = opt("--shots");
const version = opt("--version") ?? "dev";
const out = opt("--out") ?? "public";

const DEFAULT = [
  "www:", "www:download", "www:roadmap", "www:faq", "www:news/", "www:news/nabi-0.1.0", "www:ko/", "www:ko/download", "www:ko/roadmap", "www:ko/faq", "www:ko/news/nabi-0.1.0",
  "www:community", "www:governance", "www:brand", "www:releases/", "www:releases/0.1.1", "www:ko/community", "www:ko/brand", "www:ko/releases/",
  "docs:", "docs:learn/", "docs:learn/05-sum-types", "docs:learn/22-science", "docs:ko/learn/22-science",
  "docs:learn/rosetta/", "docs:learn/rosetta/strings", "docs:ko/learn/rosetta/numbers",
  "docs:std/core/collections/list", "docs:errors/", "pkg:", "pkg:json/latest", "pkg:table/latest/column",
];
const pages = args.length ? args : DEFAULT;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain", ".xml": "application/xml", ".ico": "image/x-icon",
};

// The file under `root` a canonical address names, as `serve` resolves
// it: <path>, <path>.html, <path>/index.html.
function file(root: string, path: string): string | null {
  const base = normalize(join(root, path));
  if (!base.startsWith(normalize(root))) return null;
  for (const f of [base, base + ".html", join(base, "index.html")]) if (existsSync(f) && statSync(f).isFile()) return f;
  return null;
}

function serve(root: string): Promise<Server> {
  const s = createServer((req, res) => {
    const f = file(root, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
    if (f) {
      res.writeHead(200, { "Content-Type": TYPES[extname(f)] ?? "application/octet-stream" });
      res.end(readFileSync(f));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/html" }).end("not found");
  });
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok(s)));
}

// What the pages ask of the other hosts: docs.nabi-lang.org from out/docs
// (latest/ is --version), and the registry's package list made from the
// package docs' list. Anything else off the machine is refused.
const DOCS_HOST = "https://docs.nabi-lang.org";
const REGISTRY = "https://packages.nabi-lang.org";
function registryList(): string {
  const f = join(out, "docs", "packages", "search-index.json");
  const p = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { p: [string, string, string?][] }).p : [];
  return JSON.stringify(p.map(([name, , description]) => ({ name, description: description ?? "", official: true, versions: [] })));
}
async function answer(req: HTTPRequest): Promise<void> {
  const u = new URL(req.url());
  const cors = { "Access-Control-Allow-Origin": "*" };
  if (u.origin === DOCS_HOST) {
    const f = file(join(out, "docs"), decodeURIComponent(u.pathname).replace(/^\/latest(\/|$)/, `/${version}$1`));
    if (f) return req.respond({ status: 200, contentType: TYPES[extname(f)] ?? "application/octet-stream", headers: cors, body: readFileSync(f) });
    return req.respond({ status: 404, headers: cors, body: "not found" });
  }
  if (u.origin === REGISTRY && u.pathname === "/api/v1/docs") return req.respond({ status: 200, contentType: "application/json", headers: cors, body: registryList() });
  if (u.hostname === "127.0.0.1" || u.protocol === "data:") return req.continue();
  return req.abort("blockedbyclient");
}

function chrome(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const g of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (existsSync(g)) return g;
  }
  throw new Error("no Chrome found; set CHROME_PATH");
}

// Runs in the page: the problems found, as text.
function audit(phone: boolean): string[] {
  const bad: string[] = [];
  const where = (el: Element): string => {
    const id = el.id ? "#" + el.id : "";
    const cls = el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : "";
    return `<${el.tagName.toLowerCase()}${id}${cls}>`;
  };
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[hidden],[aria-hidden=true]");
  };
  const name = (el: Element): string => {
    const lb = el.getAttribute("aria-labelledby");
    if (lb) return lb.split(" ").map((i) => document.getElementById(i)?.textContent ?? "").join(" ").trim();
    return (el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText || el.textContent || "").trim()
      || [...el.querySelectorAll("img[alt], svg[aria-label]")].map((i) => i.getAttribute("alt") ?? i.getAttribute("aria-label") ?? "").join("").trim();
  };
  if (!document.documentElement.lang) bad.push("<html> has no lang");
  if (!document.title.trim()) bad.push("no <title>");
  const h1 = document.querySelectorAll("h1");
  if (h1.length !== 1) bad.push(`${h1.length} <h1> elements`);
  let last = 0;
  for (const h of document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")) {
    const n = Number(h.tagName[1]);
    if (last && n > last + 1) bad.push(`heading jumps from h${last} to h${n}: ${where(h)} "${(h.textContent ?? "").trim().slice(0, 40)}"`);
    last = n;
  }
  const ids = new Map<string, number>();
  for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) bad.push(`id "${id}" used ${n} times`);
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) bad.push(`image without alt: ${img.src.slice(-40)}`);
  for (const svg of document.querySelectorAll("svg[role=img]")) if (!svg.getAttribute("aria-label") && !svg.querySelector("title")) bad.push(`svg role=img without a name: ${where(svg)}`);
  for (const el of document.querySelectorAll("a[href], button, [role=button], [role=option], summary")) {
    if (!shown(el)) continue;
    if (!name(el)) bad.push(`no accessible name: ${where(el)} ${el.outerHTML.slice(0, 120)}`);
  }
  for (const el of document.querySelectorAll("[role=img]")) {
    if (el.querySelector("a, button, input, select, textarea, [tabindex]")) bad.push(`interactive element inside role=img: ${where(el)}`);
  }
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if ((el as HTMLInputElement).type === "hidden") continue;
    const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
    if (!labelled) bad.push(`form field without a label: ${where(el)}`);
  }
  // Text contrast: WCAG AA, 4.5:1, or 3:1 for large text.
  const rgb = (c: string): number[] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1];
  };
  const lum = (c: number[]): number => {
    const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
  };
  const bg = (el: Element | null): number[] | null => {
    let base: number[] | null = null;
    const layers: number[][] = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none") return null;
      const c = rgb(cs.backgroundColor);
      if (c && c[3]! > 0) { layers.push(c); if (c[3]! >= 1) { base = c; break; } }
    }
    if (!base) base = [255, 255, 255, 1];
    let acc = base;
    for (const l of layers.reverse().slice(1)) acc = [0, 1, 2].map((k) => l[k]! * l[3]! + acc[k]! * (1 - l[3]!)).concat(1);
    if (layers.length === 1) acc = layers[0]!;
    return acc;
  };
  const seen = new Set<Element>();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let low = 0;
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const el = t.parentElement;
    if (!el || seen.has(el) || !(t.textContent ?? "").trim() || !shown(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (Number(cs.opacity) < 1) continue;
    const fg = rgb(cs.color);
    const b = bg(el);
    if (!fg || !b) continue;
    const mix = [0, 1, 2].map((k) => fg[k]! * fg[3]! + b[k]! * (1 - fg[3]!));
    const [l1, l2] = [lum(mix), lum(b)].sort((x, y) => y - x);
    const ratio = (l1! + 0.05) / (l2! + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) {
      if (low++ < 5) bad.push(`contrast ${ratio.toFixed(2)}:1 for ${where(el)} "${(t.textContent ?? "").trim().slice(0, 30)}"`);
    }
  }
  if (low > 5) bad.push(`... and ${low - 5} more low-contrast texts`);
  // Target size (WCAG 2.5.8, 24 x 24 px) of controls that are not links
  // inside running text, at either width.
  {
    let small = 0;
    for (const el of document.querySelectorAll("a[href], button, summary, input:not([type=hidden])")) {
      if (!shown(el) || getComputedStyle(el).display === "inline" || el.closest("p, li, td, th, dd, figcaption") && getComputedStyle(el).display.startsWith("inline")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) { if (small++ < 5) bad.push(`target ${r.width.toFixed(0)}x${r.height.toFixed(0)} px: ${where(el)} "${name(el).slice(0, 30)}"`); }
    }
    if (small > 5) bad.push(`... and ${small - 5} more small targets`);
  }
  if (phone && document.scrollingElement!.scrollWidth > innerWidth + 1) bad.push(`page scrolls sideways: ${document.scrollingElement!.scrollWidth}px wide at ${innerWidth}px`);
  return bad;
}

async function open(browser: Browser, url: string, dark: boolean, phone: boolean, errors: string[]): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluateOnNewDocument((t: string) => { try { localStorage.setItem("theme", t); } catch {} }, dark ? "dark" : "light");
  page.on("pageerror", (e) => errors.push(`script error: ${e instanceof Error ? e.message : String(e)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400 && /^http:\/\/127\.0\.0\.1|^https:\/\/docs\.nabi-lang\.org/.test(r.url())) errors.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });
  await page.setRequestInterception(true);
  page.on("request", (r) => { answer(r).catch(() => {}); });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(async () => { await document.fonts.ready; });
  return page;
}

const slug = (p: string): string => p.replace(/[:/]+/g, "-").replace(/-$/, "") || "home";

// One check: ok, or each problem found.
function report(tag: string, errors: string[]): number {
  if (errors.length) { console.log(`FAIL ${tag}\n  ${errors.join("\n  ")}`); return 1; }
  console.log(`ok   ${tag}`);
  return 0;
}

// The checks that need a reader's moves, at desktop width and in light.
async function interactions(browser: Browser, www: string, docs: string): Promise<number> {
  let failed = 0;
  const v = `${docs}/${version}`;
  // 2.4.11: scrolled to the end, focus on the first link of the page's
  // text, which the browser scrolls back into view: not under the header.
  for (const url of [`${v}/learn/05-sum-types`, `${www}/faq`]) {
    const errors: string[] = [];
    const page = await open(browser, url, false, false, errors);
    const r = await page.evaluate(() => {
      scrollTo(0, document.scrollingElement!.scrollHeight);
      const a = document.querySelector<HTMLElement>("main article a[href]:not(.anchor)");
      if (!a) return null;
      a.focus();
      const hdr = document.querySelector(".hdr")!.getBoundingClientRect();
      return { top: a.getBoundingClientRect().top, under: hdr.bottom };
    });
    if (!r) errors.push("no link in the article");
    else if (r.top < r.under) errors.push(`focused link at ${r.top.toFixed(0)}px, under the header (to ${r.under.toFixed(0)}px)`);
    failed += report(`focus not obscured ${url.replace(/^http:\/\/[^/]+/, "")}`, errors);
    await page.close();
  }
  // The header menus: open, Escape, closed with the focus on the summary.
  for (const [url, sel] of [[`${v}/learn/`, "details.vers"], [`${v}/learn/`, "details.lang-menu"], [`${www}/download`, "details.lang-menu"]] as const) {
    const errors: string[] = [];
    const page = await open(browser, url, false, false, errors);
    await page.click(`${sel} > summary`);
    const opened = await page.$eval(sel, (d) => (d as HTMLDetailsElement).open);
    if (!opened) errors.push("did not open");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    const after = await page.$eval(sel, (d) => ({ open: (d as HTMLDetailsElement).open, back: document.activeElement === d.querySelector("summary") }));
    if (after.open) errors.push("still open after Escape");
    if (!after.back) errors.push("focus not back on its summary");
    failed += report(`menu ${sel} closes on Escape ${url.replace(/^http:\/\/[^/]+/, "")}`, errors);
    await page.close();
  }
  // The search palette: Ctrl+K, groups for a name, Escape back.
  for (const [url, q, want] of [[`${www}/`, "list", ["Std"]], [`${www}/ko/`, "json", ["패키지"]], [`${v}/learn/`, "json", ["Packages"]], [`${v}/learn/`, "sum types", ["Docs"]], [`${v}/learn/`, "sudoku", ["Examples"]]] as const) {
    const errors: string[] = [];
    const page = await open(browser, url, false, false, errors);
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    const opened = await page.waitForFunction(() => document.activeElement?.id === "pal-q", { timeout: 4000 }).then(() => true, () => false);
    if (!opened) errors.push("Ctrl+K did not open the palette");
    else {
      await page.keyboard.type(q, { delay: 20 });
      await page.waitForFunction((w: readonly string[]) => w.every((g) => [...document.querySelectorAll(".pal-g")].some((e) => e.textContent === g)), { timeout: 8000 }, want)
        .catch(() => errors.push(`"${q}": no ${want.join(", ")} group (got ${"..."})`));
      const groups = await page.$$eval(".pal-g", (es) => es.map((e) => e.textContent));
      if (errors.length) errors.push(`groups: ${groups.join(", ")}`);
      const sel = await page.$eval("#pal-q", (i) => i.getAttribute("aria-activedescendant"));
      if (!sel) errors.push("no option active");
      errors.push(...(await page.evaluate(audit, false)).filter((e) => !/<h1>/.test(e)));
      await page.keyboard.press("Escape");
      const shut = await page.evaluate(() => !document.querySelector<HTMLDialogElement>("dialog.pal")!.open);
      if (!shut) errors.push("Escape did not close it");
    }
    failed += report(`palette "${q}" ${url.replace(/^http:\/\/[^/]+/, "")}`, errors);
    if (shots) await page.screenshot({ path: `${shots}/palette-${slug(url.replace(/^http:\/\/[^/]+\//, "") + q)}.png` });
    await page.close();
  }
  // The docs search: a Packages group under the hits.
  {
    const errors: string[] = [];
    const page = await open(browser, `${v}/learn/`, false, false, errors);
    await page.focus("#q");
    await page.keyboard.type("parse", { delay: 20 });
    await page.waitForFunction(() => document.querySelectorAll("#results .grp-pkgs a[role=option]").length > 0, { timeout: 8000 }).catch(() => errors.push("no Packages group"));
    const hrefs = await page.$$eval("#results .grp-pkgs a", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    if (hrefs.length && !hrefs.every((h) => h.startsWith("/packages/") || h.startsWith(REGISTRY))) errors.push(`package hits go elsewhere: ${hrefs.join(", ")}`);
    failed += report("docs search Packages group", errors);
    await page.close();
  }
  // What the first search reads, gzipped: a fresh page, one query.
  for (const [lang, q] of [["", "towers hanoi"], ["ko/", "하노이"]] as const) {
    const page = await open(browser, `${v}/${lang}learn/`, false, false, []);
    const got: string[] = [];
    page.on("requestfinished", (r) => { if (/search-|search-api|api\/v1\/docs/.test(r.url())) got.push(r.url()); });
    await page.focus("#q");
    await page.keyboard.type(q, { delay: 20 });
    await page.waitForNetworkIdle({ idleTime: 500 });
    let total = 0;
    const parts: string[] = [];
    for (const u of got) {
      const path = new URL(u).pathname;
      const f = file(join(out, "docs"), path);
      const n = f ? gzipSync(readFileSync(f), { level: 9 }).length : 0;
      total += n;
      parts.push(`${path.replace(`/${version}/`, "")} ${(n / 1024).toFixed(1)}`);
    }
    console.log(`info first search ${lang}"${q}": ${(total / 1024).toFixed(1)} KiB gzipped (${parts.join(", ")})`);
    await page.close();
  }
  return failed;
}

async function main(): Promise<void> {
  const www = await serve(join(out, "www"));
  const docs = await serve(join(out, "docs"));
  const at = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  if (shots) mkdirSync(shots, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"] });
  let failed = 0;
  try {
    for (const p of pages) {
      const [site, path] = p.startsWith("www:") ? [at(www), p.slice(4)] : p.startsWith("pkg:") ? [at(docs) + "/packages", p.slice(4)] : [at(docs) + "/" + version, p.replace(/^docs:/, "")];
      const url = `${site}/${path}`;
      for (const dark of [false, true]) {
        for (const phone of [false, true]) {
          const errors: string[] = [];
          const page = await open(browser, url, dark, phone, errors);
          const found = await page.evaluate(audit, phone);
          const all = [...errors, ...found];
          const tag = `${p} ${dark ? "dark" : "light"} ${phone ? "phone" : "desktop"}`;
          if (all.length) { failed++; console.log(`FAIL ${tag}\n  ${all.join("\n  ")}`); } else console.log(`ok   ${tag}`);
          if (shots) await page.screenshot({ path: `${shots}/${slug(p)}-${dark ? "dark" : "light"}-${phone ? "phone" : "desktop"}.png`, fullPage: true });
          await page.close();
        }
      }
    }
    // Search: a phrase only body text has.
    for (const [lang, q, want] of [["", "towers hanoi", "rosetta/algorithms"], ["", "quaternions symplectic", "learn/22-science"], ["ko/", "하노이", "rosetta/algorithms"]] as const) {
      for (const dark of [false, true]) {
        for (const phone of [false, true]) {
          const errors: string[] = [];
          const page = await open(browser, `${at(docs)}/${version}/${lang}learn/`, dark, phone, errors);
          if (phone) await page.click(".search");
          await page.focus("#q");
          await page.keyboard.type(q, { delay: 20 });
          await page.waitForFunction(() => !document.getElementById("results")!.hidden && document.querySelectorAll("#results a[role=option]").length > 0, { timeout: 8000 }).catch(() => errors.push(`search "${q}": no results`));
          const hrefs = await page.$$eval("#results a[role=option]", (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
          if (!hrefs.some((h) => h.includes(want))) errors.push(`search "${q}": no hit in ${want} (got ${hrefs.slice(0, 5).join(", ")})`);
          const tag = `search ${lang}"${q}" ${dark ? "dark" : "light"} ${phone ? "phone" : "desktop"}`;
          if (errors.length) { failed++; console.log(`FAIL ${tag}\n  ${errors.join("\n  ")}`); } else console.log(`ok   ${tag}`);
          if (shots) await page.screenshot({ path: `${shots}/search-${slug(lang + q)}-${dark ? "dark" : "light"}-${phone ? "phone" : "desktop"}.png` });
          await page.close();
        }
      }
    }
    failed += await interactions(browser, at(www), at(docs));
  } finally {
    await browser.close();
    www.close();
    docs.close();
  }
  console.log(failed ? `${failed} failing` : "all passed");
  process.exitCode = failed ? 1 : 0;
}

await main();
