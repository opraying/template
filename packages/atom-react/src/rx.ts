import * as Registry from '@effect-atom/atom/Registry'
import * as Result from '@effect-atom/atom/Result'
import * as Atom from '@effect-atom/atom/Atom'
import {
  defaultRegistry,
  useAtom,
  useAtomMount,
  useAtomSubscribe,
  useAtomSuspense,
  useAtomValue,
} from '@xstack/atom-react/react'
import * as Effect from 'effect/Effect'
import type * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import { hasProperty } from 'effect/Predicate'

const fnTypeId = Symbol.for('@x/atom/fn')

const atomTypeId = Symbol.for('@x/atom/atom')

const pullTypeId = Symbol.for('@x/atom/pull')

const subscriptionRefTypeId = Symbol.for('@x/atom/subscriptionRef')

const subscribableTypeId = Symbol.for('@x/atom/subscribable')

const xTypeId = Symbol.for('@x/atom/xTypeId')

const typeIds = {
  [xTypeId]: xTypeId,
  [fnTypeId]: fnTypeId,
  [atomTypeId]: atomTypeId,
  [pullTypeId]: pullTypeId,
  [subscriptionRefTypeId]: subscriptionRefTypeId,
  [subscribableTypeId]: subscribableTypeId,
} as const

const isAtom = <A>(atom: Atom.Atom<A>): atom is Atom.Atom<A> => hasProperty(atom, Atom.TypeId)

const isAtomFn = <A extends Result.Result<any, any>>(a: any): a is Atom.AtomResultFn<any, A, any> =>
  hasProperty(a, xTypeId) && a[xTypeId] === fnTypeId

const isAtomAtom = <A>(atom: Atom.Atom<A>): atom is Atom.Atom<A> =>
  hasProperty(atom, xTypeId) && atom[xTypeId] === atomTypeId

const isAtomPull = <A, E>(val: any): val is Atom.Writable<Atom.PullResult<A, E>, void> =>
  hasProperty(val, xTypeId) && val[xTypeId] === pullTypeId

const isAtomSubscriptionRef = <A, E>(val: any): val is Atom.Writable<Result.Result<A, E>, A> =>
  hasProperty(val, xTypeId) && val[xTypeId] === subscriptionRefTypeId

const isAtomSubscribable = <A, E>(val: any): val is Atom.Atom<Atom.Writable<A, E>> =>
  hasProperty(val, xTypeId) && val[xTypeId] === subscribableTypeId

const isAtomWritable = <A, E>(atom: Atom.Atom<A>): atom is Atom.Writable<A, E> =>
  isAtomPull(atom) || isAtomSubscriptionRef(atom) || isAtomFn(atom) || hasProperty(atom, Atom.WritableTypeId)

// Add type identifiers
const getAtomTypeId: (atom: Atom.Atom<any>) => Record<symbol, symbol> = (atom: Atom.Atom<any>) => {
  const typeIds = {} as any

  if (isAtomPull(atom)) {
    typeIds[xTypeId] = pullTypeId
  } else if (isAtomSubscriptionRef(atom)) {
    typeIds[xTypeId] = subscriptionRefTypeId
  } else if (isAtomSubscribable(atom)) {
    typeIds[xTypeId] = subscribableTypeId
  } else if (isAtomAtom(atom)) {
    typeIds[xTypeId] = atomTypeId
  } else if (isAtomFn(atom)) {
    typeIds[xTypeId] = fnTypeId
  }
  return typeIds as Record<symbol, symbol>
}

type ExtractAtom<T extends Atom.Atom<any>> = T extends Atom.Atom<infer A> ? A : never

type ExtractAtomResult<T extends Atom.Atom<any>> = T extends Atom.Atom<Result.Result<infer A, infer _E>> ? A : never

type ExtractAtomError<T extends Atom.Atom<any>> = T extends Atom.Atom<Result.Result<infer _A, infer E>> ? E : never

type ExtractWritable<T extends Atom.Atom<any>> = T extends Atom.Writable<infer R, infer W> ? [R, W] : never

const mountAtomWeakSet = new WeakSet()

const ensureAtomMounted = (registry: Registry.Registry, atom: Atom.Atom<any>): (() => void) => {
  let unmount = () => {}
  const cleanup = () => {
    unmount()
    mountAtomWeakSet.delete(atom)
  }
  if (!mountAtomWeakSet.has(atom)) {
    unmount = registry.mount(atom)
    mountAtomWeakSet.add(atom)
  }

  return cleanup
}

