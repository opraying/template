import { describe, it } from '@effect/vitest'
import { Context, Effect, Exit, Layer, Scope, TestClock } from 'effect'
import * as GlobalLayer from '../src/global'

describe('Global Layer', () => {
  it.effect('should add a layer to the global context', () =>
    Effect.gen(function* () {
      class Foo extends Context.Tag('Foo')<Foo, string>() {
        static Default = Layer.scoped(
          this,
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Effect.logDebug('Foo finalized'))
            return 'Foo'
          }),
        )
      }
      class Bar extends Context.Tag('Bar')<Bar, string>() {
        static Default = Layer.scoped(
          this,
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Effect.logDebug('Bar finalized'))
            return 'Bar'
          }),
        )
      }

      // --- 1 ---
      const scope = yield* Scope.make()
      yield* Layer.buildWithScope(scope)(
        GlobalLayer.add('A', [
          [Foo.Default, Foo],
          [Bar.Default, Bar],
        ]),
      )

      // --- 2 ---
      const scope2 = yield* Scope.make()
      yield* Effect.gen(function* () {
        const foo = yield* Foo
        const bar = yield* Bar
        yield* Effect.logDebug(foo, bar)
      }).pipe(
        Effect.provide(GlobalLayer.use('B', Bar, Foo)),
        Effect.forkScoped,
        Effect.provideService(Scope.Scope, scope2),
      )

      // --- 3 ---
      const scope3 = yield* Scope.make()
      yield* Effect.gen(function* () {
        const foo = yield* Foo
        yield* Effect.logDebug(foo)
      }).pipe(Effect.provide(GlobalLayer.use('C', Foo)), Effect.forkScoped, Effect.provideService(Scope.Scope, scope3))

      yield* TestClock.adjust(10)
      yield* Effect.logDebug('------------- Close Scope --------------------')
      yield* Scope.close(scope, Exit.void)

      yield* TestClock.adjust(10)

      yield* Effect.logDebug('------------- Close Scope2 --------------------')
      yield* Scope.close(scope2, Exit.void)

      yield* TestClock.adjust(10)

      yield* Effect.logDebug('------------- Close Scope3 --------------------')
      yield* Scope.close(scope3, Exit.void)
    }),
  )
})
