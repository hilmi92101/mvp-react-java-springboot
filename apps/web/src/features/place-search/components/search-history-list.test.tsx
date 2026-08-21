import { renderWithProviders } from '@/test/render'

import type { PlaceSearchState } from '../stores/place-search-slice'
import { historyEntrySelected } from '../stores/place-search-slice'
import type { SearchHistoryEntry } from '../types'
import { SearchHistoryList } from './search-history-list'

vi.mock('../api/places-sdk', () => ({
  fetchSuggestions: vi.fn(),
  fetchPlaceDetails: vi.fn(),
  resetSession: vi.fn(),
}))

function entry(placeId: string, name: string, searchedAt: number): SearchHistoryEntry {
  return {
    placeId,
    name,
    formattedAddress: `${name}, Malaysia`,
    lat: 3.1,
    lng: 101.6,
    searchedAt,
    query: name.slice(0, 3).toLowerCase(),
  }
}

const history = [
  entry('p2', 'Kuantan', Date.UTC(2026, 7, 21, 10, 30)),
  entry('p1', 'Kuala Lumpur', Date.UTC(2026, 7, 21, 10, 0)),
]

function render(placeSearch: Partial<PlaceSearchState> = {}) {
  return renderWithProviders(<SearchHistoryList />, { preloadedState: { placeSearch } })
}

describe('SearchHistoryList', () => {
  it('explains itself when there is no history yet', () => {
    const { getByText, queryByRole } = render()

    expect(getByText('Searches you make will be listed here.')).toBeInTheDocument()
    expect(queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders the entries in the order the slice holds them', () => {
    const { getAllByRole } = render({ history })

    expect(getAllByRole('button').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Kuantan'),
      expect.stringContaining('Kuala Lumpur'),
    ])
  })

  it('puts a clicked row back on the map', async () => {
    const { getAllByRole, dispatched, user } = render({ history })

    await user.click(getAllByRole('button')[1])

    expect(dispatched).toContainEqual(historyEntrySelected('p1'))
  })

  // aria-current is the only signal a screen reader gets for "this one is on
  // the map" -- the rest of it is a background colour.
  it('marks the row that is currently selected', () => {
    const { getAllByRole } = render({
      history,
      selected: { placeId: 'p1', name: 'Kuala Lumpur', formattedAddress: '', lat: 3.1, lng: 101.6 },
    })

    const [first, second] = getAllByRole('button')
    expect(first).not.toHaveAttribute('aria-current')
    expect(second).toHaveAttribute('aria-current', 'true')
  })

  it('gives each row a machine-readable timestamp', () => {
    const { getAllByRole } = render({ history })

    expect(getAllByRole('listitem')[0].querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(history[0].searchedAt).toISOString(),
    )
  })
})
