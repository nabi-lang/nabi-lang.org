// The search combobox's listbox (#results): hits, "No results" with
// another version to try, the index being down, and the key legend.
// Options are <a role=option>, hit-0 onwards; `sel` is aria-selected.
import { Fragment, type ComponentChildren } from "preact";

export type Row = [key: string, what: string];

/** A hit as listed: tag is its API kind or section name; abs: its url is
 * whole, not from the version's root. */
export interface Hit { t: string; u: string; p: string; x: string; tag: string; abs?: boolean }

export interface ResultsText { none: string; down: string; inLatest: string; legend: Row[]; packages: string }

export interface ResultsProps {
  /** null: the index could not be read */
  hits: Hit[] | null;
  /** the Packages group under the hits */
  pkgs: Hit[];
  /** search terms to <mark> in titles */
  terms: string[];
  /** the version's root, prefixed to hit urls */
  root: string;
  /** with no hits, the latest docs' search for the query, or "" */
  elsewhere: string;
  sel: number;
  /** a new list each search: fresh nodes, as before */
  gen: number;
  text: ResultsText;
}

// `text` with each search term in it wrapped in <mark>.
function Marked({ text, terms }: { text: string; terms: string[] }): ComponentChildren {
  const words = terms.filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(re).map((part, k) => (k % 2 === 0 ? part : <mark>{part}</mark>));
}

function Legend({ rows }: { rows: Row[] }) {
  return (
    <li role="none" aria-hidden="true" class="legend">
      {rows.map(([k, what]) => (
        <span>{k.split(" ").map((key) => <kbd class="kbd">{key}</kbd>)}{" " + what}</span>
      ))}
    </li>
  );
}

function Option({ e, k, on, root, terms }: { e: Hit; k: number; on: "true" | "false"; root: string; terms: string[] }) {
  return (
    <li role="none">
      <a id={"hit-" + k} role="option" tabIndex={-1} href={e.abs ? e.u : root + e.u} aria-selected={on}>
        <span class="src">{e.tag}</span>
        <span class="hit-t"><Marked text={e.t} terms={terms} /></span>
        {e.p ? <small class="hit-p">{e.p}</small> : null}
        {e.x ? <small class="hit-x">{e.x}</small> : null}
      </a>
    </li>
  );
}

export function Results({ hits, pkgs, terms, root, elsewhere, sel, gen, text }: ResultsProps) {
  const on = (k: number): "true" | "false" => (k === sel ? "true" : "false");
  // Offline, or the index is missing mid-deploy: say so in the list.
  if (!hits) return <li key={gen} role="none" class="empty">{text.down}</li>;
  const n = hits.length;
  return (
    <Fragment key={gen}>
      {hits.map((e, k) => <Option e={e} k={k} on={on(k)} root={root} terms={terms} />)}
      {n || pkgs.length ? null : <li role="none" class="empty">{text.none}</li>}
      {pkgs.length ? (
        <li role="group" aria-labelledby="hits-pkgs" class="grp-pkgs">
          <p id="hits-pkgs" class="grp-h t-label">{text.packages}</p>
          <ul role="none">{pkgs.map((e, k) => <Option e={e} k={n + k} on={on(n + k)} root={root} terms={terms} />)}</ul>
        </li>
      ) : null}
      {!n && !pkgs.length && elsewhere ? (
        <li role="none">
          <a id="hit-0" role="option" tabIndex={-1} class="elsewhere" href={elsewhere} aria-selected={on(0)}>{text.inLatest}</a>
        </li>
      ) : null}
      <Legend rows={text.legend} />
    </Fragment>
  );
}
