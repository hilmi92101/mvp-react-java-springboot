import type { CatalogEntry } from '../types'
import { AppCard } from './app-card'

interface AppGridProps {
  apps: CatalogEntry[]
  /** Echoed back in the empty state so the user sees what missed. */
  query: string
}

/**
 * Phone home-screen layout: fixed columns, generous row gap, tiles centred in
 * their cell. Column count steps up with width rather than the tile growing —
 * an icon that scales with the viewport stops reading as an icon.
 */
export function AppGrid({ apps, query }: AppGridProps) {
  if (apps.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border border-dashed px-6 py-16 text-center text-sm">
        No app matches “{query}”.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
      {apps.map((app) => (
        <li key={app.id} className="flex justify-center">
          <AppCard app={app} />
        </li>
      ))}
    </ul>
  )
}
