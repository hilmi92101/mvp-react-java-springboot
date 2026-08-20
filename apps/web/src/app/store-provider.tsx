import type { ReactNode } from 'react'
import { Provider } from 'react-redux'

import { store } from './store'

/**
 * Wraps the app in the Redux store.
 *
 * A separate file, not two extra lines in `router.tsx`, so that the store
 * import stays out of the route table — the router is the one file every
 * feature ends up touching, and it should keep reading as a list of routes.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>
}
