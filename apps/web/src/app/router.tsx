import { BrowserRouter, Route, Routes } from 'react-router'

import { StoreProvider } from '@/app/store-provider'
import HomePage from '@/pages/home'
import NotesPage from '@/pages/notes'
import PlaceFinderPage from '@/pages/place-finder'

/**
 * Route table for the whole app.
 *
 * `/` is the app catalog. The notes demo that used to be the root component
 * keeps a home at `/notes` — it is deliberately absent from the catalog until
 * the catalog is meant to list things.
 *
 * The declarative `<Routes>` API is used rather than a data router because
 * nothing here needs loaders yet; switch to `createBrowserRouter` when a route
 * wants to fetch before it renders.
 *
 * `<StoreProvider>` sits here rather than in `main.tsx` so the entry point
 * stays a two-liner and there is one file to read for "what wraps the app".
 * Apps live under `/apps/<id>`, which is the path `CatalogEntry` documents --
 * a tile on `/` and its route have to agree or the tile links to a 404.
 */
export function AppRouter() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/apps/place-finder" element={<PlaceFinderPage />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
