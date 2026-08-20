import { Star } from 'lucide-react'

import { useAppSelector } from '@/app/hooks'
import { cn } from '@/lib/utils'

import { usePlaceSearch } from '../hooks/use-place-search'
import { selectIsFavourite } from '../stores/selectors'

/**
 * Name, address, coordinates, and the star.
 *
 * The star is optimistic: it fills on click and reverts with a small note if
 * the API call fails. Waiting for a round trip makes a toggle feel broken.
 */
export function PlaceDetailsCard() {
  const { selected, detailsPending, detailsError, favouriteError, toggleFavourite } =
    usePlaceSearch()

  // Reads '' when nothing is selected, which is fine: the hook's own early
  // return below means the value is never rendered in that case, and calling
  // the selector unconditionally keeps the hook order stable.
  const isFavourite = useAppSelector((state) => selectIsFavourite(state, selected?.placeId ?? ''))

  if (detailsPending) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border p-4 text-sm">
        Loading place…
      </div>
    )
  }

  if (detailsError) {
    return (
      <div className="border-destructive/40 text-destructive rounded-xl border p-4 text-sm">
        {detailsError}
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        Search for a place to see its details here.
      </div>
    )
  }

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{selected.name}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{selected.formattedAddress}</p>
        </div>

        <button
          type="button"
          // The label says what the click will do, not what the state is —
          // a screen reader reads it as a command.
          aria-label={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
          aria-pressed={isFavourite}
          className="focus-visible:ring-ring shrink-0 rounded-lg p-1.5 focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => toggleFavourite(selected)}
        >
          <Star
            aria-hidden
            className={cn(
              'size-5 transition-colors',
              isFavourite ? 'fill-current text-amber-500' : 'text-muted-foreground',
            )}
          />
        </button>
      </div>

      <p className="text-muted-foreground mt-3 font-mono text-xs">
        {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
      </p>

      {favouriteError && (
        <p className="text-destructive mt-2 text-xs">{favouriteError}</p>
      )}
    </div>
  )
}
