// A page's link preview card, 1200x630 at 72 ppi. serve renders it
// on request (serve.nabi og_card) with --input section, title, lead, lang;
// wordmark.svg (the dark one) sits beside it. Colours are web/css/nabi.css's dark theme.
#let bg = rgb("#141114")
#let ink = rgb("#faf7f8")
#let ink2 = rgb("#bdb3b8")
#let line2 = rgb("#3b3539")
#let input(k) = sys.inputs.at(k, default: "")
#let ko = input("lang") == "ko"

#set page(width: 1200pt, height: 630pt, margin: (x: 72pt, y: 64pt), fill: bg)
#set text(font: ("Geist", "Pretendard"), fill: ink, lang: if ko { "ko" } else { "en" }, hyphenate: false, top-edge: 0.8em, bottom-edge: -0.2em)

// `body` in lines of `pitch`, at most `n` of them (the rest is cut)
#let lines(size, pitch, n, body) = context {
  let p = par(leading: pitch - size, body)
  let most = n * pitch - (pitch - size)
  let h = measure(block(width: 1056pt, p)).height
  block(width: 1056pt, height: calc.min(h, most), clip: true, p)
}

#grid(
  rows: (auto, 1fr, auto, auto),
  grid(
    columns: (auto, auto, auto),
    column-gutter: 16pt,
    align: horizon,
    image("wordmark.svg", height: 60pt),
    // nabi-lang.org's own pages have no section
    if input("section") != "" { text(font: "Geist Mono", size: 30pt, fill: line2)[/] },
    text(font: "Geist Mono", size: 30pt, weight: "medium", fill: ink2, tracking: -0.02em, lower(input("section"))),
  ),
  [],
  {
    let pitch = if ko { 80pt } else { 72pt }
    lines(64pt, pitch, 3, text(font: ("Geist Mono", "Pretendard"), size: 60pt, weight: "semibold", tracking: if ko { -0.02em } else { -0.04em }, input("title")))
  },
  if input("lead") != "" {
    let pitch = if ko { 46pt } else { 40pt }
    pad(top: 24pt, lines(28pt, pitch, 3, text(size: 28pt, fill: ink2, input("lead"))))
  },
)
