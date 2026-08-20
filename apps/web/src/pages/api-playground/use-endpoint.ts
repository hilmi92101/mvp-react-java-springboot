import { useCallback, useState } from 'react'

import type { CallResult } from '@/api'

/**
 * What a card knows about the last time it ran.
 *
 * `note` is the one field the transport cannot fill in: the rollback card
 * needs to say "the count did not move", and that sentence is only meaningful
 * to the card that ran the two calls.
 */
export type Attempt = {
  result: CallResult<unknown>
  note?: string
}

export type EndpointState = {
  running: boolean
  attempt: Attempt | null
  run: () => void
}

/**
 * Fires one card's call and records what came back.
 *
 * Two things this deliberately does not do. It does not throw -- `call()`
 * already turns every failure into a result, and a card that shows a 502 is
 * doing its job, not erroring. And it does not cache: the page exists to make
 * calls that appear in the log file, so a cached answer would be a lie about
 * what just happened.
 */
export function useEndpoint(
  fire: () => Promise<Attempt>,
): EndpointState {
  const [running, setRunning] = useState(false)
  const [attempt, setAttempt] = useState<Attempt | null>(null)

  const run = useCallback(() => {
    setRunning(true)
    // No cleanup/abort on unmount. The page is one screen with no navigation
    // inside it, and an AbortController here would add a lifecycle to reason
    // about for a case that cannot happen.
    fire()
      .then(setAttempt)
      .finally(() => setRunning(false))
  }, [fire])

  return { running, attempt, run }
}
