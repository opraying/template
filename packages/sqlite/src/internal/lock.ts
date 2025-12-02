import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'

const getIsDesktop = () => {
  // @ts-ignore
  const val = globalThis.isDesktop || (typeof window !== 'undefined' && '__TAURI__' in window)

  return val
}

export const getForDeferredLock = (deferred: Deferred.Deferred<void>, lockName: string) =>
  Effect.async<Lock | undefined>((cb) => {
    if (getIsDesktop()) {
      cb(
        Effect.succeed({
          name: lockName,
          mode: 'exclusive',
        }),
      )
      return
    }

    navigator.locks
      .request(lockName, { mode: 'exclusive', ifAvailable: true }, async (_lock) => {
        cb(_lock ? Effect.succeed(_lock) : Effect.succeed(undefined))

        if (_lock) {
          await Effect.runPromise(Deferred.await(deferred))
        }
      })
      .catch((e) => {
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            // ignore
            return
          }

          console.error(e)
        }
      })
  })

export const waitForDeferredLock = (deferred: Deferred.Deferred<void>, lockName: string) =>
  Effect.async<Lock | undefined>((cb, signal) => {
    if (getIsDesktop()) {
      cb(
        Effect.succeed({
          name: lockName,
          mode: 'exclusive',
        }),
      )
      return
    }

    navigator.locks
      .request(lockName, { signal, mode: 'exclusive', ifAvailable: false }, async (_lock) => {
        cb(_lock ? Effect.succeed(_lock) : Effect.succeed(undefined))

        await Effect.runPromise(Deferred.await(deferred))
      })
      .catch((error) => {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            // ignore
            return
          }

          console.error(error)
        }
      })
  })
