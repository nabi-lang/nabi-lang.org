# nabi-lang.org

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](LICENSE-MIT)

*Clear rules, free as a butterfly.*

The generator for the two Nabi websites, written in Nabi. The pages themselves live in their own repositories:

- nabi-lang.org: the landing page (`src/home.nabi`), the download, roadmap, FAQ, community, governance and brand pages and the news posts (`news/`) from [nabi-lang/www](https://github.com/nabi-lang/www), their Korean editions under `/ko/` (from its `ko/`), the release notes (`/releases/<version>`, one page per section of the toolchain's `CHANGELOG.md`, and `/releases`, all of them), the brand files (`/brand/`, from the web kit) and the installers (`/install.sh`, `/install.ps1`), built into `public/www/`.
- docs.nabi-lang.org: the docs, one directory per version (`/0.1/`, `/dev/`, `/latest/`), built into `public/docs/<version>/`.

The docs combine the guide, examples and error codes from [nabi-lang/docs](https://github.com/nabi-lang/docs), the spec (English `spec/en`, Korean `spec/ko`) and the standard library API extracted from `nabi/library`. Released versions are the `vX.Y.Z` branches of docs and spec.

Every docs page is in English and Korean: `/<version>/<path>` and `/<version>/ko/<path>`, with a language switch on each page and hreflang links between the two. The Korean pages are `ko/` in nabi-lang/docs and `spec/ko`; a page not translated yet serves its English text under a note, with `noindex`, and stays out of the sitemap. The API reference comes from the library's English doc comments: `/<version>/ko/std/` shows the same English text in Korean chrome, under a note, with `noindex` and its canonical address on the English page. Each language has its own search files and 404 page, in three parts so that a search reads only what it needs. `search-index.json` (`ko/search-index.json`) holds the titles, the `##` / `###` headings and the API's items, with no excerpts, and is read when the field takes focus. `search-text/<shard>.json` holds the words of every page's body text and of each API item's summary, each with the entries it appears in, one file per first letter (`a`..`z`, `0` for digits, `k0`..`k18` for Hangul by initial consonant, `other`); a query of three letters or more reads the files of its words. `search-x/<k>.json` holds the excerpts, 256 entries a file, read for the first hits shown once typing pauses. A query matches names and headings first, then the body text (every word of the query, as a prefix; a word of five letters or more with no match also takes words one edit away that start with the same letter). Under the hits, a Packages group: the registry's packages (`GET /api/v1/docs?format=json`) and every package's API (`/packages/search-api.json`, the newest version of each, names only), read with the first query of three letters. `search::split` makes the three parts from the indexes a build or an archive holds, so archived versions are served the same way. The first search for "towers hanoi" reads 172 KiB gzipped (it read 515 KiB when the excerpts and the whole text index came at once), "하노이" 180 KiB (725 KiB); `npm run browser` prints the figures.

Every page loads the web kit's search palette (`palette.js`): Cmd+K or Ctrl+K, or the header's search button on nabi-lang.org, opens one field over the docs (of the version shown; of `latest/` from nabi-lang.org), the standard library, the packages and the examples, its results grouped Docs / Std / Packages / Examples. The docs host answers its JSON files with `Access-Control-Allow-Origin: *` for it, and the pages' CSP lets them reach docs.nabi-lang.org and packages.nabi-lang.org.

Pages carry JSON-LD: `WebSite` with a `SearchAction` (the docs search, `?q=`) on the landing page and the docs home, `SoftwareApplication` on the landing and download pages, `BreadcrumbList` on every docs and package docs page. Sitemaps have `<lastmod>`: a docs page's "Last updated" date, a nabi-lang.org page's last commit (`updated.nabion`, or `git log` in a local checkout), when a package's docs were fetched. `sitemap-index.xml` on nabi-lang.org lists the sitemaps of every host (nabi-lang.org, the docs' `latest/`, `/packages/sitemap.xml`, the registry), and each host's `robots.txt` names it.

## Build

Needs the Nabi toolchain (`nabi`, `nabic`), the [web kit](https://github.com/nabi-lang/web) submodule at `web/` (clone with `git clone --recurse-submodules`, or run `git submodule update --init` in an existing clone), plus checkouts of [nabi-lang/docs](https://github.com/nabi-lang/docs), [nabi-lang/www](https://github.com/nabi-lang/www), [nabi-lang/nabi](https://github.com/nabi-lang/nabi), and [nabi-lang/spec](https://github.com/nabi-lang/spec), laid out beside this repo:

```
./
|-- docs/               # guide, examples
|-- www/                # home, download, roadmap
|-- nabi/               # toolchain; nabi/library is the standard library
|-- spec/               # spec/en/ + spec/ko/
`-- nabi-lang.org/      # this repository
```

If checkouts live elsewhere, point `docs`, `www`, `spec`, `spec_ko`, and `library` at them in `site.local.nabion` (git-ignored; overrides `site.nabion`). No toolchain? Install one (`curl -fsSL https://nabi.sh | sh`) or `cargo build --release` in `../nabi`.

```bash
nabi run                      # build public/www/ and the dev docs
nabi run -- --version 0.1     # build the 0.1 docs (and latest/ if it is newest)
nabi run -- check             # build + run code blocks; exit 1 on broken links or failed blocks
nabi run -- code [filter]     # run code blocks only
nabi run -- home              # rewrite home/<name>.out from `nabi run` (check fails while they differ)
nabi test                     # the site code's tests
npm run browser -- --shots shots   # the built pages in Chrome (below)
```

Code blocks that use an official package (`table::read_csv(..)`, `use stats::Normal;`) get it added on first use, as for any user. Before the packages are on the registry, point `NABI_PACKAGES` at a directory of their checkouts (`NABI_PACKAGES=~/src nabi run -- check`): each such block then runs with path dependencies on them.

`npm run browser` serves `public/` itself and opens a representative set of pages (or the ones given, `www:ko/`, `docs:learn/rosetta/` or `pkg:json/latest`) in headless Chrome, in light and dark and at desktop and phone width. It answers for docs.nabi-lang.org from `public/docs` (its `latest/` from `--version`) and for the registry's package list, and refuses every other address off the machine. It fails on a script error, a missing file, a page that scrolls sideways on a phone, and on accessibility problems: no `lang`, a heading level skipped, duplicate ids, an image, button or link without a name, a control inside `role="img"`, a form field without a label, text below the WCAG AA contrast ratio, a control smaller than 24 x 24 px (WCAG 2.2, 2.5.8). It also checks that the docs search finds phrases that only body text has and shows a Packages group, that a focused link is never under the sticky header (2.4.11), that the version and language menus close on Escape and give the focus back to their button, and that the search palette opens on Ctrl+K with its groups and closes on Escape; then it prints what the first search reads. `--shots <dir>` saves a screenshot of each.

Generation takes 1-5 seconds; `check` compiles and runs hundreds of code blocks and takes 1-3 minutes. The ` ```nabi ` block check rules (`build`, `norun`, `output`) are the web kit's `tools/snippets`.

## Scripts

The page scripts are TypeScript and TSX: each file directly in `static/` is a page script, `static/ui/*.tsx` are the Preact components they render into the server's markup, and the kit's `web/js/*.ts` come along. `npm ci`, then `npm run build` bundles each page script to the `.js` beside it with esbuild (`web/tools/build.ts`: types erased, JSX for Preact, imports bundled, minified), and `npm run check` type-checks everything with `tsc`. Run the build before `nabi build`: the kit's scripts are built into the program and the site serves the rest. The `.js` files are build output and not checked in.

## Web kit

`web/` is [nabi-lang/web](https://github.com/nabi-lang/web), pinned to a commit. The generator builds its `web` library in (`Dep::path("web/nabi")`): HTTP and the canonical-address rules (`web::url`), the theme controls, social links and footer (`web::chrome`), the library scanner behind the API pages and their navigation (`web::apidoc`, `web::apidoc::nav`), and the kit's files, which every build writes beside `static/` into `public/www/` and each docs version directory: `nabi.css`, `theme.js`, `keys.js`, `copy.js`, `palette.js`, `logo.svg`, the icons and `site.webmanifest`, plus the webfonts, copied from `web/assets/fonts` to `fonts/` (Geist, Geist Mono, Pretendard; Korean pages load Pretendard's stylesheet), and on nabi-lang.org the brand files, copied from `web/assets/brand/download` to `brand/`. The fonts are files, not built in, so `serve` needs `web/assets/fonts` beside `site.nabion` and `static/` at run time. Move to a newer kit with:

```bash
git submodule update --remote web
nabi run && nabi test
git commit -am "chore: bump the web kit"
```

## Preview

Serve over HTTP (the search index is loaded with `fetch`); set `base_url` / `docs_url` in `site.local.nabion` for cross-site links. Pages link with canonical addresses (`/latest/learn/05-sum-types`: no `.html`, no `/index.html`, no trailing slash but on `/`), which `serve` resolves to `<path>.html` or `<path>/index.html` (for a path ending in `index`, such as the API page of `core::index` at `std/core/index/index.html`, `<path>/index.html` first); a plain file server needs the `.html` typed in.

```bash
python3 -m http.server -d public/www 8401    # nabi-lang.org
python3 -m http.server -d public/docs 8403   # docs.nabi-lang.org
```

## Serve

`nabi_lang_org serve` runs both sites from content bundles (one NABION file per branch of docs, www and spec, built by `nabi-content bundle` in [nabi-lang/web](https://github.com/nabi-lang/web)). A release is a `vX.Y.Z` branch in both docs and spec (nothing lists them by hand; the newest is `latest/` and the release the home and download pages offer). It archives each release once, from those branches and the release tag of nabi, wraps every archive in the current chrome, and rebuilds when a bundle changes. `serve.nabi` lists its environment.

Deployment itself lives in a private repository.

## Link previews

og:image and twitter:image are `og.png?v=<first 10 hex digits of its SHA-256>`, taken from `static/og.png` at build time, so a new image is a new URL that every platform fetches afresh. Stylesheets and scripts are linked the same way (`nabi.css?v=...`). `serve` is the only place that sets caching: a file asked for at its current `?v=` keeps a year (`immutable`); pages of a released version (`/0.1.2/...`) and the fonts a day; pages of `latest/`, `dev/` and nabi-lang.org, and the search indexes, five minutes; other files an hour. Every page carries an ETag and answers `If-None-Match` with 304. A redirect to a page's canonical address (`/latest/` to `/latest`) is a 301 kept a day. Every docs page has a card of its own, with its section, its title and its first sentence: `/<version>/og/<page>.png?v=<hash of what it shows>`. A build lists each version's cards in `og.nabion` beside its pages; `serve` draws a card with [Typst](https://typst.app) and `og/card.typ` the first time it is asked for (`NABI_WEB_TYPST`, with Geist and Pretendard in `NABI_WEB_OG_FONTS`), keeps it under its data directory, and falls back to `og.png` without one. When only a page's text changes, the cached card stays: re-scrape it with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) or Kakao's [sharing debugger](https://developers.kakao.com/tool/debugger/sharing) (clear the cache); X has no tool and refreshes in about 7 days.

## Package docs

The packages' API docs are on the docs site, as docs.rs does for crates.io: `/packages/<name>/<version>/<module>`, `latest/` for the newest version, and `/packages` lists them. The registry scans each published version and hands the modules out (`GET /api/v1/docs`, `GET /api/v1/packages/<name>/<version>/docs`); `serve` fetches what is new each round into `<data>/pkgdocs` (from `NABI_WEB_PACKAGES`, packages.nabi-lang.org by default) and the build renders them with the standard library's API pages, in the chrome of `latest/`. A version's pages keep a day, `latest/` five minutes. Locally, `nabi run -- pkgdocs-sync <dir> <registry>` fetches them and `pkg_docs` in `site.local.nabion` (or `NABI_PKG_DOCS`) points the build at `<dir>`.

## Configuration

Edit `site.nabion` (NABION); `site.local.nabion` overrides its fields. Key fields: `title`, `tagline`, `description`, `base_url`, `docs_url`, `docs`, `www`, `spec` / `spec_ko`, `packages`, `library`, `out`. `versions.nabion` lists released docs versions, newest first, for local builds; the server works them out from the branches.

## Layout

| File | Contents |
|------|----------|
| `src/main.nabi`   | Config and arguments; runs the build: fragments of every page, then each output directory |
| `src/spec.nabi`   | Spec pages (English and Korean): sources, links, breadcrumbs, the other edition |
| `src/guide.nabi`  | The docs' own pages (guide, examples, error codes) in both languages, and the docs home |
| `src/apidoc.nabi` | API pages from the standard library sources |
| `src/pkgdocs.nabi` | The packages' API pages (`/packages/<name>/<version>`) from what the registry made of each version |
| `src/www.nabi`    | The nabi-lang.org pages (news/ listed newest first, releases/ from CHANGELOG.md), the download page's archive sizes, robots.txt, security.txt, the sitemap and the sitemap index, the brand files, the installers |
| `src/home.nabi`   | The nabi-lang.org landing page; its release notes come from nabi's CHANGELOG.md, archive sizes from the GitHub release |
| `src/search.nabi` | The search index of each language, the body-text index, and the files they are served as (`split`; `merge`, the packages' API in one) |
| `src/links.nabi`  | Canonical links, error code links, Korean pages' links to English-only pages, the link check |
| `src/files.nabi`  | A version directory as written: pages, 404s, search indexes, llms.txt, static files |
| `src/versions.nabi` | Released versions re-wrapped from their archives, latest/, the files above the versions |
| `src/layout.nabi` | Page frames: header, navigation, sidebar, footer, 404 |
| `src/llms.nabi`   | llms.txt and llms-full.txt |
| `src/check.nabi`  | The code blocks of the pages, checked by the web kit's `snippets`; the landing page's programs |
| `home/`          | The landing page's programs and what `nabi run` prints for each (`<name>.out`, checked by `nabi run -- check`) |
| `src/serve.nabi`  | The server: bundles, release archives, rebuilds, routing |
| `static/`        | `style.css` (this site), `search.tsx` and its `ui/*.tsx` components, `og.png` |
| `web/`           | the web kit (submodule): `nabi.css`, `theme.js`, `keys.js`, marks and icons, and the `web` library (HTTP, addresses, footer markup) |
| `og/`            | `og.png` source: `node og/render.ts og/card.html static/og.png` after `npm ci`; `card.typ`, the docs' cards |

Markdown and ` ```nabi ` / ` ```nabion ` highlighting come from the [`markdown`](https://github.com/nabi-lang/markdown) and [`nabi-syntax`](https://github.com/nabi-lang/nabi-syntax) packages (path dependencies on `../markdown` and `../nabi-syntax` until switched to their packages.nabi-lang.org versions).
