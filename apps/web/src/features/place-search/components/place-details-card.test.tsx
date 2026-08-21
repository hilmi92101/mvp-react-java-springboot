import { renderWithProviders } from '@/test/render'

import type { PlaceSearchState } from '../stores/place-search-slice'
import { favouriteToggled } from '../stores/place-search-slice'
import type { SelectedPlace } from '../types'
import { PlaceDetailsCard } from './place-details-card'

vi.mock('../api/places-sdk', () => ({
  fetchSuggestions: vi.fn(),
  fetchPlaceDetails: vi.fn(),
  resetSession: vi.fn(),
}))

const klcc: SelectedPlace = {
  placeId: 'p1',
  name: 'Petronas Twin Towers',
  formattedAddress: 'Kuala Lumpur City Centre, 50088 Kuala Lumpur',
  lat: 3.1578,
  lng: 101.7117,
}

function render(placeSearch: Partial<PlaceSearchState> = {}) {
  return renderWithProviders(<PlaceDetailsCard />, { preloadedState: { placeSearch } })
}

describe('PlaceDetailsCard', () => {
  it('prompts for a search when nothing is selected', () => {
    const { getByText, queryByRole } = render()

    expect(getByText('Search for a place to see its details here.')).toBeInTheDocument()
    expect(queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the loading line while details are pending', () => {
    const { getByText } = render({ detailsPending: true, selected: klcc })

    expect(getByText('Loading place…')).toBeInTheDocument()
  })

  // Pending wins over error, and error wins over the place: the three states
  // are mutually exclusive in the reducer, and this pins the order anyway.
  it('shows the details error instead of the card', () => {
    const { getByText, queryByText } = render({
      selected: klcc,
      detailsError: 'Google returned no coordinates for that place.',
    })

    expect(getByText('Google returned no coordinates for that place.')).toBeInTheDocument()
    expect(queryByText('Petronas Twin Towers')).not.toBeInTheDocument()
  })

  it('renders the name, the address and the coordinates to five places', () => {
    const { getByRole, getByText } = render({ selected: klcc })

    expect(getByRole('heading', { level: 2 })).toHaveTextContent('Petronas Twin Towers')
    expect(getByText('Kuala Lumpur City Centre, 50088 Kuala Lumpur')).toBeInTheDocument()
    expect(getByText('3.15780, 101.71170')).toBeInTheDocument()
  })

  it('offers to save an unstarred place, and dispatches favouriteToggled', async () => {
    const { getByRole, dispatched, user } = render({ selected: klcc })

    const star = getByRole('button', { name: 'Save to favourites' })
    expect(star).toHaveAttribute('aria-pressed', 'false')

    await user.click(star)

    expect(dispatched).toContainEqual(favouriteToggled(klcc))
  })

  // The label says what the click will do, not what the state is.
  it('offers to remove a starred place', async () => {
    const { getByRole, dispatched, user } = render({
      selected: klcc,
      favourites: [klcc],
      favouritesLoaded: true,
    })

    const star = getByRole('button', { name: 'Remove from favourites' })
    expect(star).toHaveAttribute('aria-pressed', 'true')

    await user.click(star)

    expect(dispatched).toContainEqual(favouriteToggled(klcc))
  })

  it('shows the favourite error line under the card', () => {
    const { getByText } = render({
      selected: klcc,
      favouriteError: 'Could not save that place.',
    })

    expect(getByText('Could not save that place.')).toBeInTheDocument()
    // The card itself stays -- the star reverted, the place did not vanish.
    expect(getByText('Petronas Twin Towers')).toBeInTheDocument()
  })
})
