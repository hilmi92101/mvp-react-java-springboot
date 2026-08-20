import { useMemo, useState } from 'react'

import type { CatalogEntry } from '../types'
import { filterApps } from '../utils'

/**
 * Owns the search box state and the filtered result.
 *
 * `useMemo` here is not premature: the identity of `results` feeds a list
 * render, and a catalog is a stable module-scope array, so both dependencies
 * are stable and the memo actually hits.
 *
 * The catalog is a required parameter, with no default: this feature owns the
 * grid, not the data, so each page passes its own array and no catalog
 * becomes the privileged one.
 */
export function useAppSearch(catalog: CatalogEntry[]) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterApps(catalog, query), [catalog, query])

  return { query, setQuery, results }
}
