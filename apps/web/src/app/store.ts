import { configureStore } from '@reduxjs/toolkit'
import createSagaMiddleware from 'redux-saga'
import { all } from 'redux-saga/effects'

import { placeSearchReducer, placeSearchSaga } from '@/features/place-search'

/**
* The single app store.
*
* Saga is *added* to the default middleware rather than replacing it: thunk
* and the dev-only immutability/serializability checks stay on. Those checks
* are why nothing google.maps-shaped is ever put in a slice — a `Place` or a
* `LatLng` instance would trip them, and the feature stores plain records.
*/
const sagaMiddleware = createSagaMiddleware()

/**
* Every long-running watcher in the app. One entry today; `all` is here so the
* second feature is a one-line change rather than a restructure.
*/
function* rootSaga() {
  yield all([placeSearchSaga()])
}

export const store = configureStore({
  reducer: {
    placeSearch: placeSearchReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
})

// After configureStore, never before: the middleware needs its store hook
// installed or the first `put` has nowhere to go.
sagaMiddleware.run(rootSaga)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
