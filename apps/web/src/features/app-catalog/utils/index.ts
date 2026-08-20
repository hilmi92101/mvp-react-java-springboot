import type { CatalogEntry } from '../types'

/**
 * Case-insensitive substring match over name, description, and keywords.
 *
 * Deliberately not fuzzy — the catalog is small enough that a fuzzy matcher
 * would add a dependency and surprise results for no gain.
 */
export function filterApps(apps: CatalogEntry[], query: string): CatalogEntry[] {
  const term = query.trim().toLowerCase()
  if (!term) return apps

  return apps.filter((app) =>
    [app.name, app.description, ...app.keywords].some((field) =>
      field.toLowerCase().includes(term),
    ),
  )
}
