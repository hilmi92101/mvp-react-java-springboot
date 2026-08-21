import { act, renderHook } from '@testing-library/react'
import { NotebookPen } from 'lucide-react'

import type { CatalogEntry } from '../types'
import { useAppSearch } from './use-app-search'

function entry(id: string, keywords: string[] = []): CatalogEntry {
  return {
    id,
    name: id,
    description: `${id} description`,
    path: `/apps/${id}`,
    icon: NotebookPen,
    keywords,
  }
}

const catalog: CatalogEntry[] = [
  entry('notes', ['todo']),
  entry('place-finder', ['map']),
  entry('api-playground'),
]

describe('useAppSearch', () => {
  it('starts with an empty query and the whole catalog', () => {
    const { result } = renderHook(() => useAppSearch(catalog))

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual(catalog)
  })

  it('narrows the results as the query changes', () => {
    const { result } = renderHook(() => useAppSearch(catalog))

    act(() => result.current.setQuery('map'))

    expect(result.current.query).toBe('map')
    expect(result.current.results.map((app) => app.id)).toEqual(['place-finder'])
  })

  it('returns everything again when the query is cleared', () => {
    const { result } = renderHook(() => useAppSearch(catalog))

    act(() => result.current.setQuery('map'))
    act(() => result.current.setQuery(''))

    expect(result.current.results).toEqual(catalog)
  })

  // The memo is the reason `results` can go straight into a dependency array.
  it('keeps the same results identity across an unrelated re-render', () => {
    const { result, rerender } = renderHook(() => useAppSearch(catalog))
    const first = result.current.results

    rerender()

    expect(result.current.results).toBe(first)
  })

  it('gives each caller its own query state', () => {
    const a = renderHook(() => useAppSearch(catalog))
    const b = renderHook(() => useAppSearch(catalog))

    act(() => a.result.current.setQuery('notes'))

    expect(b.result.current.query).toBe('')
  })
})
