import type { CatalogEntry } from '@/features/app-catalog'

/**
 * The catalog `/` renders. Empty on purpose — the grid, the search, and the
 * empty state are wired and shippable before any app exists.
 *
 * Adding an entry here is half the job: the `path` must also get a route in
 * `src/app/router.tsx`, or the tile links to a 404.
 */
export const homeApps: CatalogEntry[] = []