interface AtomReadable<T extends Atom.Atom<any>> {
  atom: T
  /**
   * @since 1.0.0
   * @category hooks
   */
  useMount(): void
  /**
   * @since 1.0.0
   * @category hooks
   */
  useValue(): ExtractAtom<T>
  /**
   * @since 1.0.0
   * @category hooks
   */
  useSuspense(options?: { readonly suspendOnWaiting?: boolean } | undefined): ExtractAtom<T>
  /**
   * @since 1.0.0
   * @category hooks
   */
  useSuspenseSuccess(
    options?:
      | {
          readonly suspendOnWaiting?: boolean
        }
      | undefined,
  ): Result.Success<ExtractAtomResult<T>, ExtractAtomError<T>>
  /**
   * @since 1.0.0
   * @category hooks
   */
  useSubscribe(callback: (_: ExtractAtom<T>) => void, options?: { readonly immediate?: boolean }): void

  refresh: (registry?: Registry.Registry) => void
}

interface AtomWritable<T extends Atom.Atom<any>> {
  (_: ExtractWritable<T>[1] | ((_: ExtractAtom<T>) => ExtractWritable<T>[1]), registry?: Registry.Registry): void
  promise: (
    _: ExtractWritable<T>[1],
    registry?: Registry.Registry,
  ) => Promise<Exit.Exit<ExtractAtomResult<T>, ExtractAtomError<T>>>
  use: () => readonly [
    value: ExtractAtom<T>,
    setOrUpdate: (_: ExtractWritable<T>[1] | ((_: ExtractAtom<T>) => ExtractWritable<T>[1])) => void,
  ]
  refresh: (registry?: Registry.Registry) => void
}

// Base prototype with common readable methods
const AtomBaseProto = {
  useMount() {
    return useAtomMount(this.atom)
  },
  useValue() {
    return useAtomValue(this.atom)
  },
  useSuspense(options?: { suspendOnWaiting?: boolean | undefined } | undefined) {
    return useAtomSuspense(this.atom, { ...options, includeFailure: true })
  },
  useSuspenseSuccess(options?: { suspendOnWaiting?: boolean | undefined } | undefined) {
    return useAtomSuspense(this.atom, options)
  },
  useSubscribe(callback: (v: any) => void) {
    return useAtomSubscribe(this.atom, callback)
  },
} as AtomReadable<Atom.Atom<any>>

const AtomWritableProto = function <A>(this: any, value: A, registry = defaultRegistry) {
  const atom = this.atom as Atom.Writable<any, any>
  const cleanup = ensureAtomMounted(registry, atom)

  if (typeof value === 'function') {
    registry.set(atom, (value as any)(registry.get(atom)))
    cleanup()
    return
  }
  registry.set(atom, value)
  cleanup()
}
AtomWritableProto.use = function () {
  const atom = (this as any).atom as Atom.Writable<any, any>
  return useAtom(atom)
}
AtomWritableProto.promise = function <A>(value: A, registry = defaultRegistry) {
  const atom = (this as any).atom as Atom.Writable<any, any>
  const cleanup = ensureAtomMounted(registry, atom)

  const resolves = new Set<(result: Exit.Exit<any, any>) => void>()
  registry.subscribe(
    atom,
    (result: any) => {
      if (result.waiting || result._tag === 'Initial') return
      const fns = Array.from(resolves)
      resolves.clear()
      const exit = Result.toExit(result)
      fns.forEach((resolve) => resolve(exit as any))
    },
    { immediate: true },
  )

  return new Promise((resolve) => {
    resolves.add(resolve)
    registry.set(atom, value)
  }).finally(() => cleanup())
}
AtomWritableProto.refresh = function (registry = defaultRegistry) {
  const atom = (this as any).atom as Atom.Writable<any, any>
  registry.refresh(atom)
}

const createAtomWrapper: <T extends Atom.Atom<any>>(key: string, atom: T) => any = <T extends Atom.Atom<any>>(
  _key: string,
  atom: T,
) => {
  const self = { atom }

  const isWritable = isAtomWritable(atom)
  if (isWritable) {
    const proto = AtomWritableProto.bind(self)
    const boundProto = Object.fromEntries(Object.entries(AtomBaseProto).map(([key, value]) => [key, value.bind(self)]))

    Object.assign(proto, {
      ...getAtomTypeId(atom),
      ...boundProto,
      atom,
      use: AtomWritableProto.use.bind(self),
      promise: AtomWritableProto.promise.bind(self),
      refresh: AtomWritableProto.refresh.bind(self),
    })

    return proto
  }

  // Readable, refreshable
  const proto = { ...getAtomTypeId(atom), ...AtomBaseProto, refresh: AtomWritableProto.refresh.bind(self) }

  return Object.create(proto, {
    atom: { value: atom, writable: false, enumerable: false, configurable: false },
  })
}

