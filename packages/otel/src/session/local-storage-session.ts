import { SESSION_STORAGE_KEY } from '@xstack/otel/session/constants'
import type { SessionState } from '@xstack/otel/session/types'
import {
  isSessionDurationExceeded,
  isSessionInactivityTimeoutReached,
  isSessionState,
  safelyGetLocalStorage,
  safelyRemoveFromLocalStorage,
  safelySetLocalStorage,
  throttle,
} from '@xstack/otel/session/utils'

export const localStore = {
  cachedValue: undefined as any,
  set: (value: string) => {
    localStore.cachedValue = value
    localStore._set(value)
  },

  flush: () => {
    localStore._set.flush()
  },

  _set: throttle((value: string) => {
    safelySetLocalStorage(SESSION_STORAGE_KEY, value)
  }, 1000),

  get: ({ forceStoreRead }: { forceStoreRead: boolean }): string => {
    if (localStore.cachedValue === undefined || forceStoreRead) {
      localStore.cachedValue = safelyGetLocalStorage(SESSION_STORAGE_KEY)
      return localStore.cachedValue
    }

    return localStore.cachedValue
  },
  remove: () => {
    safelyRemoveFromLocalStorage(SESSION_STORAGE_KEY)
    localStore.cachedValue = undefined
  },
}

export const getSessionStateFromLocalStorage = ({
  forceStoreRead,
}: {
  forceStoreRead: boolean
}): SessionState | undefined => {
  let sessionState: unknown
  try {
    sessionState = JSON.parse(localStore.get({ forceStoreRead }))
  } catch {
    return undefined
  }

  if (!isSessionState(sessionState)) {
    return
  }

  if (isSessionDurationExceeded(sessionState) || isSessionInactivityTimeoutReached(sessionState)) {
    return
  }

  return sessionState
}

export const setSessionStateToLocalStorage = (
  sessionState: SessionState,
  { forceStoreWrite }: { forceStoreWrite: boolean },
): void => {
  if (isSessionDurationExceeded(sessionState)) {
    return
  }

  localStore.set(JSON.stringify(sessionState))
  if (forceStoreWrite) {
    localStore.flush()
  }
}

export const clearSessionStateFromLocalStorage = (): void => {
  localStore.remove()
}
