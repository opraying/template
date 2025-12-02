import { useSyncExternalStore } from 'react'

function getState() {
  return document.visibilityState
}

function getServerState() {
  return 'visible' as const
}

function subscribe(callback: () => void) {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

export function useVisibility() {
  const state = useSyncExternalStore(subscribe, getState, getServerState)

  return {
    state,
    hidden: state === 'hidden',
    visible: state === 'visible',
  }
}
