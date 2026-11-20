# nabi-lang.org

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](LICENSE-MIT)

*Clear rules, free as a butterfly.*

The generator for the two Nabi websites, written in Nabi. The pages themselves live in their own repositories:

- nabi-lang.org: the landing page (`src/home.nabi`), the download, roadmap and FAQ pages and the news posts (`news/`) from [nabi-lang/www](https://github.com/nabi-lang/www), their Korean editions under `/ko/` (from its `ko/`), and the installers (`/install.sh`, `/install.ps1`), built into `public/www/`.
- docs.nabi-lang.org: the docs, one directory per version (`/0.1/`, `/dev/`, `/latest/`), built into `public/docs/<version>/`.

The docs combine the guide, examples and error codes from [nabi-lang/docs](https://github.com/nabi-lang/docs), the spec (English `spec/en`, Korean `spec/ko`) and the standard library API extracted from `nabi/library`. Released versions are the `vX.Y.Z` branches of docs and spec.

Every docs page is in English and Korean: `/<version>/<path>` and `/<version>/ko/<path>`, with a language switch on each page and hreflang links between the two. The Korean pages are `ko/` in nabi-lang/docs and `spec/ko`; a page not translated yet serves its English text under a note, with `noindex`, and stays out of the sitemap. The API reference comes from the library's English doc comments: `/<version>/ko/std/` shows the same English text in Korean chrome, under a note, with `noindex` and its canonical address on the English page. Each language has its own search indexes and 404 page. `search-index.json` (`ko/search-index.json`) holds the titles, the `##` / `###` headings and the API's items with an excerpt each; `search-text.json` holds the words of every page's body text, each with the entries it appears in, and is fetched with the first query of three letters or more. A query matches names and headings first, then the body text (every word of the query, as a prefix; a word of five letters or more with no match also takes words one edit away).

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

`npm run browser` serves `public/` itself and opens a representative set of pages (or the ones given, `www:ko/` or `docs:learn/science/`) in headless Chrome, in light and dark and at desktop and phone width. It fails on a script error, a missing file, a page that scrolls sideways on a phone, and on accessibility problems: no `lang`, a heading level skipped, duplicate ids, an image, button or link without a name, a control inside `role="img"`, a form field without a label, text below the WCAG AA contrast ratio. It also checks that the docs search finds phrases that only body text has. `--shots <dir>` saves a screenshot of each.

Generation takes 1-5 seconds; `check` compiles and runs hundreds of code blocks and takes 1-3 minutes. The ` ```nabi ` block check rules (`build`, `norun`, `output`) are the web kit's `tools/snippets`.

## Scripts

The page scripts are TypeScript and TSX: each file directly in `static/` is a page script, `static/ui/*.tsx` are the Preact components they render into the server's markup, and the kit's `web/js/*.ts` come along. `npm ci`, then `npm run build` bundles each page script to the `.js` beside it with esbuild (`web/tools/build.ts`: types erased, JSX for Preact, imports bundled, minified), and `npm run check` type-checks everything with `tsc`. Run the build before `nabi build`: the kit's scripts are built into the program and the site serves the rest. The `.js` files are build output and not checked in.

## Web kit

`web/` is [nabi-lang/web](https://github.com/nabi-lang/web), pinned to a commit. The generator builds its `web` library in (`Dep::path("web/nabi")`): HTTP and the canonical-address rules (`web::url`), the theme controls, social links and footer (`web::chrome`), the library scanner behind the API pages and their navigation (`web::apidoc`, `web::apidoc::nav`), and the kit's files, which every build writes beside `static/` into `public/www/` and each docs version directory: `nabi.css`, `theme.js`, `keys.js`, `copy.js`, `logo.svg`, the icons and `site.webmanifest`, plus the webfonts, copied from `web/assets/fonts` to `fonts/` (Geist, Geist Mono, Pretendard; Korean pages load Pretendard's stylesheet). The fonts are files, not built in, so `serve` needs `web/assets/fonts` beside `site.nabion` and `static/` at run time. Move to a newer kit with:

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

og:image and twitter:image are `og.png?v=<first 10 hex digits of its SHA-256>`, taken from `static/og.png` at build time, so a new image is a new URL that every platform fetches afresh. Stylesheets and scripts are linked the same way (`nabi.css?v=...`). `serve` is the only place that sets caching: a file asked for at its current `?v=` keeps a year (`immutable`); pages of a released version (`/0.1.2/...`) and the fonts a day; pages of `latest/`, `dev/` and nabi-lang.org, and the search indexes, five minutes; other files an hour. Every page carries an ETag and answers `If-None-Match` with 304. Every docs page has a card of its own, with its section, its title and its first sentence: `/<version>/og/<page>.png?v=<hash of what it shows>`. A build lists each version's cards in `og.nabion` beside its pages; `serve` draws a card with [Typst](https://typst.app) and `og/card.typ` the first time it is asked for (`NABI_WEB_TYPST`, with Geist and Pretendard in `NABI_WEB_OG_FONTS`), keeps it under its data directory, and falls back to `og.png` without one. When only a page's text changes, the cached card stays: re-scrape it with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) or Kakao's [sharing debugger](https://developers.kakao.com/tool/debugger/sharing) (clear the cache); X has no tool and refreshes in about 7 days.

## Configuration

Edit `site.nabion` (NABION); `site.local.nabion` overrides its fields. Key fields: `title`, `tagline`, `description`, `base_url`, `docs_url`, `docs`, `www`, `spec` / `spec_ko`, `packages`, `library`, `out`. `versions.nabion` lists released docs versions, newest first, for local builds; the server works them out from the branches.

## Layout

| File | Contents |
|------|----------|
| `src/main.nabi`   | Config and arguments; runs the build: fragments of every page, then each output directory |
| `src/spec.nabi`   | Spec pages (English and Korean): sources, links, breadcrumbs, the other edition |
| `src/guide.nabi`  | The docs' own pages (guide, examples, error codes) in both languages, and the docs home |
| `src/apidoc.nabi` | API pages from the standard library sources |
| `src/www.nabi`    | The nabi-lang.org pages (news/ listed newest first), the download page's archive sizes, robots.txt, security.txt, the sitemap, the installers |
| `src/home.nabi`   | The nabi-lang.org landing page; its release notes come from nabi's CHANGELOG.md, archive sizes from the GitHub release |
| `src/search.nabi` | The search index of each language |
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
