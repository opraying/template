import * as Vitest from '@effect/vitest'
import {
  Arbitrary,
  Cause,
  type Context,
  Duration,
  Effect,
  Exit,
  FastCheck as FC,
  Fiber,
  FiberRef,
  Layer,
  LogLevel,
  ManagedRuntime,
  pipe,
  Predicate,
  Schema,
  Scope,
  TestContext,
  type TestServices,
} from 'effect'
import * as R from 'remeda'
import * as V from 'vitest'

export type LayerImpl<A extends Context.Tag<any, any>> = Partial<Context.Tag.Service<A>>

const makeUnimplemented = (id: string, prop: PropertyKey) => {
  const dead = Effect.die(`${id}: Unimplemented method "${prop.toString()}"`)
  function unimplemented() {
    return dead
  }
  // @effect-diagnostics-next-line floatingEffect:off
  Object.assign(unimplemented, dead)
  Object.setPrototypeOf(unimplemented, Object.getPrototypeOf(dead))
  return unimplemented
}

const makeUnimplementedProxy = <A extends object>(service: string, impl: Partial<A>): A =>
  new Proxy({ ...impl } as A, {
    get(target, prop, _receiver) {
      if (prop in target) {
        return target[prop as keyof A]
      }

      return ((target as any)[prop] = makeUnimplemented(service, prop))
    },
    has: () => true,
  })

const makeTestLayer =
  <I, S extends object>(tag: Context.Tag<I, S>) =>
  (service: Partial<S>): Layer.Layer<I> =>
    Layer.succeed(tag, makeUnimplementedProxy(tag.key, service))

// ----- Layer -----

export const mock =
  <I, S extends object>(tag: Context.Tag<I, S>, service1: Partial<S> = {}) =>
  (service2: Partial<S> = {}) =>
  <A, E, R>(layer: Layer.Layer<A, E, R>) =>
    layer.pipe(Layer.provide(makeTestLayer(tag)(R.mergeDeep(service2, service1) as Partial<S>)))

// ----- Effect -----

export const withLayer =
  <I, S extends object>(tag: Context.Tag<I, S>, service1: Partial<S> = {}) =>
  (service2: Partial<S> = {}) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provide(makeTestLayer(tag)(R.mergeDeep(service2, service1) as Partial<S>)))

export const withOverrideLayer =
  <I, S extends object>(tag: Context.Tag<I, S>, service: Partial<S>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.updateService(tag, (impl) => {
        return new Proxy(impl, {
          get(target, prop, _receiver) {
            if (prop in service) {
              return service[prop as keyof S]
            }

            return target[prop as keyof S]
          },
          has: () => true,
        }) as S
      }),
    )

const defaultApi = Object.assign(V.it, { scopedFixtures: V.it.scoped })

/** @internal */
const testOptions = (timeout?: number | V.TestOptions) => (typeof timeout === 'number' ? { timeout } : (timeout ?? {}))

type TestContext = Vitest.TestContext

type RunPromise = <A, E>(
  effect: Effect.Effect<() => A, E, any>,
  { signal }: { signal?: AbortSignal | undefined },
) => Promise<() => A>

const runPromise =
  <R1>(run: RunPromise, ctx?: TestContext) =>
  <A, E, R extends R1>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const exitFiber = yield* Effect.fork(Effect.exit(effect))

      ctx?.onTestFinished(() => Fiber.interrupt(exitFiber).pipe(Effect.asVoid, Effect.runPromise))

      const exit = yield* Fiber.join(exitFiber)
      if (Exit.isSuccess(exit)) {
        return () => exit.value
      } else {
        if (Cause.isInterruptedOnly(exit.cause)) {
          return () => {
            throw new Error('All fibers interrupted without errors.')
          }
        }
        const errors = Cause.prettyErrors(exit.cause)
        for (let i = 1; i < errors.length; i++) {
          yield* Effect.logError(errors[i])
        }
        return () => {
          throw errors[0]
        }
      }
    })
      .pipe((effect) => run(effect, { signal: ctx?.signal }))
      .then((f) => f())

