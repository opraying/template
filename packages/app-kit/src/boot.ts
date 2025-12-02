import { Atom } from '@xstack/atom-react'
import type * as Effect from 'effect/Effect'
import type * as Layer from 'effect/Layer'
import * as React from 'react'

export const useBoot = <A, E, R>(layer: Layer.Layer<R, never>, fn: Effect.Effect<A, E, R>) => {
  const runtime = React.useMemo(() => Atom.runtime(layer), [layer])

  const { initAtom } = React.useMemo(() => {
    const initAtom = runtime.atom(fn)
    return { initAtom }
  }, [runtime, fn])

  return { initAtom, runtime }
}
