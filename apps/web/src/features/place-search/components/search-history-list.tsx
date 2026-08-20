import { Clock } from 'lucide-react'

import { usePlaceSearch } from '../hooks/use-place-search'

/**
 * Every search this session, newest first.
 *
 * One row per *selected place*, not per debounced keystroke — the plan's
 * Question #10. That is what makes a row worth clicking: clicking it puts the
 * place back on the map, with no second API call, because the entry already
 * carries its coordinates.
 */
export function SearchHistoryList() {
  const { history, selected, selectHistoryEntry } = usePlaceSearch()

  if (history.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        Searches you make will be listed here.
      </p>
    )
  }

  return (
    <section aria-labelledby="search-history-heading">
      <h2
        id="search-history-heading"
        className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
      >
        This session
      </h2>

      <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {history.map((entry) => (
          <li key={entry.placeId}>
            <button
              type="button"
              // aria-current, not a visual-only highlight: the row that is on
              // the map is state, and a screen reader has no other way to know.
              aria-current={entry.placeId === selected?.placeId ? 'true' : undefined}
              className="hover:bg-secondary focus-visible:ring-ring flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none aria-[current]:bg-secondary"
              onClick={() => selectHistoryEntry(entry.placeId)}
            >
              <Clock aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{entry.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {entry.formattedAddress}
                </span>
              </span>
              <time
                className="text-muted-foreground shrink-0 text-xs"
                dateTime={new Date(entry.searchedAt).toISOString()}
              >
                {new Date(entry.searchedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
