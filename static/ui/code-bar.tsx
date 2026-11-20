// The buttons a code block's bar (.cb-h) gets: Run, a link to the
// playground with the block's source, and Copy.

export function RunLink({ href, text, label }: { href: string; text: string; label: string }) {
  return <a class="btn-2 btn-sm run" href={href} target="_blank" rel="noopener" aria-label={label}>{text}</a>;
}

export interface CopyProps { text: string; label: string; done: boolean; onClick: () => void }

export function CopyButton({ text, label, done, onClick }: CopyProps) {
  return (
    <button type="button" class={"btn-2 btn-sm copy code-copy" + (done ? " done" : "")} aria-label={label} onClick={onClick}>
      {text}
    </button>
  );
}
