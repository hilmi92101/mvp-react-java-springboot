import { configureStore } from '@reduxjs/toolkit'
import type { RenderOptions, RenderResult } from '@testing-library/react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import type { Middleware, UnknownAction } from 'redux'

import { placeSearchReducer } from '@/features/place-search'
import type { PlaceSearchState } from '@/features/place-search/stores/place-search-slice'

/**
 * The one way a component test gets a store.
 *
 * A *fresh* store per call, never the singleton from `app/store.ts`: that one
 * is module state, so two tests importing it would share a query, a history
 * and a favourites list, and the second test's failure would depend on the
 * first test's order.
 *
 * The saga is deliberately not wired in. A component test asserts what the
 * component *dispatches*; running the watchers on top of that would drag the
 * Google SDK and `fetch` into every render, and the saga already has its own
 * tests in `place-search-saga.test.ts`.
 */

/** Every slice's state, all optional — pass only what the test cares about. */
export interface PreloadedState {
  placeSearch?: Partial<PlaceSearchState>
}

const initialPlaceSearch = placeSearchReducer(undefined, { type: '@@INIT' } as UnknownAction)

export function makeStore(preloaded: PreloadedState = {}, recorded: UnknownAction[] = []) {
  // Records what components dispatch, which is the whole assertion in most
  // component tests. A spy on `store.dispatch` would miss anything a
  // middleware forwards, and Redux has no built-in action log.
  const recorder: Middleware = () => (next) => (action) => {
    recorded.push(action as UnknownAction)
    return next(action)
  }

  return configureStore({
    reducer: { placeSearch: placeSearchReducer },
    preloadedState: {
      placeSearch: { ...initialPlaceSearch, ...preloaded.placeSearch },
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(recorder),
  })
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState
  /** Initial URL. `<Link>` throws outside a router, and `AppCard` renders one. */
  route?: string
}

export interface RenderWithProvidersResult extends RenderResult {
  store: ReturnType<typeof makeStore>
  /** Every action that reached the reducer, in order. */
  dispatched: UnknownAction[]
  /** Pre-bound so no test has to remember `userEvent.setup()`. */
  user: ReturnType<typeof userEvent.setup>
}

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, route = '/', ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const dispatched: UnknownAction[] = []
  const store = makeStore(preloadedState, dispatched)

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    store,
    dispatched,
    user: userEvent.setup(),
  }
}

/** Actions of one type, newest last — the usual shape of a dispatch assertion. */
export function actionsOfType(dispatched: UnknownAction[], type: string): UnknownAction[] {
  return dispatched.filter((action) => action.type === type)
}
