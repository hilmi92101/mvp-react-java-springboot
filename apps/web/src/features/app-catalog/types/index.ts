import type { LucideIcon } from 'lucide-react'

/**
 * One tile in an app grid — the shape a page fills in.
 *
 * A catalog of these is meant to be the single source of truth for both the
 * grid and the router: the route table maps over the same array the grid
 * renders, so an app cannot appear in the list without a route, or the reverse.
 */
export interface CatalogEntry {
  /** Stable slug. Also the React key and the last segment of `path`. */
  id: string
  name: string
  /** One line, shown under the name on the card. */
  description: string
  /** Absolute route path — `/apps/<id>` for the app grid. */
  path: string
  icon: LucideIcon
  /** Extra search terms that are not in the name or description. */
  keywords: string[]
}
