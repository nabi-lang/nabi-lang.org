// API pages: the field that filters the methods (`f`), with its count.

export interface ApiFilterProps {
  label: string;
  /** "45 methods", or "" with no filter */
  shown: string;
  onInput: (ev: Event) => void;
  onKeyDown: (ev: KeyboardEvent) => void;
}

export function ApiFilter({ label, shown, onInput, onKeyDown }: ApiFilterProps) {
  return (
    <div class="api-filter">
      <input type="search" placeholder={label} aria-label={label} aria-keyshortcuts="f" autocomplete="off" onInput={onInput} onKeyDown={onKeyDown} />
      <kbd class="kbd" aria-hidden="true">f</kbd>
      <span class="ct" role="status">{shown || null}</span>
    </div>
  );
}
