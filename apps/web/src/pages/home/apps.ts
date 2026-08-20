import { MapPin } from 'lucide-react'

import type { CatalogEntry } from '@/features/app-catalog'

/**
 * The catalog `/` renders.
 *
 * Adding an entry here is half the job: the `path` must also get a route in
 * `src/app/router.tsx`, or the tile links to a 404.
 */
export const homeApps: CatalogEntry[] = [
  {
    id: 'place-finder',
    name: 'Place Finder',
    description: 'Autocomplete a place from Google, map it, star it.',
    path: '/apps/place-finder',
    icon: MapPin,
    // Terms a person would search for that are in neither the name nor the
    // description -- `useAppSearch` matches all three fields.
    keywords: ['google', 'maps', 'places', 'autocomplete', 'location'],
  },
]
