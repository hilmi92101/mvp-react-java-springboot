import { Map, NotebookPen, Plug } from 'lucide-react'

import { renderWithProviders } from '@/test/render'

import type { CatalogEntry } from '../types'
import { AppGrid } from './app-grid'

function entry(id: string, name = id): CatalogEntry {
  return {
    id,
    name,
    description: `${name} description`,
    path: `/apps/${id}`,
    icon: NotebookPen,
    keywords: [],
  }
}

const catalog: CatalogEntry[] = [
  entry('notes', 'Notes'),
  { ...entry('place-finder', 'Place Finder'), icon: Map },
  { ...entry('api-playground', 'API Playground'), icon: Plug },
]

describe('AppGrid', () => {
  it('renders one tile per entry', () => {
    const { getAllByRole } = renderWithProviders(<AppGrid apps={catalog} query="" />)

    expect(getAllByRole('listitem')).toHaveLength(3)
    expect(getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Notes',
      'Place Finder',
      'API Playground',
    ])
  })

  it('links each tile at its own path', () => {
    const { getByRole } = renderWithProviders(<AppGrid apps={catalog} query="" />)

    expect(getByRole('link', { name: 'Place Finder' })).toHaveAttribute(
      'href',
      '/apps/place-finder',
    )
  })

  // The description is on purpose only a tooltip -- a phone grid reads as
  // icon-plus-name -- so this pins the decision rather than the markup.
  it('keeps the description out of the visible label', () => {
    const { getByRole, queryByText } = renderWithProviders(<AppGrid apps={catalog} query="" />)

    expect(getByRole('link', { name: 'Notes' })).toHaveAttribute('title', 'Notes description')
    expect(queryByText('Notes description')).not.toBeInTheDocument()
  })

  it('shows the empty state, echoing the query, when nothing matches', () => {
    const { getByText, queryAllByRole } = renderWithProviders(<AppGrid apps={[]} query="zzz" />)

    expect(getByText('No app matches “zzz”.')).toBeInTheDocument()
    expect(queryAllByRole('link')).toHaveLength(0)
  })
})
