import { renderWithProviders } from '@/test/render'

import { AppSearch } from './app-search'

describe('AppSearch', () => {
  it('reports every keystroke to the parent', async () => {
    const onValueChange = vi.fn()
    const { getByRole, user } = renderWithProviders(
      <AppSearch value="" onValueChange={onValueChange} resultCount={3} />,
    )

    await user.type(getByRole('searchbox', { name: 'Search apps' }), 'map')

    // Controlled and never re-rendered with a new `value`, so each keystroke
    // reports a single character -- which is exactly the contract: the box
    // owns nothing, the caller owns the string.
    expect(onValueChange.mock.calls.flat()).toEqual(['m', 'a', 'p'])
  })

  it('shows the caller-supplied value', () => {
    const { getByRole } = renderWithProviders(
      <AppSearch value="notes" onValueChange={vi.fn()} resultCount={1} />,
    )

    expect(getByRole('searchbox', { name: 'Search apps' })).toHaveValue('notes')
  })

  it('announces the result count politely', () => {
    const { getByText } = renderWithProviders(
      <AppSearch value="" onValueChange={vi.fn()} resultCount={7} />,
    )

    expect(getByText('7 apps found')).toHaveAttribute('aria-live', 'polite')
  })
})
