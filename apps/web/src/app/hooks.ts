import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from './store'

/**
 * The typed dispatch/selector pair. Components use these and never the raw
 * `useDispatch`/`useSelector`, which are untyped here and would give every
 * selector an `unknown` state argument.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