export const makeTester =
  // @ts-ignore
  <R>(mapEffect: <A>(self: Effect.Effect<A, any, R>) => Effect.Effect<A, any, R>, it: Vitest.API = defaultApi) =>
    (run_: RunPromise): Vitest.Vitest.Tester<R> => {
      const run = <A, E, TestArgs extends Array<unknown>>(
        ctx: V.TestContext & object,
        args: TestArgs,
        self: Vitest.Vitest.TestFunction<A, E, R, TestArgs>,
      ) =>
        pipe(
          Effect.suspend(() => {
            const ctx = args[0] as V.TestContext

            if (ctx) {
              return Effect.withSpan(self(...args), `Test-${ctx.task.suite?.name}-${ctx.task.name}`, {
                attributes: {
                  filename: ctx.task.file.name,
                },
              })
            }

            return self(...args)
          }),
          mapEffect,
          runPromise<R>(run_, ctx),
        )

      const f: Vitest.Vitest.Test<R> = (name, self, timeout) => it(name, (ctx) => run(ctx, [ctx], self), timeout)

      const skip: Vitest.Vitest.Tester<R>['only'] = (name, self, timeout) =>
        // @ts-ignore
        it.skip(name, (ctx) => run(ctx, [ctx], self), timeout)

      const skipIf: Vitest.Vitest.Tester<R>['skipIf'] = (condition) => (name, self, timeout) =>
        // @ts-ignore
        it.skipIf(condition)(name, (ctx) => run(ctx, [ctx], self), timeout)

      const runIf: Vitest.Vitest.Tester<R>['runIf'] = (condition) => (name, self, timeout) =>
        // @ts-ignore
        it.runIf(condition)(name, (ctx) => run(ctx, [ctx], self), timeout)

      const only: Vitest.Vitest.Tester<R>['only'] = (name, self, timeout) =>
        // @ts-ignore
        it.only(name, (ctx) => run(ctx, [ctx], self), timeout)

      const each: Vitest.Vitest.Tester<R>['each'] = (cases) => (name, self, timeout) =>
        it.for(cases)(name, testOptions(timeout), (args, ctx) => run(ctx, [args] as any, self as any))

      const fails: Vitest.Vitest.Tester<R>['fails'] = (name, self, timeout) =>
        it.fails(name, testOptions(timeout), (ctx) => run(ctx, [ctx], self))

      const prop: Vitest.Vitest.Tester<R>['prop'] = (name, arbitraries, self, timeout) => {
        if (Array.isArray(arbitraries)) {
          const arbs = arbitraries.map((arbitrary) =>
            Schema.isSchema(arbitrary) ? Arbitrary.make(arbitrary) : arbitrary,
          )
          return it(name, testOptions(timeout), (ctx) =>
            // @ts-ignore
            FC.assert(
              // @ts-ignore
              FC.asyncProperty(...arbs, (...as) => run(ctx, [as as any, ctx], self)),
              // @ts-ignore
              Predicate.isObject(timeout) ? timeout?.fastCheck : {},
            ),
          )
        }

        const arbs = FC.record(
          Object.keys(arbitraries).reduce(
            function (result, key) {
              result[key] = Schema.isSchema(arbitraries[key]) ? Arbitrary.make(arbitraries[key]) : arbitraries[key]
              return result
            },
            {} as Record<string, FC.Arbitrary<any>>,
          ),
        )

        return it(name, testOptions(timeout), (ctx) =>
          // @ts-ignore
          FC.assert(
            FC.asyncProperty(arbs, (...as) =>
              // @ts-ignore
              run(ctx, [as[0] as any, ctx], self),
            ),
            // @ts-ignore
            Predicate.isObject(timeout) ? timeout?.fastCheck : {},
          ),
        )
      }

      return Object.assign(f, { skip, skipIf, runIf, only, each, fails, prop })
    }

