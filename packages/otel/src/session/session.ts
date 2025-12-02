import { SESSION_INACTIVITY_TIMEOUT_MS } from '@xstack/otel/session/constants'
import { parseCookieToSessionState, renewCookieTimeout } from '@xstack/otel/session/cookie-session'
import * as Globals from '@xstack/otel/session/globals'
import {
  getSessionStateFromLocalStorage,
  setSessionStateToLocalStorage,
} from '@xstack/otel/session/local-storage-session'
import type { SessionState } from '@xstack/otel/session/types'
import { generateId } from '@xstack/otel/session/utils'

let cookieDomain: string

const createSessionState = (): SessionState => ({
  expiresAt: Date.now() + SESSION_INACTIVITY_TIMEOUT_MS,
  id: generateId(128),
  startTime: Date.now(),
})

export function getCurrentSessionState({ useLocalStorage = false, forceStoreRead = false }): SessionState | undefined {
  return useLocalStorage
    ? getSessionStateFromLocalStorage({ forceStoreRead })
    : parseCookieToSessionState({ forceStoreRead })
}

// This is called periodically and has two purposes:
// 1) Check if the cookie has been expired by the browser; if so, create a new one
// 2) If activity has occurred since the last periodic invocation, renew the cookie timeout
// (Only exported for testing purposes.)
export function updateSessionStatus({
  forceStore,
  useLocalStorage = false,
  forceActivity,
}: {
  forceActivity?: boolean
  forceStore: boolean
  useLocalStorage: boolean
}): void {
  let sessionState = getCurrentSessionState({ useLocalStorage, forceStoreRead: forceStore })
  let shouldForceWrite = false

  if (!sessionState) {
    // Check if another tab has created a new session
    sessionState = getCurrentSessionState({ useLocalStorage, forceStoreRead: true })
    if (!sessionState) {
      sessionState = createSessionState()
      Globals.setRecentActivity(true)
      shouldForceWrite = true
    }
  }

  if (sessionState.id !== Globals.rumSessionId) {
    Globals.setRumSessionId(sessionState.id)
    Globals.eventTarget.emit('session-changed', { sessionId: Globals.rumSessionId })
  }

  if (Globals.recentActivity || forceActivity) {
    sessionState.expiresAt = Date.now() + SESSION_INACTIVITY_TIMEOUT_MS
    if (useLocalStorage) {
      setSessionStateToLocalStorage(sessionState, { forceStoreWrite: shouldForceWrite || forceStore })
    } else {
      renewCookieTimeout(sessionState, cookieDomain, { forceStoreWrite: shouldForceWrite || forceStore })
    }
  }

  Globals.setRecentActivity(false)
}

const ACTIVITY_EVENTS = ['click', 'scroll', 'mousedown', 'keydown', 'touchend', 'visibilitychange']

export function initSessionTracking(domain?: string, useLocalStorage = true) {
  if (domain) {
    cookieDomain = domain
  }

  ACTIVITY_EVENTS.forEach((type) =>
    document.addEventListener(type, () => Globals.setRecentActivity(true), { capture: true, passive: true }),
  )

  updateSessionStatus({ useLocalStorage, forceStore: true })
}
