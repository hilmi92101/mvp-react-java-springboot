import { renderWithProviders } from '@/test/render'

import * as placesSdk from '../api/places-sdk'
import type { PlaceSearchState } from '../stores/place-search-slice'
import {
  placeSelected,
  queryChanged,
  searchCleared,
} from '../stores/place-search-slice'
import type { PlaceSuggestion } from '../types'
import { PlaceAutocompleteInput } from './place-autocomplete-input'

/**
 * The Google SDK is stubbed, not loaded — Question 4. Nothing in this file
 * should reach it: the render helper does not run the saga, and the saga is
 * the only caller. The `expect(...).not.toHaveBeenCalled()` at the end of the
 * typing test is what keeps that true if someone later wires a fetch into the
 * component.
 */
vi.mock('../api/places-sdk', () => ({
  fetchSuggestions: vi.fn().mockResolvedValue([]),
  fetchPlaceDetails: vi.fn(),
  resetSession: vi.fn(),
}))

function suggestion(placeId: string, mainText: string): PlaceSuggestion {
  return { placeId, mainText, secondaryText: 'Malaysia', matches: [] }
}

const suggestions = [
  suggestion('p1', 'Kuala Lumpur'),
  suggestion('p2', 'Kuantan'),
  suggestion('p3', 'Kuching'),
]

const ready = { query: 'ku', suggestions, status: 'ready' as const }

function render(placeSearch: Partial<PlaceSearchState> = {}) {
  return renderWithProviders(<PlaceAutocompleteInput />, {
    preloadedState: { placeSearch },
  })
}

describe('PlaceAutocompleteInput', () => {
  it('dispatches queryChanged for each keystroke and calls no SDK', async () => {
    const { getByRole, dispatched, user } = render()

    await user.type(getByRole('combobox', { name: 'Search for a place' }), 'kul')

    expect(
      dispatched.filter((action) => action.type === queryChanged.type),
    ).toEqual([queryChanged('k'), queryChanged('ku'), queryChanged('kul')])
    expect(placesSdk.fetchSuggestions).not.toHaveBeenCalled()
  })

  it('keeps the dropdown closed while the box is untouched', () => {
    const { queryByRole } = render()

    expect(queryByRole('listbox')).not.toBeInTheDocument()
    expect(queryByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
  })

  it('lists one option per suggestion, with its secondary line', () => {
    const { getAllByRole, getByText } = render(ready)

    expect(getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Kuala LumpurMalaysia',
      'KuantanMalaysia',
      'KuchingMalaysia',
    ])
    expect(getByText('Kuala Lumpur')).toBeInTheDocument()
  })

  it('dispatches placeSelected with the row label when a row is clicked', async () => {
    const { getAllByRole, dispatched, user } = render(ready)

    await user.click(getAllByRole('option')[1])

    expect(dispatched).toContainEqual(
      placeSelected({ placeId: 'p2', label: 'Kuantan' }),
    )
  })

  it('walks the list with the arrow keys and picks with Enter', async () => {
    const { getByRole, dispatched, user } = render(ready)

    const input = getByRole('combobox', { name: 'Search for a place' })
    input.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(dispatched).toContainEqual(
      placeSelected({ placeId: 'p2', label: 'Kuantan' }),
    )
  })

  // -1 is "no row highlighted", and Enter on it must not pick the first row.
  it('ignores Enter while nothing is highlighted', async () => {
    const { getByRole, dispatched, user } = render(ready)

    getByRole('combobox', { name: 'Search for a place' }).focus()
    await user.keyboard('{Enter}')

    expect(dispatched.some((action) => action.type === placeSelected.type)).toBe(false)
  })

  it('wraps upwards from nothing highlighted to the last row', async () => {
    const { getByRole, getAllByRole, user } = render(ready)

    getByRole('combobox', { name: 'Search for a place' }).focus()
    await user.keyboard('{ArrowUp}')

    expect(getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('closes the dropdown on Escape without touching the query', async () => {
    const { getByRole, queryByRole, dispatched, user } = render(ready)

    getByRole('combobox', { name: 'Search for a place' }).focus()
    await user.keyboard('{Escape}')

    expect(queryByRole('listbox')).not.toBeInTheDocument()
    // Only the hook's mount-time favourites load, which every render does.
    expect(dispatched.map((action) => action.type)).toEqual([
      'placeSearch/favouritesRequested',
    ])
  })

  it('closes the dropdown on a pointer down outside it', async () => {
    const { queryByRole, user } = render(ready)

    await user.click(document.body)

    expect(queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('clears the search from the × button', async () => {
    const { getByRole, dispatched, user } = render(ready)

    await user.click(getByRole('button', { name: 'Clear search' }))

    expect(dispatched).toContainEqual(searchCleared())
  })

  it('shows a spinner instead of the × while loading', () => {
    const { queryByRole } = render({ query: 'ku', status: 'loading' })

    expect(queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('shows the error sentence and re-runs the search from Retry', async () => {
    const { getByText, getByRole, dispatched, user } = render({
      query: 'ku',
      status: 'error',
      error: 'Google Places is unavailable.',
    })

    expect(getByText('Google Places is unavailable.')).toBeInTheDocument()

    await user.click(getByRole('button', { name: 'Retry' }))

    expect(dispatched).toContainEqual(queryChanged('ku'))
  })

  it('says so when a finished search found nothing', () => {
    const { getByText, queryByRole } = render({
      query: 'zzzzz',
      status: 'ready',
      suggestions: [],
    })

    expect(getByText('No places found for “zzzzz”')).toBeInTheDocument()
    expect(queryByRole('listbox')).not.toBeInTheDocument()
  })

  // The bolding is the only reason `matches` is carried through the slice.
  it('bolds the matched range of a row', () => {
    const { getByRole } = render({
      query: 'kua',
      status: 'ready',
      suggestions: [
        { ...suggestion('p1', 'Kuala Lumpur'), matches: [{ startOffset: 0, endOffset: 3 }] },
      ],
    })

    const mark = getByRole('option').querySelector('mark')
    expect(mark).toHaveTextContent('Kua')
  })
})
