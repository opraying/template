import { SESSION_DURATION_MS, SESSION_ID_LENGTH } from '@xstack/otel/session/constants'
import type { SessionState } from '@xstack/otel/session/types'

export const safelyGetLocalStorage = (key: string): string | null => {
  let value = null
  try {
    value = window.localStorage.getItem(key)
  } catch {
    // localStorage not accessible probably user is in incognito-mode
    // or set "Block third-party cookies" option in browser settings
  }
  return value
}

export const safelySetLocalStorage = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    // localStorage not accessible probably user is in incognito-mode
    // or set "Block third-party cookies" option in browser settings
    return false
  }
}

export const safelyRemoveFromLocalStorage = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // localStorage not accessible probably user is in incognito-mode
    // or set "Block third-party cookies" option in browser settings
  }
}

export const safelyGetSessionStorage = (key: string): string | null | undefined => {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return undefined
    // sessionStorage not accessible probably user is in incognito-mode
    // or set "Block third-party cookies" option in browser settings
  }
}

export const safelySetSessionStorage = (key: string, value: string): boolean => {
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    // sessionStorage not accessible probably user is in incognito-mode
    // or set "Block third-party cookies" option in browser settings
    return false
  }
}
export function isIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function generateId(bits: number): string {
  const xes = 'x'.repeat(bits / 4)
  return xes.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
}

export const isSessionState = (maybeSessionState: unknown): maybeSessionState is SessionState =>
  typeof maybeSessionState === 'object' &&
  maybeSessionState !== null &&
  'id' in maybeSessionState &&
  typeof maybeSessionState.id === 'string' &&
  maybeSessionState.id.length === SESSION_ID_LENGTH &&
  'startTime' in maybeSessionState &&
  typeof maybeSessionState.startTime === 'number'

export const isSessionDurationExceeded = (sessionState: SessionState): boolean => {
  const now = Date.now()
  return sessionState.startTime > now || now > sessionState.startTime + SESSION_DURATION_MS
}

export const isSessionInactivityTimeoutReached = (sessionState: SessionState): boolean => {
  if (sessionState.expiresAt === undefined) {
    return false
  }
  const now = Date.now()
  return now > sessionState.expiresAt
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number) {
  let lastExecutionTime = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  let visibilityListener: (() => void) | null
  let lastArgs: Parameters<T> | undefined

  const executeFunc = (...args: Parameters<T>) => {
    lastExecutionTime = performance.now()
    return func(...args)
  }

  const throttled = (...args: Parameters<T>) => {
    lastArgs = args

    if (visibilityListener) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityListener)
      }
      visibilityListener = null
    }

    const now = performance.now()
    const timeSinceLastExecution = now - lastExecutionTime

    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    if (timeSinceLastExecution >= limit || lastExecutionTime === 0) {
      executeFunc(...args)
    } else {
      timeout = setTimeout(() => {
        executeFunc(...args)
      }, limit - timeSinceLastExecution)

      visibilityListener = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          if (timeout !== null) {
            clearTimeout(timeout)
          }

          executeFunc(...args)
        }

        if (visibilityListener !== null && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', visibilityListener)
        }
      }
    }
  }

  throttled.flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    if (visibilityListener) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityListener)
      }
      visibilityListener = null
    }

    if (lastArgs) {
      executeFunc(...lastArgs)
    }
  }

  return throttled
}
