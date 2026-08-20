import { AppGrid, AppSearch, useAppSearch } from '@/features/app-catalog'

import { homeApps } from './apps'

/**
 * `/` — the app catalog, this project's home screen.
 *
 * The page owns the data (`homeApps`) and the feature owns the presentation;
 * that split is why the same grid can back a second catalog later without
 * either one importing the other's array.
 */
export default function HomePage() {
  const { query, setQuery, results } = useAppSearch(homeApps)

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Apps</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything running in this stack, in one grid.
        </p>
      </header>

      <div className="mb-10">
        <AppSearch
          value={query}
          onValueChange={setQuery}
          resultCount={results.length}
        />
      </div>

      {/*
        An empty catalog is not the same thing as a search that missed, and
        the grid only knows how to say the latter ("No app matches ..."). Until
        the first app lands, the page answers for itself.
      */}
      {homeApps.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-16 text-center text-sm">
          No apps registered yet.
        </p>
      ) : (
        <AppGrid apps={results} query={query} />
      )}
    </main>
  )
}
