import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface AppSearchProps {
  value: string
  onValueChange: (value: string) => void
  /** Announced count, so screen readers hear the grid shrink. */
  resultCount: number
}

export function AppSearch({
  value,
  onValueChange,
  resultCount,
}: AppSearchProps) {
  return (
    <div className="w-full">
      <label htmlFor="app-search" className="sr-only">
        Search apps
      </label>

      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id="app-search"
          type="search"
          autoComplete="off"
          placeholder="Search apps…"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-11 pl-9"
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {resultCount} apps found
      </p>
    </div>
  )
}
