// Small pieces the page script adds to server-rendered pages.

/** The narrow screens' backdrop behind the sidebar drawer. */
export function Scrim({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return <div class="scrim appear" hidden={hidden} onClick={onClick} />;
}

/** A passing message ("Link copied"). */
export function Toast({ text, hidden }: { text: string; hidden: boolean }) {
  return <div class="toast appear" role="status" hidden={hidden}>{text}</div>;
}

/** Above the article: the version lacked the page, so this is its section. */
export function MissingNote({ text }: { text: string }) {
  return <p class="tr-note" role="status">{text}</p>;
}

/** Marks the download row of the visitor's system for screen readers. */
export function HereNote({ text }: { text: string }) {
  return <span class="sr-only">{" " + text}</span>;
}

/** The 404 page's suggestion, inside .lost-hint. */
export function LostHint({ lead, href, label, tail }: { lead: string; href: string; label: string; tail: string }) {
  return <>{lead}<a href={href}>{label}</a>{tail}</>;
}

/** The version menu's button under latest/, inside its <summary>. */
export function LatestVersion({ release }: { release: string }) {
  return <>latest<span class="vers-full">{` (v${release})`}</span></>;
}