// ----- Test -----

export const layer =
  <R, E, const ExcludeTestServices extends boolean = false>(
    layer_: Layer.Layer<R, E>,
    options: {
      readonly memoMap?: Layer.MemoMap
      readonly timeout?: Duration.DurationInput
      readonly excludeTestServices?: ExcludeTestServices
      readonly logLevel?: LogLevel.Literal
      readonly hooks?:
        | {
            beforeEach?: Effect.Effect<void, any, any> | undefined
            afterEach?: Effect.Effect<void, any, any> | undefined
            mapEffect?: <A, E2, R2>(
              effect: Effect.Effect<A, E2, R2>,
              mangedRuntime: ManagedRuntime.ManagedRuntime<R, E>,
            ) => Effect.Effect<A, E | E2, Exclude<R2, R>>
          }
        | undefined
    } & Vitest.TestOptions = {},
  ) =>
  (
    ...args:
      | [name: string, f: (it: Vitest.Vitest.MethodsNonLive<R, ExcludeTestServices>) => void]
      | [f: (it: Vitest.Vitest.MethodsNonLive<R, ExcludeTestServices>) => void]
  ) => {
    const excludeTestServices = options?.excludeTestServices ?? false
    const withTestEnv = excludeTestServices
      ? (layer_ as Layer.Layer<R | TestServices.TestServices, E>)
      : Layer.provideMerge(layer_, TestContext.TestContext)
    const memoMap = options?.memoMap ?? Effect.runSync(Layer.makeMemoMap)
    const mangedRuntime = ManagedRuntime.make(withTestEnv, memoMap)

    const makeIt = (it: Vitest.API): Vitest.Vitest.MethodsNonLive<R, ExcludeTestServices> =>
      Object.assign(it, {
        effect: makeTester<TestServices.TestServices | R>(
          (effect) =>
            options.hooks?.mapEffect
              ? options.hooks.mapEffect(effect, mangedRuntime)
              : Effect.locally(
                  effect,
                  FiberRef.currentMinimumLogLevel,
                  options.logLevel ? LogLevel.fromLiteral(options.logLevel) : LogLevel.Error,
                ),
          it,
        )(mangedRuntime.runPromise),

        scoped: makeTester<TestServices.TestServices | Scope.Scope | R>(
          (_) => Effect.scoped(_),
          it,
        )(mangedRuntime.runPromise),

        flakyTest: Vitest.flakyTest,

        prop: Vitest.prop,

        layer<R2, E2>(
          nestedLayer: Layer.Layer<R2, E2, R>,
          options?: {
            readonly timeout?: Duration.DurationInput
          },
        ) {
          return Vitest.layer(Layer.provideMerge(nestedLayer, withTestEnv), {
            ...options,
            memoMap,
            excludeTestServices,
          })
        },
      })

    const setup = () => {
      const timeout = options?.timeout ? Duration.toMillis(options.timeout) : undefined

      V.beforeAll(() => mangedRuntime.runtime(), timeout)

      if (options.hooks?.beforeEach) {
        const fn = options.hooks.beforeEach
        V.beforeEach((s) => mangedRuntime.runPromise(fn, { signal: s.signal }), timeout)
      }

      if (options.hooks?.afterEach) {
        const fn = options.hooks.afterEach
        V.afterEach((s) => mangedRuntime.runPromise(fn, { signal: s.signal }), timeout)
      }

      V.afterAll(() => mangedRuntime.dispose(), timeout)
    }

    if (args.length === 1) {
      setup()
      // @ts-ignore
      return args[0](makeIt(defaultApi))
    }

    return V.describe(args[0], () => {
      setup()
      // @ts-ignore
      return args[1](makeIt(defaultApi))
    })
  }
