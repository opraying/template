import { useCallback, useEffect, useRef, useState } from 'react'

// Options for the useSequencedStatus hook
interface UseSequencedStatusOptions<T> {
  /** The minimum time each status should be displayed, in milliseconds. Defaults to 500ms. */
  minDisplayTimeMs?: number
  /** A list of statuses that should transition immediately, ignoring minDisplayTimeMs. */
  immediateTransitions?: T[]
}

/**
 * Custom hook that manages a displayed status, ensuring each status (unless immediate)
 * is displayed for a minimum duration before transitioning to the next actual status.
 * This prevents rapid UI flickering caused by quick status changes.
 *
 * @template T The type of the status value.
 * @param {T} status The current actual status.
 * @param {UseSequencedStatusOptions<T>} [options] Configuration options.
 * @param {number} [options.minDisplayTimeMs=500] Minimum display time in milliseconds.
 * @param {T[]} [options.immediateTransitions=[]] Statuses that should transition immediately.
 * @returns {T} The status value that should be displayed in the UI.
 */
export function useSequencedStatus<T>(status: T, options?: UseSequencedStatusOptions<T>): T {
  const { minDisplayTimeMs = 500, immediateTransitions = [] } = options ?? {}

  // State to hold the status that is currently being displayed, initialized with the incoming status
  const [displayedStatus, setDisplayedStatus] = useState<T>(status)
  // Ref to store the timestamp when the current displayedStatus started showing, initialized on mount
  const statusStartTimeRef = useRef<number>(Date.now())
  // Ref to store the timeout ID, used to clear the timeout on cleanup or status change
  const timerRef = useRef<number | null>(null)
  // Ref to store the status that initiated the timer, to ensure correct update
  const pendingStatusRef = useRef<T | null>(null)

  // Cleanup function to clear any existing timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      pendingStatusRef.current = null
    }
  }, [])

  useEffect(() => {
    // If the incoming status is the same as the currently displayed one, do nothing.
    // This also handles the initial render case correctly.
    if (status === displayedStatus) {
      // If a timer was pending for this status, clear it as it's now current.
      if (pendingStatusRef.current === status) {
        clearTimer()
      }
      return
    }

    // If the incoming status is the same as the one already pending in the timer, do nothing.
    if (status === pendingStatusRef.current) {
      return
    }

    // --- Immediate Transition Check ---
    if (immediateTransitions.includes(status)) {
      clearTimer() // Clear any pending timer
      setDisplayedStatus(status)
      statusStartTimeRef.current = Date.now()
      return // Transition immediately
    }
    // --- End Immediate Transition Check ---

    // Clear any existing timer before processing the new status delay.
    // Necessary if a non-immediate status change interrupts a pending timer for another status.
    clearTimer()

    const now = Date.now()
    const elapsedTime = now - statusStartTimeRef.current

    // Check if the minimum display time for the current displayedStatus has passed.
    if (elapsedTime >= minDisplayTimeMs) {
      // If enough time has passed, update displayedStatus immediately.
      setDisplayedStatus(status)
      statusStartTimeRef.current = now
    } else {
      // If not enough time has passed, calculate the remaining time.
      const remainingTime = minDisplayTimeMs - elapsedTime
      pendingStatusRef.current = status // Mark the status as pending

      // Set a timer to update the displayedStatus after the remaining time.
      timerRef.current = setTimeout(() => {
        // Ensure the status we are setting is the one that initiated this timer
        if (pendingStatusRef.current === status) {
          setDisplayedStatus(status)
          statusStartTimeRef.current = Date.now()
          timerRef.current = null // Clear timer ref after execution
          pendingStatusRef.current = null // Clear pending status
        }
      }, remainingTime) as any as number
    }

    // Cleanup function for the effect: clear the timer if the component unmounts
    // or if the status prop changes again before the timer fires.
    return clearTimer
  }, [status, displayedStatus, minDisplayTimeMs, clearTimer, immediateTransitions])

  return displayedStatus
}
