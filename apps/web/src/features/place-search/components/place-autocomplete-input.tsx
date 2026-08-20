import { Loader2, MapPin, Search, X } from 'lucide-react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { usePlaceSearch } from '../hooks/use-place-search'
import type { PlaceSuggestion, TextMatch } from '../types'

/**
 * The textbox and its suggestion list.
 *
 * A real combobox, not a div with an onClick: `role="combobox"` plus
 * `aria-activedescendant` is the only reason a screen reader knows a list
 * appeared and which row is current. Arrow keys move the highlight, Enter
 * picks, Escape closes, and a click outside closes.
 */
export function PlaceAutocompleteInput() {
  const {
    query,
    suggestions,
    status,
    isSearching,
    error,
    setQuery,
    clearSearch,
    selectPlace,
    retrySearch,
  } = usePlaceSearch()

  const listboxId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /** -1 means "no row highlighted", which is the state Enter must not act on. */
  const [activeIndex, setActiveIndex] = useState(-1)
  /**
   * Dismissal is the state; whether the list shows is derived from it below.
   *
   * The other way round -- an open/closed flag pushed from an effect watching
   * `status` -- costs a render, an effect, and a second render on every
   * keystroke, and React's own lint rule flags it. The only thing worth
   * remembering here is whether the user closed the list; whether there is
   * anything to show already lives in the slice.
   */
  const [isDismissed, setIsDismissed] = useState(false)

  // Close on an outside click. Pointerdown rather than click: a click that
  // starts outside and ends inside should still close, and pointerdown fires
  // before the input can steal focus back.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsDismissed(true)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Keeps the highlighted row visible when the arrow keys walk past the
  // scroll edge. `nearest` so it does not jump the list on every keypress.
  useEffect(() => {
    if (activeIndex < 0) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // `status !== 'idle'` is what keeps an empty bordered rectangle off the
  // screen: an untouched box has nothing to say.
  const showDropdown = !isDismissed && (status !== 'idle' || suggestions.length > 0)

  function pick(suggestion: PlaceSuggestion) {
    selectPlace(suggestion.placeId, suggestion.mainText)
    setIsDismissed(true)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsDismissed(true)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Otherwise the caret jumps to the end of the text instead.
      event.preventDefault()
      if (suggestions.length === 0) return
      setIsDismissed(false)
      const step = event.key === 'ArrowDown' ? 1 : -1
      // Wraps, including from -1 upwards to the last row.
      setActiveIndex((current) => {
        const next = current + step
        if (next < 0) return suggestions.length - 1
        return next % suggestions.length
      })
      return
    }
    if (event.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault()
      pick(suggestions[activeIndex])
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label="Search for a place"
          autoComplete="off"
          placeholder="Search for a place…"
          className="h-11 pr-10 pl-9"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            // Reset the highlight from the event that invalidates it rather
            // than from an effect watching `suggestions`: index 2 of the old
            // list is an unrelated place in the new one.
            setActiveIndex(-1)
            setIsDismissed(false)
          }}
          onFocus={() => setIsDismissed(false)}
          onKeyDown={onKeyDown}
        />

        {/*
          Spinner and × share this slot, so neither one shifts the layout when
          it swaps in. The spinner sits *inside* the input for the same reason.
        */}
        <div className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center">
          {isSearching ? (
            <Loader2 aria-hidden className="text-muted-foreground size-4 animate-spin" />
          ) : query !== '' ? (
            <button
              type="button"
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                clearSearch()
                setActiveIndex(-1)
                setIsDismissed(true)
              }}
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {showDropdown && (
        <div className="bg-card border-border absolute z-10 mt-2 w-full overflow-hidden rounded-xl border shadow-lg">
          {status === 'error' ? (
            // The state most likely to actually happen — a misconfigured key,
            // a disabled API — and the one where a blank dropdown would be the
            // worst possible feedback.
            <div className="p-4 text-sm">
              <p className="text-destructive">{error}</p>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-2 underline"
                onClick={() => retrySearch(query)}
              >
                Retry
              </button>
            </div>
          ) : status === 'ready' && suggestions.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">
              No places found for “{query}”
            </p>
          ) : (
            <ul ref={listRef} id={listboxId} role="listbox" className="max-h-72 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.placeId}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-index={index}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm',
                    index === activeIndex && 'bg-secondary',
                  )}
                  // Pointer, not mouse: the highlight should follow a stylus
                  // and a trackpad alike, and it keeps the keyboard and the
                  // pointer sharing one notion of "current row".
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => pick(suggestion)}
                >
                  <MapPin aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      <HighlightedText text={suggestion.mainText} matches={suggestion.matches} />
                    </span>
                    {suggestion.secondaryText !== '' && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {suggestion.secondaryText}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Bolds the characters Google says matched.
 *
 * The ranges come back from the API already computed, so this is free — and it
 * is what tells the user *why* a row matched. Ranges are assumed sorted and
 * non-overlapping, which is how the Places API returns them; anything outside a
 * range renders plain.
 */
function HighlightedText({ text, matches }: { text: string; matches: TextMatch[] }) {
  if (matches.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let cursor = 0

  matches.forEach((match, index) => {
    const start = Math.max(match.startOffset, cursor)
    const end = Math.min(match.endOffset, text.length)
    if (end <= start) return
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={index} className="bg-transparent font-semibold text-inherit">
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })

  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
