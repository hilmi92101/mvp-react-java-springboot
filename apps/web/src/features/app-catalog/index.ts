/**
 * Public API of the app-catalog feature — the searchable icon grid.
 *
 * Catalog-agnostic on purpose: it owns the shape, the search, and the layout,
 * but no data. The page passes its own array in, so no catalog becomes the
 * privileged one. Internals (the individual card, the filter helper) stay
 * unexported — see docs/architecture/folder-structure.md.
 */
export { AppGrid, AppSearch } from './components'
export { useAppSearch } from './hooks/use-app-search'
export type { CatalogEntry } from './types'
