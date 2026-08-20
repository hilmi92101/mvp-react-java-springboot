import { APIProvider } from '@vis.gl/react-google-maps'
import { Link } from 'react-router'

import { googleMapsApiKey } from '@/config/env'
import {
  PlaceAutocompleteInput,
  PlaceDetailsCard,
  PlaceMap,
  SearchHistoryList,
} from '@/features/place-search'

/**
 * `/apps/place-finder` — autocomplete a place, see it on the map, star it.
 *
 * Layout only. Every piece of state lives in the `place-search` feature, which
 * is why this file has no `useState` and no data of its own.
 */
export default function PlaceFinderPage() {
  // A missing key is a configuration problem, and saying so beats rendering a
  // grey rectangle and a console error. This is the check `config/env.ts`
  // deliberately does not make by throwing.
  if (googleMapsApiKey === '') {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Place Finder</h1>
        <p className="text-destructive mt-4 text-sm">
          No Google Maps API key is configured.
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> and run{' '}
          <code>make web-restart</code>. See{' '}
          <code>docs/features/place-finder.md</code> for what the key needs.
        </p>
        <BackToApps />
      </main>
    )
  }

  return (
    // One provider for the page, not for the app: it loads the Maps SDK, and
    // no other route needs that payload. `places` is requested here so the
    // Autocomplete Data API is warm before the first keystroke.
    <APIProvider apiKey={googleMapsApiKey} libraries={['places']}>
      <main className="mx-auto w-full max-w-6xl px-5 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Place Finder</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Search a place, see it on the map, star the ones worth keeping.
          </p>
        </header>

        {/*
          One column on narrow screens (search and history above, map below),
          two from `lg` up. The map gets a fixed height rather than a flex
          stretch: a percentage height inside a grid row collapses to zero,
          which renders as a blank page and looks like an SDK failure.
        */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <PlaceAutocompleteInput />
            <PlaceDetailsCard />
            <SearchHistoryList />
          </div>

          <div className="border-border h-[60vh] min-h-80 overflow-hidden rounded-xl border lg:h-[calc(100vh-14rem)]">
            <PlaceMap />
          </div>
        </div>

        <BackToApps />
      </main>
    </APIProvider>
  )
}

function BackToApps() {
  return (
    <Link
      to="/"
      className="text-muted-foreground hover:text-foreground mt-8 inline-block text-sm underline"
    >
      ← All apps
    </Link>
  )
}
