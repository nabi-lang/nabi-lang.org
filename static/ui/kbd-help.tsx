// The keyboard shortcuts card, a modal dialog over the page.
import type { Row } from "./results.tsx";

export interface KbdHelpProps { title: string; rows: Row[]; hidden: boolean; onClose: () => void }

export function KbdHelp({ title, rows, hidden, onClose }: KbdHelpProps) {
  return (
    <div class="kbd-help appear" hidden={hidden} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="kbd-card" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h2>{title}</h2>
        <dl>
          {rows.map(([k, d]) => [
            <dt>{k.trim().split(/\s+/).map((x, i) => [i ? " " : null, <kbd>{x}</kbd>])}</dt>,
            <dd>{d}</dd>,
          ])}
        </dl>
      </div>
    </div>
  );
}
