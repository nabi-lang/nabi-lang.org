// Components that sit among server-rendered siblings, or straight in
// <body>, cannot own their parent. Each is rendered into a fragment of
// its own and its one element moved to `place`; later draws patch that
// element where it is, so a component keeps its root element's type.
import { render, type ComponentChild } from "preact";

export interface Mounted<E extends Element> {
  /** The component's root element. */
  el: E;
  /** Render it again, at once (a size easing measures right after). */
  draw(v: ComponentChild): void;
  /** Unmount it, which takes its element out of the page. */
  drop(): void;
}

export function mount<E extends Element>(v: ComponentChild, place: (el: E) => void): Mounted<E> {
  const frag = document.createDocumentFragment();
  render(v, frag);
  const el = frag.firstElementChild as E;
  place(el);
  return { el, draw: (n) => render(n, frag), drop: () => render(null, frag) };
}
