import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as GlobalValue from 'effect/GlobalValue'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'
import * as Tracer from 'effect/Tracer'

interface ServiceState {
  context: Context.Context<any>
  acquirers: Set<string>
  users: Set<string>
  close: Effect.Effect<void>
}

const globalContextMap = GlobalValue.globalValue('globalContextMap', () => {
  const map = new Map<string, ServiceState>()
  const isLoggingEnabled = false

  const log = {
    info: (msg: string, state?: ServiceState) => {
      if (!isLoggingEnabled) return
      if (state) {
        console.log(`[Global] ${msg} (users: ${Array.from(state.users)}, acquirers: ${Array.from(state.acquirers)})`)
      } else {
        console.log(`[Global] ${msg}`)
      }
    },
    error: (msg: string) => isLoggingEnabled && console.error(`[Global] Error: ${msg}`),
  }

  const getOrFail = (key: string): Effect.Effect<ServiceState> =>
    Effect.suspend(() => {
      const state = map.get(key)
      return state ? Effect.succeed(state) : Effect.dieMessage(`Service not found: ${key}`)
    })

  return {
    create: (
      identifier: string,
      tags: Context.Tag<any, any>[],
      context: Context.Context<any>,
      close: Effect.Effect<void>,
    ) =>
      Effect.forEach(tags, (tag) => {
        const exist = map.get(tag.key)

        if (!exist) {
          const state: ServiceState = {
            context: Context.add(Context.empty(), tag, Context.get(context, tag)),
            acquirers: new Set([identifier]),
            users: new Set(),
            close,
          }
          map.set(tag.key, state)
          log.info(`Created service ${tag.key}`, state)
          return Effect.void
        }

        exist.context = Context.add(exist.context, tag, Context.get(context, tag))
        if (!exist.acquirers.has(identifier)) {
          exist.acquirers.add(identifier)
          log.info(`Added provider ${identifier} to ${tag.key}`, exist)
        } else {
          log.info(`Reuse service ${tag.key}`, exist)
        }

        return Effect.void
      }),

    acquire: <T extends Context.Tag<any, any>>(identifier: string, tags: T[]) =>
      Layer.scopedContext(
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() => globalContextMap.release(identifier, tags))

          let ctx = Context.empty()
          for (const tag of tags) {
            const state = yield* getOrFail(tag.key)
            state.users.add(identifier)
            ctx = Context.merge(ctx, state.context)
            log.info(`Service ${tag.key} acquired by ${identifier}`, state)

            if (tag.key === Tracer.Tracer.key) {
              const tracer = state.context.unsafeMap.get(tag.key)
              if (tracer) {
                yield* Effect.withTracerScoped(tracer)
              }
            }
          }
          return ctx as Context.Context<T>
        }),
      ),

    release: (identifier: string, tags: Context.Tag<any, any>[]) =>
      Effect.forEach(
        tags,
        (tag) => {
          const state = map.get(tag.key)
          if (!state) return Effect.void

          state.users.delete(identifier)
          state.acquirers.delete(identifier)
          log.info(`Released ${tag.key} from ${identifier}`, state)

          if (state.users.size === 0 && state.acquirers.size === 0) {
            map.delete(tag.key)
            log.info(`Cleaned up ${tag.key}`)
            return state.close
          }

          return Effect.void
        },
        { discard: true },
      ),
  }
})

export const add = <T extends Array<[Layer.Layer.Any, Context.Tag<any, any>]>>(
  identifier: string,
  res: T,
): Layer.Layer<never, Layer.Layer.Error<T[number][0]>, Layer.Layer.Context<T[number][0]>> =>
  pipe(
    Effect.gen(function* () {
      const layerScope = yield* Effect.scope
      const scope = yield* Scope.make()
      const [layers, tags] = res.reduce(
        ([l, t], [layer, tag]) => [
          [...l, layer],
          [...t, tag],
        ],
        [[], []] as [Layer.Layer.Any[], Context.Tag<any, any>[]],
      )
      const scopeLayer = Layer.provide(
        Layer.extendScope(Layer.mergeAll(...(layers as any))),
        Layer.succeed(Scope.Scope, scope),
      )

      return pipe(
        Layer.effectDiscard(
          Effect.gen(function* () {
            yield* Scope.addFinalizer(layerScope, globalContextMap.release(identifier, tags))
            const ctx = yield* Effect.context<any>()
            yield* globalContextMap.create(identifier, tags, ctx, Scope.close(scope, Exit.void))
          }),
        ),
        Layer.provide(scopeLayer),
      )
    }),
    Layer.unwrapScoped,
  ) as any

type ExtractLayersService<T extends Context.Tag<any, any>[]> = {
  [K in keyof T]: Context.Tag.Identifier<NoInfer<T>[K]>
}
export const use = <T extends Context.Tag<any, any>[]>(identifier: string, ...tags: T) =>
  globalContextMap.acquire(identifier, tags) as unknown as Layer.Layer<ExtractLayersService<T>[number], never, never>
