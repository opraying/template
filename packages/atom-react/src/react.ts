import * as Registry from '@effect-atom/atom/Registry'
import * as Result from '@effect-atom/atom/Result'
import * as Atom from '@effect-atom/atom/Atom'
import * as AtomRef from '@effect-atom/atom/AtomRef'
import { identity } from 'effect/Function'
import * as Cause from 'effect/Cause'
import * as Exit from 'effect/Exit'
import * as Effect from 'effect/Effect'
import type { SetStateAction } from 'react'
import React, { useMemo, useRef, useState } from 'react'
import { globalValue } from 'effect/GlobalValue'
// @ts-ignore
import * as Scheduler from 'scheduler'

function scheduleTask(f: () => void): void {
  Scheduler.unstable_scheduleCallback(Scheduler.unstable_LowPriority, f)
}

export const defaultRegistry = globalValue('@effect-atom/atom-react/defaultRegistry', () =>
  Registry.make({
    scheduleTask,
    defaultIdleTTL: 400,
  }),
)

/**
 * @since 1.0.0
 * @category context
 */
export const RegistryContext = React.createContext<Registry.Registry>(defaultRegistry)

interface AtomStore<A> {
  readonly subscribe: (f: () => void) => () => void
  readonly snapshot: () => A
  readonly getServerSnapshot: () => A
}

const storeRegistry = globalValue(
  '@effect-atom/atom-react/storeRegistry',
  () => new WeakMap<Registry.Registry, WeakMap<Atom.Atom<any>, AtomStore<any>>>(),
)

export function makeStore<A>(registry: Registry.Registry, atom: Atom.Atom<A>): AtomStore<A> {
  let stores = storeRegistry.get(registry)
  if (stores === undefined) {
    stores = new WeakMap()
    storeRegistry.set(registry, stores)
  }
  const store = stores.get(atom)
  if (store !== undefined) {
    return store
  }
  const newStore: AtomStore<A> = {
    subscribe(f) {
      return registry.subscribe(atom, f)
    },
    snapshot() {
      return registry.get(atom)
    },
    getServerSnapshot() {
      return Atom.getServerValue(atom, registry)
    },
  }
  stores.set(atom, newStore)
  return newStore
}

export function useStore<A>(registry: Registry.Registry, atom: Atom.Atom<A>): A {
  const store = makeStore(registry, atom)

  return React.useSyncExternalStore(store.subscribe, store.snapshot, store.getServerSnapshot)
}

const initialValuesSet = globalValue(
  '@effect-atom/atom-react/initialValuesSet',
  () => new WeakMap<Registry.Registry, WeakSet<Atom.Atom<any>>>(),
)