// basic hook
interface ReadableHook<T extends Atom.Atom<any>> extends AtomReadable<T> {}

// read-write hook
interface ReadWriteHook<T extends Atom.Writable<any, any>> extends ReadableHook<T>, AtomWritable<T> {
  (_: ExtractWritable<T>[1] | ((_: ExtractAtom<T>) => ExtractWritable<T>[1]), registry?: Registry.Registry): void
}

type AtomHookType<T> =
  T extends Atom.Atom<any>
    ? T extends Atom.Writable<any, any>
      ? ReadWriteHook<T> // read-write hook
      : ReadableHook<T> // read hook
    : T

const createAtomHooks: <S extends Record<string, Atom.Atom<any> | any>>(
  s: S,
) => { [K in keyof S]: AtomHookType<S[K]> } = <S extends Record<string, Atom.Atom<any> | any>>(
  s: S,
): {
  [K in keyof S]: AtomHookType<S[K]>
} => {
  const record = Object.fromEntries(
    Object.entries(s).map(([key, value]) => {
      if (!isAtom(value)) {
        return [key, value]
      }

      return [key, createAtomWrapper(key, value)]
    }),
  ) as {
    [K in keyof S]: AtomHookType<S[K]>
  }

  return record
}

type ServiceConstructor = (abstract new (...args: any) => any) & {
  Default: Layer.Layer<any, any, any>
}

type ExtractLayer<T> = T extends Layer.Layer<infer R, infer E, infer In> ? [R, E, In] : never

type MergeLayerTypes<S extends Record<string, ServiceConstructor>> = Layer.Layer<
  ExtractLayer<S[keyof S]['Default']>[0],
  ExtractLayer<S[keyof S]['Default']>[1],
  ExtractLayer<S[keyof S]['Default']>[2]
>

type ServiceMembers<S extends ServiceConstructor, T extends InstanceType<S> = InstanceType<S>> = Omit<
  {
    [K in keyof T]: T[K] extends Effect.Effect<any, any, any>
      ? // Effect
        T[K]
      : // function, keep it
        T[K] extends (...args: any) => any
        ? (
            ...args: Parameters<T[K]>
          ) => ReturnType<T[K]> extends Effect.Effect<any, any, any>
            ? ReturnType<T[K]>
            : Effect.Effect<ReturnType<T[K]>, never, never>
        : // transform to Effect
          Effect.Effect<T[K], never, never>
  },
  'use' | 'pipe' | '_tag'
>

export const UseUseServices =
  <
    S extends Record<string, ServiceConstructor>,
    LA extends Layer.Layer.Success<MergeLayerTypes<S>>,
    LE extends Layer.Layer.Error<MergeLayerTypes<S>>,
    LR extends Layer.Layer.Context<MergeLayerTypes<S>>,
    R = never,
  >(
    services: S,
    layer: LR | R extends never
      ? Layer.Layer<never, never, never>
      : Layer.Layer<LR | R, never, never> = Layer.empty as any,
  ) =>
  <O extends Record<string, Atom.Atom<any> | any>>(
    handler: (services: {
      services: {
        [K in keyof S]: ServiceMembers<S[K]>
      }
      runtime: Atom.AtomRuntime<LA | R, LE>
    }) => O,
  ): (() => { [K in keyof O]: AtomHookType<O[K]> }) =>
  (): {
    [K in keyof O]: AtomHookType<O[K]>
  } => {
    const layers = Object.values(services).map((_) => _.Default)
    const merged = pipe(
      Layer.mergeAll(...(layers as any)) as unknown as Layer.Layer<any>,
      Layer.provideMerge(layer || Layer.empty),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    ) as unknown as Layer.Layer<LA | R, LE, never>
    const originalRuntime = Atom.runtime(merged)

    const runtime = new Proxy(originalRuntime, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver)
        if (typeof original !== 'function') return original

        // Return a wrapped function that adds the appropriate type identifier
        return function (this: typeof target, ...args: any[]) {
          const result = original.apply(this, args)
          const typeId = typeIds[prop as keyof typeof typeIds]

          if (typeId) {
            Object.defineProperty(result, xTypeId, { value: typeId, enumerable: true, configurable: false })
          }
          return result
        }
      },
    })

    const methods = handler({ services: services as any, runtime })
    const hooks = createAtomHooks(methods)

    return hooks
  }

export const makeAtomService = <T>(target: any, getter: () => T, prop = 'useAtom'): T => {
  let value_: T | null = null

  Object.defineProperty(target, prop, {
    get: () => {
      if (value_) return value_
      const value = getter()
      value_ = value
      return value
    },
  })

  return target[prop]
}
