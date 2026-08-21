import { Star } from 'lucide-react'

import type { CatalogEntry } from '../types'

import { filterApps } from './index'

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'place-finder',
    name: 'Place Finder',
    description: 'Search Google Places and star the ones you like',
    path: '/apps/place-finder',
    icon: Star,
    keywords: ['maps', 'autocomplete'],
    ...over,
  }
}

const apps = [
  entry(),
  entry({ id: 'notes', name: 'Notes', description: 'Jot things down', keywords: ['memo'] }),
]

describe('filterApps', () => {
  it('returns the whole list for a blank query', () => {
    expect(filterApps(apps, '')).toEqual(apps)
  })

  it('treats whitespace as blank rather than as a term', () => {
    // A space matches "Place Finder" as a substring, so trimming is the only
    // thing keeping "   " from filtering the list down to one row.
    expect(filterApps(apps, '   ')).toEqual(apps)
  })

  it('matches the name case-insensitively', () => {
    expect(filterApps(apps, 'NOTES').map((a) => a.id)).toEqual(['notes'])
  })

  it('matches the description', () => {
    expect(filterApps(apps, 'jot').map((a) => a.id)).toEqual(['notes'])
  })

  it('matches a keyword that is in neither the name nor the description', () => {
    expect(filterApps(apps, 'autocomplete').map((a) => a.id)).toEqual(['place-finder'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterApps(apps, 'zzz')).toEqual([])
  })

  it('does not mutate the input', () => {
    const before = [...apps]
    filterApps(apps, 'notes')
    expect(apps).toEqual(before)
  })
})
