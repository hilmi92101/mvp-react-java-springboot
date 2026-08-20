import { Link } from 'react-router'

import type { CatalogEntry } from '../types'

interface AppCardProps {
  app: CatalogEntry
}

/**
 * One home-screen tile: a rounded icon square with its label underneath.
 *
 * The description is deliberately not rendered — a phone grid reads as
 * icon-plus-name. It still reaches the user, as the `title` tooltip here and
 * as the subtitle on the app's own page.
 */
export function AppCard({ app }: AppCardProps) {
  const Icon = app.icon

  return (
    <Link
      to={app.path}
      title={app.description}
      className="group focus-visible:ring-ring flex flex-col items-center gap-2 rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
    >
      <span className="bg-secondary text-secondary-foreground border-border/60 group-hover:bg-accent flex size-16 items-center justify-center rounded-2xl border shadow-sm transition-[transform,background-color] duration-150 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:scale-95 motion-reduce:transform-none">
        <Icon aria-hidden className="size-7" />
      </span>

      <span className="text-foreground max-w-28 text-center text-xs leading-tight font-medium">
        {app.name}
      </span>
    </Link>
  )
}
