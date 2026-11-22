// Client-side search over search-index.json: {p: [[title, url]], h:
// [[page, heading, id, named?]]}, read into [{t: title, u: url, p: page}],
// and over the words of the pages' text in search-text.json, which points
// at the same entries by number.
// Page urls are canonical addresses within the version (`learn`,
// `learn/05-sum-types`); data-root is the version's root (`/latest/`).
// The UI it adds is Preact components (ui/); the rest wires the
// server-rendered markup.
import { render } from "preact";
import { ApiFilter } from "./ui/api-filter.tsx";
import { CopyButton, RunLink } from "./ui/code-bar.tsx";
import { KbdHelp } from "./ui/kbd-help.tsx";
import { mount, type Mounted } from "./ui/mount.ts";
import { HereNote, LatestVersion, LostHint, MissingNote, Scrim, Toast } from "./ui/notes.tsx";
import { Results, type Hit as Shown, type ResultsProps, type Row } from "./ui/results.tsx";

(() => {
  /** search-index.json as written by the build. */
  interface SearchIndex {
    /** [title, url, excerpt?] */
    p: [t: string, u: string, x?: string][];
    /** [page, heading, id, named?, kind?, excerpt?] */
    h: [n: number, t: string, id: string, named?: unknown, kind?: string, x?: string][];
  }
  /** search-text.json: entry count, [word, entry numbers as base-36 gaps]. */
  interface TextIndex { n: number; w: [w: string, ids: string][] }
  /** A hit: title, url, page title (headings only), API kind, excerpt. */
  interface Entry { t: string; u: string; p: string; k: string; x: string }
  /** versions.json, the part read here. */
  interface Versions { latest: string; patches?: Record<string, string> }
  /** rank, kind order, main type first, title length, entry */
  type Hit = [number, number, number, number, Entry];
  interface Strings {
    run: string; runLabel: string; copy: string; copyLabel: string; copied: string;
    collapse: string; none: string; inLatest: string; down: string;
    copiedLink: string; linkInBar: string; press: (k: string) => string;
    version: string; found: (n: number, all: number) => string;
    legend: Row[]; missing: (v: string) => string;
    help: string; rows: { search: string; pager: string; filter: string; help: string; esc: string };
    filter: string; shown: (n: number) => string; here: string;
  }
  // Elements that carry their running animation.
  interface Sliding extends HTMLElement { slid?: Animation | null }
  interface Growing extends HTMLElement { grew?: Animation | null }
  // The help card while open, and what had focus before it.
  interface HelpBox { box: Mounted<HTMLDivElement>; draw: (hidden: boolean) => void; back: (Element & { focus?: (o?: FocusOptions) => void }) | null }
  // navigator.userAgentData is not in every browser (nor in lib.dom).
  type UA = Navigator & { userAgentData?: { platform?: string; getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> } };

  const root = document.body.dataset.root || "/";
  const q = document.getElementById("q") as HTMLInputElement | null;
  const box = document.getElementById("results");
  let index: Entry[] | null = null;
  let sel = -1;
  // Interface strings; Korean pages get Korean ones.
  const ko = document.documentElement.lang === "ko";
  // The index, fetched once. Declared before anything that may need it
  // at once (the 404 hint below).
  const load = (): Promise<Entry[]> =>
    index ? Promise.resolve(index)
      : fetch(root + (ko ? "ko/" : "") + "search-index.json").then((r) => {
        if (!r.ok) throw new Error(`search-index.json: ${r.status}`);
        return r.json() as Promise<SearchIndex>;
      }).then((d) => {
        const idx: Entry[] = d.p.map(([t, u, x]) => ({ t, u, p: "", k: "", x: x || "" }));
        index = idx;
        for (const [n, t, id, named, kind, x] of d.h) {
          const [pt, pu] = d.p[n]!;
          idx.push({ t: named ? `${pt} › ${t}` : t, u: `${pu}#${id}`, p: pt, k: kind || "", x: x || "" });
        }
        return idx;
      });

  // The body text's words, sorted, and each one's entries; fetched on the
  // first query long enough to look into the text.
  let words: string[] | null = null;
  let posts: string[] = [];
  const loadText = (): Promise<void> =>
    words ? Promise.resolve()
      : fetch(root + (ko ? "ko/" : "") + "search-text.json").then((r) => {
        if (!r.ok) throw new Error(`search-text.json: ${r.status}`);
        return r.json() as Promise<TextIndex>;
      }).then((d) => {
        words = d.w.map(([w]) => w);
        posts = d.w.map(([, ids]) => ids);
      });
  // The words search.nabi leaves out of the text index (stop_words).
  const STOP = new Set(["the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that", "from", "into", "its", "has", "have", "was", "were", "can", "will", "than", "then", "them", "they", "their", "there", "these", "those", "which", "what", "when", "also", "only", "each", "any", "all", "one", "two", "more", "same", "other", "does", "doesn", "isn", "here", "such", "some", "most", "out", "how", "who", "why", "amp", "quot", "nbsp", "이", "그", "수", "것", "등", "및", "더"]);
  const ids = (k: number): number[] => {
    let at = 0;
    return posts[k]!.split(",").map((g) => (at += parseInt(g, 36)));
  };
  // The first word not below `w`.
  const lower = (ws: string[], w: string): number => {
    let lo = 0, hi = ws.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ws[m]! < w) lo = m + 1; else hi = m; }
    return lo;
  };
  // One edit apart (a letter left out, added, changed or two swapped).
  const near1 = (a: string, b: string): boolean => {
    if (Math.abs(a.length - b.length) > 1 || a === b) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  };
  // Entries whose text has a word starting with one of `alts`; a term
  // of five letters or more with no such word takes the words one edit
  // away. Null when the term matches nothing.
  const textHits = (alts: string[]): Set<number> | null => {
    const ws = words!;
    const got = new Set<number>();
    let seen = 0;
    for (const w of alts) {
      for (let k = lower(ws, w); k < ws.length && ws[k]!.startsWith(w) && seen < 200; k++, seen++) for (const id of ids(k)) got.add(id);
    }
    if (!got.size && alts[0]!.length >= 5) {
      const w = alts[0]!;
      ws.forEach((x, k) => { if (near1(w, x)) for (const id of ids(k)) got.add(id); });
    }
    return got.size ? got : null;
  };

  const T: Strings = ko
    ? { run: "실행", runLabel: "플레이그라운드에서 실행", copy: "복사", copyLabel: "코드 복사", copied: "복사됨", collapse: "접기", none: "결과 없음", inLatest: "최신 문서에서 찾기 →", down: "검색할 수 없습니다. 잠시 후 다시 시도하세요.", copiedLink: "링크 복사됨", linkInBar: "주소창에 링크가 있습니다", press: (k) => `${k}를 누르세요`, version: "문서 버전", found: (n, all) => (all > n ? `결과 ${all}개 중 ${n}개 표시` : `결과 ${n}개`),
        legend: [["↑ ↓", "이동"], ["↵", "열기"], ["esc", "닫기"]], missing: (v) => `${v}에는 그 페이지가 없어서 가장 가까운 페이지를 열었습니다.`,
        help: "키보드 단축키", rows: { search: "문서 검색", pager: "이전 / 다음 페이지", filter: "메서드 거르기", help: "이 도움말", esc: "닫기 / 검색 지우기" },
        filter: "메서드 거르기", shown: (n) => `메서드 ${n}개`, here: "(지금 쓰는 시스템)" }
    : { run: "Run", runLabel: "Run in the playground", copy: "Copy", copyLabel: "Copy code", copied: "Copied", collapse: "Collapse", none: "No results", inLatest: "Search the latest docs →", down: "Search is unavailable right now.", copiedLink: "Link copied", linkInBar: "link in the address bar", press: (k) => `Press ${k}`, version: "Docs version", found: (n, all) => (all > n ? `${n} of ${all} results shown` : n === 1 ? "1 result" : `${n} results`),
        legend: [["↑ ↓", "to move"], ["↵", "to open"], ["esc", "to close"]], missing: (v) => `That page is not in ${v}, so this is the closest one.`,
        help: "Keyboard shortcuts", rows: { search: "Search the docs", pager: "Previous / next page", filter: "Filter methods", help: "This help", esc: "Close / clear search" },
        filter: "Filter methods", shown: (n) => (n === 1 ? "1 method" : `${n} methods`), here: "(your system)" };

  // Motion (nabi.css tokens): only after a click or a key, never on load,
  // and none with reduced motion.
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const moves = (el: Element): boolean => !still.matches && !!el.animate;
  const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = (name: string): number => parseFloat(token(name)) || 0;
  const resize = (el: HTMLElement, change: () => void): void => (window.nabiResize ? window.nabiResize(el, change) : change());
  // Run change(), then slide el's height from what it was to what it is,
  // clipped on the way (and past a max-height that change() set).
  const slide = (el: Sliding, change: () => void): void => {
    const h0 = el.offsetHeight;
    if (el.slid) el.slid.cancel();
    change();
    const h1 = el.offsetHeight;
    el.style.overflow = "";
    if (h0 === h1 || !moves(el)) return;
    el.style.overflow = "hidden";
    el.slid = el.animate([{ height: h0 + "px", maxHeight: "none" }, { height: h1 + "px", maxHeight: "none" }], { duration: ms(h1 > h0 ? "--dur" : "--dur-out"), easing: token("--ease") });
    el.slid.onfinish = () => { el.style.overflow = ""; el.slid = null; };
  };

  // On wide screens the sidebar scrolls to the current page (the API
  // list is long).
  const aside = document.querySelector<HTMLElement>(".side");
  const hereItem = aside && aside.querySelector<HTMLElement>("[aria-current=page]");
  const centre = (): void => {
    // hereItem is only set when aside is
    if (hereItem && aside && aside.scrollHeight > aside.clientHeight) {
      aside.scrollTop = hereItem.offsetTop - aside.clientHeight / 2;
    }
  };
  centre();

  // A modal panel keeps Tab among `els()`, with the rest of the page inert
  // and not scrolling.
  let heldAt = 0;
  const hold = (on: boolean): void => {
    if (on) heldAt = scrollY;
    document.documentElement.classList.toggle("lock", on);
    for (const el of document.querySelectorAll<HTMLElement>("body > :is(.skip, .ver-banner, main, .foot), .shell > main")) el.inert = on;
    if (!on) scrollTo(scrollX, heldAt);
  };
  // Focus moves by hand: the header's sticky panel would otherwise
  // scroll the locked page to each link.
  const trap = (ev: KeyboardEvent, els: HTMLElement[]): void => {
    if (ev.key !== "Tab" || !els.length) return;
    ev.preventDefault();
    const i = (els as (Element | null)[]).indexOf(document.activeElement);
    const n = els.length;
    const next = i < 0 ? (ev.shiftKey ? n - 1 : 0) : (i + (ev.shiftKey ? n - 1 : 1)) % n;
    els[next]!.focus({ preventScroll: true });
  };
  const narrow = matchMedia("(max-width: 900px)");

  // Narrow screens: the sidebar is a drawer, opened from the header.
  const sideBtn = document.querySelector<HTMLElement>(".side-toggle");
  if (aside && sideBtn) {
    const shade = (hidden: boolean) => <Scrim hidden={hidden} onClick={() => setSide(false, true)} />;
    const scrim = mount<HTMLDivElement>(shade(true), (el) => document.body.append(el));
    const header = document.querySelector<HTMLElement>(".hdr");
    const isOpen = (): boolean => document.body.classList.contains("side-open");
    const setSide = (open: boolean, back?: boolean): void => {
      if (open === isOpen()) return;
      document.body.classList.toggle("side-open", open);
      sideBtn.setAttribute("aria-expanded", open ? "true" : "false");
      scrim.draw(shade(!open));
      hold(open);
      if (header) header.inert = open;
      if (open) {
        centre();
        (hereItem || aside.querySelector<HTMLElement>("a, button")!).focus({ preventScroll: true });
      } else if (back) {
        sideBtn.focus({ preventScroll: true });
      }
    };
    sideBtn.addEventListener("click", () => setSide(true));
    aside.querySelector(".side-close")?.addEventListener("click", () => setSide(false, true));
    aside.addEventListener("click", (e) => { if ((e.target as Element).closest("a")) setSide(false); });
    aside.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") setSide(false, true);
      else trap(e, [...aside.querySelectorAll<HTMLElement>("a[href], button, summary")].filter((el) => el.checkVisibility()));
    });
    narrow.addEventListener("change", () => setSide(false));
  }

  // "On this page" under the title folds again once a section is chosen.
  const tocM = document.querySelector<HTMLDetailsElement>(".toc-m");
  // It shuts at once there: sliding, it would move the section away
  // from where the link scrolls.
  if (tocM) {
    tocM.addEventListener("click", (e) => {
      if (!(e.target as Element).closest("a")) return;
      tocM.classList.remove("grow");
      tocM.open = false;
      requestAnimationFrame(() => tocM.classList.add("grow"));
    });
  }

  // Buttons with data-copy are copy.js's.

  // Compact header: the hamburger opens the nav as a drop panel. It
  // closes on a link, an outside click, Escape, or a return to the full nav.
  const top = document.querySelector<HTMLElement>(".top");
  const navToggle = document.querySelector<HTMLElement>(".nav-toggle");
  const nav = document.getElementById("nav");
  if (top && navToggle && nav) {
    // nav-shut lets the panel fade out on a close; folding the nav on
    // load or resize must not.
    let shut = 0;
    const setNav = (open: boolean): void => {
      if (open === top.classList.contains("nav-open")) return;
      clearTimeout(shut);
      top.classList.toggle("nav-shut", !open && top.classList.contains("nav-compact"));
      if (!open) shut = window.setTimeout(() => top.classList.remove("nav-shut"), ms("--dur-out"));
      top.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      hold(open);
    };
    navToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setNav(!top.classList.contains("nav-open"));
    });
    nav.addEventListener("click", (e) => { if ((e.target as Element).closest("a")) setNav(false); });
    document.addEventListener("click", (e) => {
      if (top.classList.contains("nav-open") && !(e.target as Element).closest(".nav-toggle, #nav")) setNav(false);
    });
    document.addEventListener("keydown", (e) => {
      if (!top.classList.contains("nav-open")) return;
      if (e.key === "Escape") { setNav(false); navToggle.focus({ preventScroll: true }); }
      else trap(e, [navToggle, ...nav.querySelectorAll("a")]);
    });
    // Collapse exactly when the full nav would not fit on one row: measure
    // the natural width with the row forced not to wrap or shrink. Works
    // for any number of links, so there is no per-page width breakpoint.
    const fitNav = (): void => {
      top.classList.remove("nav-compact");
      top.classList.add("nav-measuring");
      const row = top.querySelector(".in") || top;
      const overflow = row.scrollWidth > row.clientWidth + 1;
      top.classList.remove("nav-measuring");
      if (overflow) top.classList.add("nav-compact");
      else setNav(false);
      // the search icon is a button only while the field is folded
      const so = top.querySelector<HTMLElement>(".s-open");
      if (so) { so.tabIndex = overflow ? 0 : -1; so.toggleAttribute("aria-hidden", !overflow); }
    };
    fitNav();
    addEventListener("resize", fitNav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
  }

  // Spec language switch: carry the current section over to the other
  // edition (data-sec pairs this page's heading ids with the other's).
  const sw = document.querySelector<HTMLElement>(".lang-menu[data-sec]");
  const other = sw && sw.querySelector<HTMLAnchorElement>("a[hreflang]");
  // other is only set when sw is
  if (sw && other) {
    const ids = sw.dataset.sec!.split(" ");
    const map: Record<string, string> = {};
    for (let i = 0; i + 1 < ids.length; i += 2) map[ids[i]!] = ids[i + 1]!;
    other.addEventListener("click", () => {
      let id = decodeURIComponent(location.hash.slice(1));
      if (!map[id]) {
        id = "";
        for (const h of document.querySelectorAll("article [id]")) {
          if (h.getBoundingClientRect().top > 80) break;
          if (map[h.id]) id = h.id;
        }
      }
      other.href = other.href.split("#")[0] + (map[id] ? "#" + map[id] : "");
    });
  }

  // Only the newest release has data-play: the playground runs it.
  // A block runs in the playground when it has `fn main`, or a top-level
  // statement nabi runs as the script body (helpers beside it are fine).
  // A block of only declarations (a lone `enum`, a signature) would just
  // error there, so it gets no try button.
  const runnableNabi = (src: string): boolean => {
    if (/\bfn\s+main\s*\(/.test(src)) return true;
    let depth = 0;
    for (const line of src.split("\n")) {
      const t = line.trim();
      if (depth === 0 && t && !t.startsWith("//") && !t.startsWith("}") &&
          !/^(pub\s+)?(fn|struct|enum|trait|impl|type|const|static|mod|use)\b/.test(t)) {
        return true;
      }
      for (const c of line) { if (c === "{") depth++; else if (c === "}") depth = Math.max(0, depth - 1); }
    }
    return false;
  };

  // Run needs deflate-raw, which Chrome 80-102 lacks though it has
  // CompressionStream.
  const deflate = (() => { try { new CompressionStream("deflate-raw"); return true; } catch { return false; } })();
  const packed = async (src: string): Promise<string> => {
    const s = new Blob([src]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const b = new Uint8Array(await new Response(s).arrayBuffer());
    let bin = "";
    for (const c of b) bin += String.fromCharCode(c);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  // Code blocks come with their bar (layout.nabi); add run and copy.
  for (const wrap of document.querySelectorAll("article .code.cb")) {
    const head = wrap.querySelector(".cb-h");
    const pre = wrap.querySelector<Sliding>(".cb-body > pre");
    if (!head || !pre) continue;
    const lang = (pre.querySelector("code")?.className.match(/language-(\w+)/) || [])[1] || "";
    const play = document.body.dataset.play;
    const copy = async (): Promise<void> => {
      let say = T.copied;
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
      } catch {
        say = T.press(/Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318C" : "Ctrl+C");
      }
      resize(b.el, () => b.draw(button(say, true)));
      setTimeout(() => resize(b.el, () => b.draw(button(T.copy, false))), 1600);
    };
    const button = (text: string, done: boolean) => <CopyButton text={text} label={T.copyLabel} done={done} onClick={copy} />;
    const b = mount<HTMLButtonElement>(button(T.copy, false), (el) => head.append(el));
    // Run is a link with its address ready before the click: Safari
    // blocks a window opened after an await.
    if (play && lang === "nabi" && deflate && runnableNabi(pre.innerText)) {
      packed(pre.innerText).then((code) => {
        // A Korean page opens the playground in Korean.
        mount(<RunLink href={`${play}${ko ? "/ko" : "/"}#code=${code}`} text={T.run} label={T.runLabel} />, (t) => b.el.before(t));
      }, () => {});
    }
    const ex = wrap.querySelector<HTMLElement>(".expand");
    if (ex) {
      const more = ex.textContent;
      ex.addEventListener("click", () => {
        let open = false;
        // the lines shown open below where the reader is: no scroll
        // anchoring on the button while the block grows
        const root = document.documentElement;
        root.style.overflowAnchor = "none";
        setTimeout(() => { root.style.overflowAnchor = ""; }, ms("--dur") + 100);
        // Scrolled before the slide starts, to where the folded block ends up.
        slide(pre, () => {
          open = wrap.classList.toggle("collapsed") === false;
          if (!open) wrap.scrollIntoView({ block: "nearest" });
        });
        resize(ex, () => { ex.textContent = open ? T.collapse : more; });
        ex.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  // The sidebar's section list follows the reader.
  const toc = [...document.querySelectorAll<HTMLAnchorElement>(".toc a[href^='#']")];
  const heads = toc.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter((h): h is HTMLElement => !!h);
  if (heads.length) {
    let queued = false;
    const spy = () => {
      queued = false;
      let cur = 0;
      heads.forEach((h, k) => { if (h.getBoundingClientRect().top < 120) cur = k; });
      toc.forEach((a, k) => (k === cur ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
    };
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }

  if (document.querySelector(".pager")) {
    // [ and ] walk to the previous / next page (the pager).
    addEventListener("keydown", (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target as Element;
      if (t.closest && t.closest("input, textarea, select")) return;
      if (ev.key === "[") { document.querySelector<HTMLElement>(".pager .prev")?.click(); }
      else if (ev.key === "]") { document.querySelector<HTMLElement>(".pager .next")?.click(); }
    });
  }

  // A heading's # copies the link to that section.
  const toast = (text: string): void => {
    const t = mount(<Toast text={text} hidden={false} />, (el) => document.body.append(el));
    setTimeout(() => { t.draw(<Toast text={text} hidden />); setTimeout(t.drop, ms("--dur-out")); }, 1400);
  };
  for (const a of document.querySelectorAll<HTMLAnchorElement>("article .anchor")) {
    a.addEventListener("click", async (ev) => {
      ev.preventDefault();
      history.replaceState(null, "", a.hash);
      try {
        await navigator.clipboard.writeText(location.href);
        toast(T.copiedLink);
      } catch {
        toast(T.linkInBar);
      }
    });
  }

  // 404.html: name the missing path and, on the docs, suggest where it
  // may be: the same path in latest/ (from an older version or dev),
  // else the page of its section that it nearly names
  // (`learn/5` -> `learn/05-sum-types`).
  const lost = document.getElementById("lost-path");
  if (lost) lost.textContent = location.pathname;
  const hint = document.querySelector<HTMLElement>(".lost-hint");
  if (lost && hint && document.body.dataset.version) {
    const segs = location.pathname.split("/").filter(Boolean);
    const ver = segs[0] || "";
    const rest = segs.slice(1).join("/");
    const say = (href: string, label: string): void => {
      render(<LostHint lead={ko ? "혹시 이 페이지인가요? " : "Did you mean "} href={href} label={label} tail={ko ? "" : "?"} />, hint);
      hint.hidden = false;
    };
    const near = (): Promise<void> => load().then((idx) => {
      const lang = rest.startsWith("ko/") ? "ko/" : "";
      const path = rest.slice(lang.length);
      const k = path.lastIndexOf("/");
      const dir = k < 0 ? "" : path.slice(0, k + 1);
      const leaf = path.slice(k + 1).toLowerCase();
      if (!leaf) return;
      const num = /^\d+/.exec(leaf);
      const pages = idx.filter((e) => !e.p && e.u.startsWith(dir) && !e.u.slice(dir.length).includes("/"));
      const hit = pages.find((e) => {
        const name = e.u.slice(dir.length).toLowerCase();
        if (num) { const m = /^\d+/.exec(name); return m && +m[0] === +num[0] && (leaf === num[0] || name.startsWith(leaf.replace(/^\d+/, m[0]))); }
        return name.startsWith(leaf) || leaf.startsWith(name);
      });
      if (hit) say(root + hit.u, "/" + (root + hit.u).replace(/^\//, ""));
    }).catch(() => {});
    if (ver && ver !== "latest" && rest) {
      const to = "/latest/" + rest;
      fetch(to, { method: "HEAD" }).then((r) => (r.ok ? say(to, to) : near()), near);
    } else {
      near();
    }
  }

  // Where a hit lives, by the first part of its url: the section's one
  // name, as in the header.
  const under = (u: string, d: string): boolean => u === d || u.startsWith(d + "/") || u.startsWith(d + "#");
  const SEC: [dir: string, name: string][] = ko
    ? [["learn", "가이드"], ["examples", "예제"], ["errors", "에러 코드"], ["spec/refs-lang/009-tools", "도구"], ["spec/refs-standard-libraries", "라이브러리 사양"], ["spec", "언어 사양"], ["std", "표준 라이브러리"]]
    : [["learn", "Guide"], ["examples", "Examples"], ["errors", "Error codes"], ["spec/refs-lang/009-tools", "Tools"], ["spec/refs-standard-libraries", "Library spec"], ["spec", "Language spec"], ["std", "Std library"]];
  const where = (u: string): string => {
    const v = u.replace(/^ko\//, "");
    for (const [d, name] of SEC) if (under(v, d)) return name;
    return "";
  };
  // The section index of a page path (after the version directory).
  const sectionOf = (path: string): string => {
    const lang = path.startsWith("ko/") ? "ko/" : "";
    const v = path.slice(lang.length);
    for (const [d] of SEC) if (under(v, d)) return lang + d;
    return lang.replace(/\/$/, "");
  };
  const KIND: Record<string, string> = ko
    ? { method: "메서드", fn: "함수", struct: "struct", enum: "enum", trait: "트레잇", type: "타입 별칭", const: "상수", static: "정적", impl: "impl" }
    : { method: "method", fn: "fn", struct: "struct", enum: "enum", trait: "trait", type: "type", const: "const", static: "static", impl: "impl" };

  // Docs: the version menu and, off the newest release, a banner.
  const vers = document.querySelector<HTMLDetailsElement>(".vers");
  const version = document.body.dataset.version;
  if (vers) {
    // Escape or a click elsewhere closes the menu.
    const sum = vers.querySelector("summary")!;
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && vers.open) { vers.open = false; sum.focus({ preventScroll: true }); }
    });
    document.addEventListener("click", (ev) => { if (!vers.contains(ev.target as Node | null)) vers.open = false; });
  }
  if (vers && version) {
    // The menu comes with the page (layout.nabi): each version's link is
    // this page in it. A page that version lacks: its section's start,
    // with a note, or that version's docs home.
    const here = location.pathname.split("/").slice(2).join("/");
    for (const a of vers.querySelectorAll<HTMLAnchorElement>(".vers-menu a:not([aria-current])")) {
      if (!here) continue;
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const dir = new URL(a.href).pathname.split("/")[1]!;
        const label = a.dataset.label || dir;
        fetch(a.href, { method: "HEAD" }).then((r) => {
          if (r.ok) { location.href = a.href; return; }
          try { sessionStorage.setItem("nabi-missing", label); } catch {}
          const s = sectionOf(here);
          const to = "/" + dir + (s ? "/" + s : "");
          const home = "/" + dir + (here.startsWith("ko/") ? "/ko" : "");
          if (to === home) { location.href = home; return; }
          fetch(to, { method: "HEAD" }).then((r2) => { location.href = r2.ok ? to : home; }, () => { location.href = home; });
        }, () => { location.href = a.href; });
      });
    }
    // Under latest/ the menu's button says so, with the release.
    const at = root.replace(/\/$/, "").split("/").pop();
    if (at === "latest") {
      fetch("/versions.json").then((r) => r.json() as Promise<Versions>).then((v) => {
        const s = vers.querySelector("summary")!;
        const latest = (v.patches && v.patches[v.latest]) || v.latest;
        render(<LatestVersion release={latest} />, s);
        s.setAttribute("aria-label", `${T.version}: latest (v${latest})`);
      }).catch(() => {});
    }
  }

  // Arrived from the version menu at a section start instead of a page.
  try {
    const v = sessionStorage.getItem("nabi-missing");
    if (v) {
      sessionStorage.removeItem("nabi-missing");
      const art = document.querySelector("article.prose");
      if (art) mount(<MissingNote text={T.missing(v)} />, (p) => art.prepend(p));
    }
  } catch {}

  // API pages: `f` filters the methods, on the page and in the rail.
  const items = [...document.querySelectorAll<HTMLElement>("article .api-item")];
  if (items.some((it) => it.querySelector(".members > li"))) {
    const field = (shown: string) => <ApiFilter label={T.filter} shown={shown} onInput={apply} onKeyDown={(ev) => { if (ev.key === "Escape") { fi.value = ""; apply(); fi.blur(); } }} />;
    const first = document.querySelector("article.prose > h2, article.prose > .api-item")!;
    const box = mount<HTMLDivElement>(field(""), (el) => first.before(el));
    const fi = box.el.querySelector("input")!;
    const rail = [...document.querySelectorAll<HTMLElement>(".toc li.m, .toc-m li.m")];
    function apply(): void {
      const v = fi.value.trim().toLowerCase();
      let n = 0;
      for (const it of items) {
        const name = (it.id.split(".").pop() || "").toLowerCase();
        const whole = v && name.includes(v);
        let any = false;
        for (const li of it.querySelectorAll<HTMLElement>(".members > li")) {
          const m = ((li.querySelector("h4") || li).id.split(".").pop() || "").toLowerCase();
          const on = !v || whole || m.includes(v);
          li.hidden = !on;
          if (on) { any = true; n++; }
        }
        it.hidden = !!v && !any && !whole;
      }
      for (const li of rail) {
        const a = li.querySelector("a")!;
        li.hidden = !!v && !a.textContent!.toLowerCase().includes(v);
      }
      box.draw(field(v ? T.shown(n) : ""));
    };
    addEventListener("keydown", (ev) => {
      if (ev.key !== "f" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target as Element;
      if (t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
      ev.preventDefault();
      fi.focus();
      fi.select();
    });
  }

  // The download page and the landing page's archives: the row for the
  // visitor's system is marked once known (a tint, so nothing moves).
  const rows = document.querySelectorAll<HTMLElement>("[data-os]");
  if (rows.length) {
    const ua = navigator.userAgent;
    const uad = (navigator as UA).userAgentData;
    const plat = (uad && uad.platform) || navigator.platform || "";
    const os = /Android|iPhone|iPad/.test(ua) ? "" : /mac/i.test(plat) ? "macos" : /win/i.test(plat) ? "windows" : /freebsd/i.test(plat) ? "freebsd" : /linux/i.test(plat) ? "linux" : "";
    const mark = (arm: boolean): void => {
      for (const r of rows) {
        if (r.dataset.os !== os) continue;
        // Linux: the glibc archive of the machine's architecture.
        if (os === "linux" && (r.dataset.libc !== "gnu" || (r.dataset.arch === "aarch64") !== arm)) continue;
        if (os === "windows" && (r.dataset.arch === "aarch64") !== arm) continue;
        r.classList.add("here");
        mount(<HereNote text={T.here} />, (s) => (r.querySelector("h3, th") || r).append(s));
      }
    };
    const arm = /aarch64|arm/i.test(plat + " " + ua);
    // Windows browsers say x64 in the user agent even on arm64; only the
    // client hints tell.
    if (os === "windows" && uad && uad.getHighEntropyValues) {
      uad.getHighEntropyValues(["architecture"]).then((v) => mark(v.architecture === "arm"), () => mark(arm));
    } else {
      mark(arm);
    }
  }

  // The landing page's install command for the visitor's system: the
  // PowerShell line on Windows; the switch shows either.
  const pick = document.querySelector<HTMLElement>("[data-os-pick]");
  if (pick) {
    const choose = (os: string | undefined): void => {
      for (const b of pick.querySelectorAll<HTMLElement>("button[data-pick]")) b.setAttribute("aria-pressed", b.dataset.pick === os ? "true" : "false");
      for (const el of pick.querySelectorAll<HTMLElement>("[data-for]")) el.hidden = el.dataset.for !== os;
    };
    const uad = (navigator as UA).userAgentData;
    const plat = (uad && uad.platform) || navigator.platform || "";
    if (/win/i.test(plat)) choose("windows");
    // A click crossfades the command where the browser can; the
    // detected system above shows at once.
    pick.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLElement>("button[data-pick]");
      if (!b || b.getAttribute("aria-pressed") === "true") return;
      if (document.startViewTransition && !still.matches) document.startViewTransition(() => choose(b.dataset.pick));
      else choose(b.dataset.pick);
    });
  }

  // Playground links carry the plain source (`#src=`); where the browser
  // can deflate, the shorter `#code=` the playground also reads.
  if (deflate) {
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a.play[href*='#src=']")) {
      const [base, data] = a.href.split("#src=");
      try {
        const bytes = Uint8Array.from(atob(data!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        packed(new TextDecoder().decode(bytes)).then((code) => { a.href = `${base}#code=${code}`; }, () => {});
      } catch {}
    }
  }

  const links = (): HTMLAnchorElement[] => [...box!.querySelectorAll("a")];

  const status = document.querySelector<HTMLElement>(".search [role=status]");

  // The list as last searched; drawn again as the selection moves.
  let list: Omit<ResultsProps, "sel"> | null = null;
  const text = { none: T.none, down: T.down, inLatest: T.inLatest, legend: T.legend };
  let gen = 0;
  // Searches started; one that waited for the text index and is no
  // longer the newest draws nothing.
  let asked = 0;
  const draw = (): void => { if (list) render(<Results {...list} sel={sel} />, box!); };

  // mark, show and search run only once q is known to exist (below).
  const mark = (i: number): void => {
    sel = i;
    draw();
    const as = links();
    const a = as[i];
    if (a) {
      q!.setAttribute("aria-activedescendant", a.id);
      a.scrollIntoView({ block: "nearest" });
    } else {
      q!.removeAttribute("aria-activedescendant");
    }
  };

  const show = (on: boolean): void => {
    box!.hidden = !on;
    q!.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on) q!.removeAttribute("aria-activedescendant");
  };

  // Ranking: an API name equal to the query, then one starting with it,
  // then a page title or heading, then the excerpts. Below four
  // characters only names, titles and headings that start (or have a
  // word that starts) with the query count, so "fn" finds no "define".
  const KIND_ORDER: Record<string, number> = { struct: 0, enum: 0, trait: 0, type: 1, fn: 2, const: 3, static: 3, impl: 4, method: 5 };
  const MAIN_TYPES = ["list", "str", "strbuf", "dict", "set"];
  const esc = (w: string): string => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A Hangul syllable says about as much as two Latin letters, so a
  // two-syllable query is long enough to look into the excerpts.
  const weight = (s: string): number => [...s].reduce((n, c) => n + (/[\u3131-\ud7a3]/.test(c) ? 2 : 1), 0);
  // A Korean word of three syllables or more without its particle
  // ("타입을" -> "타입"): each term matches as typed or bare.
  const PARTICLE = /(으로|에서|에게|까지|부터|이나|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
  const forms = (w: string): string[] => {
    const bare = /^[\uac00-\ud7a3]{3,}$/.test(w) ? w.replace(PARTICLE, "") : w;
    return bare === w ? [w] : [w, bare];
  };
  const has = (hay: string, alts: string[]): boolean => alts.some((w) => hay.includes(w));
  const score = (e: Entry, query: string, terms: string[][], short: boolean): number => {
    const t = e.t.toLowerCase();
    if (e.k) {
      const name = t.split("::").pop()!;
      if (name === query || t === query) return 0;
      if (name.startsWith(query) || t.startsWith(query)) return 1;
    }
    const word = new RegExp("(^|[^\\p{L}\\p{N}_])" + esc(query), "u");
    if (t.startsWith(query)) return 2;
    if (word.test(t)) return 2.2;
    if (short) return -1;
    if (terms.every((w) => has(t, w))) return 2.5;
    const hay = t + " " + (e.x + " " + e.p).toLowerCase();
    if (terms.every((w) => has(hay, w))) return 4;
    return -1;
  };

  const search = async (): Promise<void> => {
    const query = q!.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    if (!terms.length) { asked++; show(false); status!.textContent = ""; return; }
    let data: Entry[];
    try {
      data = await load();
    } catch {
      // Offline, or the index is missing mid-deploy: say so in the list.
      list = { hits: null, terms: [], root, elsewhere: "", gen: ++gen, text };
      draw();
      show(true);
      status!.textContent = T.down;
      mark(-1);
      return;
    }
    const short = weight(query) < 4;
    const alts = terms.map(forms);
    // The text's words: in every term's set, after the names and
    // headings; none below three letters. A missing text index only
    // leaves them out.
    let inText: Set<number> | null = null;
    if (weight(query) >= 3) {
      const mine = ++asked;
      try { await loadText(); } catch {}
      if (mine !== asked) return;
      if (words) {
        // An entry counts when every term the index can hold found it.
        const held = alts.filter((t) => !STOP.has(t[0]!) && (/[\uac00-\ud7a3]/.test(t[0]!) || t[0]!.length >= 3));
        const count = new Map<number, number>();
        for (const t of held) for (const id of textHits(t) || []) count.set(id, (count.get(id) || 0) + 1);
        inText = new Set<number>();
        if (held.length) for (const [id, n] of count) if (n === held.length) inText.add(id);
      }
    }
    const hits: Hit[] = [];
    data.forEach((e, k) => {
      let s = score(e, query, alts, short);
      if (s < 0 && inText && inText.has(k)) s = 5;
      if (s < 0) return;
      const owner = e.k === "method" ? e.t.toLowerCase().split("::")[0]! : "";
      hits.push([s, e.k ? (KIND_ORDER[e.k] ?? 6) : (e.p ? 7 : 6), MAIN_TYPES.includes(owner) ? 0 : 1, e.t.length, e]);
    });
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    // An open list eases to its new height; a closed one fades in (.appear).
    const shown: Shown[] = hits.slice(0, 40).map(([, , , , e]) => ({ t: e.t, u: e.u, p: e.p, x: e.x, tag: e.k ? KIND[e.k] || e.k : where(e.u) }));
    // Another version may have it: an older one lacks newer pages.
    const elsewhere = !hits.length && /^\/\d+\.\d+(\.\d+)?\/$|^\/dev\/$/.test(root)
      ? "/latest" + (ko ? "/ko" : "") + "?q=" + encodeURIComponent(q!.value.trim()) : "";
    const fill = (): void => {
      list = { hits: shown, terms: alts.flat(), root, elsewhere, gen: ++gen, text };
      sel = -1;
      draw();
    };
    if (box!.hidden) fill(); else resize(box!, fill);
    show(true);
    status!.textContent = !hits.length ? T.none : T.found(Math.min(hits.length, 40), hits.length);
    mark(links().length ? 0 : -1);
  };

  if (!q) return;
  // Folded header: the search icon opens the field over the row. It
  // grows from where the icon sits and shrinks back there; .open places
  // it, so the frames run from the icon's box to the open one.
  const sbox = q.closest<Growing>(".search")!;
  const grow = (open: boolean): void => {
    if (sbox.grew) { sbox.grew.cancel(); sbox.grew = null; }
    if (open === sbox.classList.contains("open")) return;
    if (!top || !top.classList.contains("nav-compact") || !moves(sbox)) { sbox.classList.toggle("open", open); return; }
    sbox.classList.remove("open");
    const icon = sbox.getBoundingClientRect();
    sbox.classList.add("open");
    const wide = sbox.getBoundingClientRect();
    const cs = getComputedStyle(sbox);
    const x = parseFloat(cs.left), y = parseFloat(cs.top);
    const at = [{ left: x + icon.left - wide.left + "px", top: y + icon.top - wide.top + "px", width: icon.width + "px" }, { left: x + "px", top: y + "px", width: wide.width + "px" }];
    if (!open) at.reverse();
    sbox.grew = sbox.animate(at, { duration: ms(open ? "--dur" : "--dur-out"), easing: token("--ease") });
    // focus back in the field while it shrinks keeps it open
    if (!open) sbox.grew.onfinish = () => { if (document.activeElement !== q) sbox.classList.remove("open"); sbox.grew = null; };
  };
  sbox.addEventListener("click", () => {
    if (top && top.classList.contains("nav-compact")) { grow(true); q.focus(); }
  });
  q.addEventListener("blur", () => { if (!q.value) setTimeout(() => { if (document.activeElement !== q) grow(false); }, 150); });
  q.addEventListener("focus", () => load().then(loadText).catch(() => {}), { once: true });
  q.addEventListener("input", search);
  q.addEventListener("keydown", (ev) => {
    const n = links().length;
    if (ev.key === "ArrowDown" && n) { ev.preventDefault(); mark((sel + 1) % n); }
    else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); mark((sel - 1 + n) % n); }
    else if (ev.key === "Enter" && links()[sel]) { location.href = links()[sel]!.href; }
    else if (ev.key === "Escape") {
      show(false);
      // folded header: shut the field and give focus back to its icon
      const so = sbox.querySelector<HTMLElement>(".s-open");
      if (top && top.classList.contains("nav-compact") && so) { ev.preventDefault(); q.value = ""; grow(false); so.focus({ preventScroll: true }); }
      else q.blur();
    }
  });
  // A shortcuts help card, opened with ? (and closed with Escape).
  let help: HelpBox | null = null;
  const buildHelp = (): void => {
    const rows: Row[] = [["/", T.rows.search]];
    if (document.querySelector(".pager")) rows.push(["[  ]", T.rows.pager]);
    if (document.querySelector(".api-filter")) rows.push(["f", T.rows.filter]);
    rows.push(["?", T.rows.help], ["Esc", T.rows.esc]);
    const card = (hidden: boolean) => <KbdHelp title={T.help} rows={rows} hidden={hidden} onClose={closeHelp} />;
    // modal: focus moves into the card and comes back on close
    const back = document.activeElement;
    const box = mount<HTMLDivElement>(card(false), (el) => document.body.append(el));
    help = { box, draw: (hidden) => box.draw(card(hidden)), back };
    box.el.querySelector<HTMLElement>(".kbd-card")!.focus({ preventScroll: true });
  };
  const closeHelp = (): void => {
    if (!help) return;
    const h = help;
    help = null;
    h.draw(true);
    if (h.back && h.back.focus) h.back.focus({ preventScroll: true });
    setTimeout(h.box.drop, ms("--dur-out"));
  };
  const toggleHelp = (): void => { if (help) closeHelp(); else buildHelp(); };

  document.addEventListener("keydown", (ev) => {
    const t = ev.target as Element;
    const typing = t.closest && t.closest("input, textarea, select");
    // `/`, Ctrl+K and Cmd+K are keys.js's.
    if (ev.key === "?" && !typing) { ev.preventDefault(); toggleHelp(); }
    else if (ev.key === "Escape" && help) { closeHelp(); }
    else if (ev.key === "Tab" && help) { ev.preventDefault(); }
  });
  document.addEventListener("click", (ev) => {
    if (!(ev.target as Element).closest(".search")) show(false);
  });
  // `?q=` (the 404 page's search field): open the search with it.
  const pre = new URLSearchParams(location.search).get("q");
  if (pre) {
    q.value = pre;
    sbox.classList.add("open");
    q.focus();
    // Shown with the page: no fade.
    box!.style.transition = "none";
    // styled once without it before it comes back
    search().then(() => { getComputedStyle(box!).opacity; box!.style.transition = ""; });
  }
})();
