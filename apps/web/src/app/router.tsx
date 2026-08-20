import { BrowserRouter, Route, Routes } from 'react-router'

import HomePage from '@/pages/home'
import NotesPage from '@/pages/notes'

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
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes" element={<NotesPage />} />
      </Routes>
    </BrowserRouter>
  )
}