export const ensureAtomInitialValues = (
  registry: Registry.Registry,
  initialValues: Iterable<readonly [Atom.Atom<any>, any]>,
) => {
  let set = initialValuesSet.get(registry)
  if (set === undefined) {
    set = new WeakSet()
    initialValuesSet.set(registry, set)
  }
  for (const [atom, value] of initialValues) {
    if (!set.has(atom)) {
      set.add(atom)
      ;(registry as any).ensureNode(atom).setValue(value)
    }
  }
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomInitialValues = (initialValues: Iterable<readonly [Atom.Atom<any>, any]>): void => {
  const registry = React.use(RegistryContext)
  ensureAtomInitialValues(registry, initialValues)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomValue: {
  <A>(atom: Atom.Atom<A>): A;
  <A, B>(atom: Atom.Atom<A>, f: (_: A) => B): B
} = <A>(atom: Atom.Atom<A>, f?: (_: A) => A): A => {
  const registry = React.use(RegistryContext)
  if (f) {
    const atomB = React.useMemo(() => Atom.map(atom, f), [atom, f])
    return useStore(registry, atomB)
  }
  return useStore(registry, atom)
}

function mountAtom<A>(registry: Registry.Registry, atom: Atom.Atom<A>): void {
  React.useEffect(() => registry.mount(atom), [atom, registry])
}

function setAtom<R, W, Mode extends 'value' | 'promise' | 'promiseExit' = never>(
  registry: Registry.Registry,
  atom: Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [Result.Result<any, any>] ? Mode : 'value') | undefined
  },
): 'promise' extends Mode
  ? (value: W) => Promise<Result.Result.Success<R>>
  : 'promiseExit' extends Mode
    ? (value: W) => Promise<Exit.Exit<Result.Result.Success<R>, Result.Result.Failure<R>>>
    : (value: W | ((value: R) => W)) => void {
  if (options?.mode === 'promise' || options?.mode === 'promiseExit') {
    return React.useCallback(
      (value: W) => {
        registry.set(atom, value)
        const promise = Effect.runPromiseExit(
          Registry.getResult(registry, atom as Atom.Atom<Result.Result<any, any>>, {
            suspendOnWaiting: true,
          }),
        )
        return options!.mode === 'promise' ? promise.then(flattenExit) : promise
      },
      [registry, atom, options.mode],
    ) as any
  }
  return React.useCallback(
    (value: W | ((value: R) => W)) => {
      registry.set(atom, typeof value === 'function' ? (value as any)(registry.get(atom)) : value)
    },
    [registry, atom],
  ) as any
}

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomMount = <A>(atom: Atom.Atom<A>): void => {
  const registry = React.use(RegistryContext)
  mountAtom(registry, atom)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomSet = <R, W, Mode extends 'value' | 'promise' | 'promiseExit' = never>(
  atom: Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [Result.Result<any, any>] ? Mode : 'value') | undefined
  },
): 'promise' extends Mode
  ? (value: W) => Promise<Result.Result.Success<R>>
  : 'promiseExit' extends Mode
    ? (value: W) => Promise<Exit.Exit<Result.Result.Success<R>, Result.Result.Failure<R>>>
    : (value: W | ((value: R) => W)) => void => {
  const registry = React.useContext(RegistryContext)
  mountAtom(registry, atom)
  return setAtom(registry, atom, options)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomRefresh = <A>(atom: Atom.Atom<A>): (() => void) => {
  const registry = React.use(RegistryContext)
  mountAtom(registry, atom)
  return React.useCallback(() => {
    registry.refresh(atom)
  }, [registry, atom])
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtom = <R, W>(
  atom: Atom.Writable<R, W>,
): readonly [value: R, setOrUpdate: (_: W | ((_: R) => W)) => void] => {
  const registry = React.use(RegistryContext)
  return [useStore(registry, atom), setAtom(registry, atom)] as const
}

const atomPromiseMap = globalValue('@effect-atom/atom-react/atomPromiseMap', () => ({
  suspendOnWaiting: new Map<Atom.Atom<any>, Promise<void>>(),
  default: new Map<Atom.Atom<any>, Promise<void>>(),
}))

function atomToPromise<A, E>(
  registry: Registry.Registry,
  atom: Atom.Atom<Result.Result<A, E>>,
  suspendOnWaiting: boolean,
) {
  const map = suspendOnWaiting ? atomPromiseMap.suspendOnWaiting : atomPromiseMap.default
  let promise = map.get(atom)
  if (promise !== undefined) {
    return promise
  }
  promise = new Promise<void>((resolve) => {
    const dispose = registry.subscribe(atom, (result) => {
      if (result._tag === 'Initial' || (suspendOnWaiting && result.waiting)) {
        return
      }
      setTimeout(dispose, 1000)
      resolve()
      map.delete(atom)
    })
  })
  map.set(atom, promise)
  return promise
}

function atomResultOrSuspend<A, E>(
  registry: Registry.Registry,
  atom: Atom.Atom<Result.Result<A, E>>,
  suspendOnWaiting: boolean,
) {
  const value = useStore(registry, atom)
  if (value._tag === 'Initial' || (suspendOnWaiting && value.waiting)) {
    throw atomToPromise(registry, atom, suspendOnWaiting)
  }
  return value
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomSuspense = <A, E, const IncludeFailure extends boolean = false>(
  atom: Atom.Atom<Result.Result<A, E>>,
  options?:
    | {
        readonly suspendOnWaiting?: boolean | undefined
        readonly includeFailure?: IncludeFailure | undefined
      }
    | undefined,
): Result.Success<A, E> | (IncludeFailure extends true ? Result.Failure<A, E> : never) => {
  const registry = React.use(RegistryContext)
  const result = atomResultOrSuspend(registry, atom, options?.suspendOnWaiting ?? false)
  if (result._tag === 'Failure' && !options?.includeFailure) {
    throw Cause.squash(result.cause)
  }
  return result as any
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomSubscribe = <A>(
  atom: Atom.Atom<A>,
  f: (_: A) => void,
  options?: { readonly immediate?: boolean },
): void => {
  const registry = React.useContext(RegistryContext)
  React.useEffect(() => registry.subscribe(atom, f, options), [registry, atom, f, options?.immediate])
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomRef = <A>(ref: AtomRef.ReadonlyRef<A>): A => {
  const [, setValue] = React.useState(ref.value)
  React.useEffect(() => ref.subscribe(setValue), [ref])
  return ref.value
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomRefProp = <A, K extends keyof A>(ref: AtomRef.AtomRef<A>, prop: K): AtomRef.AtomRef<A[K]> =>
  React.useMemo(() => ref.prop(prop), [ref, prop])

/**
 * @since 1.0.0
 * @category hooks
 */
export const useAtomRefPropValue = <A, K extends keyof A>(ref: AtomRef.AtomRef<A>, prop: K): A[K] =>
  useAtomRef(useAtomRefProp(ref, prop))

export type InferAtomResult<T> = T extends Atom.Atom<Result.Result<infer A, infer E>> ? Result.Result<A, E> : never

export interface Binding<A> {
  value: A
  setValue: (_: SetStateAction<A>) => void
}

export function useAtomRefBinding<A extends Record<string, any>, P extends keyof A, B>(
  ref: AtomRef.AtomRef<A>,
  key: P,
  f: (_: A[P]) => B,
  g: (value: B) => A[P],
) {
  const bRef = useMemo(() => ref.map((_) => f(_[key])), [ref, key, f])
  const value = useAtomRef(bRef)

  const setValue = (value: SetStateAction<B>) => {
    ref.update((_) => ({
      ..._,
      [key]: g(typeof value === 'function' ? (value as any)(_[key]) : value),
    }))
  }
  return {
    value,
    setValue,
  }
}

export function useAtomRefBindingIdentity<A extends Record<string, any>, P extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  key: P,
) {
  return useAtomRefBinding(ref, key, identity, identity)
}

export function useAtomBinding<E, A>(atom: Atom.Writable<Result.Result<E, A>, A>) {
  const { value } = useAtomSuspense(atom, { includeFailure: false })
  const setValue = useAtomSet(atom)
  return { value, setValue }
}

export function useAtomBindingBoolean<E>(atom: Atom.Writable<Result.Result<E, boolean>, boolean>) {
  const { value, setValue } = useAtomBinding(atom)
  return { value, setValue, toggle: () => setValue((_) => !_) }
}

/**
 * Custom hook that subscribes to an Atom and updates the result state.
 */
export function useAtomResult<A, E>(atom: Atom.Atom<Result.Result<A, E>>, immediate = true) {
  const [result, setResult] = useState<Result.Result<A, E>>(Result.initial(true))

  const ref = useRef(atom)

  useAtomSubscribe(ref.current, setResult, { immediate })

  return result
}

type ExtractAtomResult<T extends Atom.Atom<any>> = T extends Atom.Atom<Result.Result<infer A, infer _E>> ? A : never

type ExtractAtomError<T extends Atom.Atom<any>> = T extends Atom.Atom<Result.Result<infer _A, infer E>> ? E : never

export const atomHooks: {
  <A>(
    atom: Atom.Atom<A>,
    type?: 'value',
    option?: never,
  ): {
    (): A;
    <B>(f: (_: A) => B): B
  };
  <A, const IncludeFailure extends boolean = false>(
    atom: Atom.Atom<A>,
    type: 'suspense',
    options?: {
      readonly suspendOnWaiting?: boolean
      readonly includeFailure?: IncludeFailure | undefined
    },
  ): () =>
    | Result.Success<ExtractAtomResult<Atom.Atom<A>>, ExtractAtomError<Atom.Atom<A>>>
    | (IncludeFailure extends true
        ? Result.Failure<ExtractAtomResult<Atom.Atom<A>>, ExtractAtomError<Atom.Atom<A>>>
        : never)
} = (atom: any, type: any = 'value', options: any): any => {
  if (type === 'value') {
    return useAtomValue.bind(null, atom) as any
  }

  if (type === 'suspense') {
    return useAtomSuspense.bind(null, atom, options) as any
  }
}
