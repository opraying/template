/// <reference types="@cloudflare/workers-types" />

import * as Headers from '@effect/platform/Headers'
import * as HttpTraceContext from '@effect/platform/HttpTraceContext'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'

type EffectDurableObjectStub<T, E = never> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R extends Effect.Effect<any, any, any> ? unknown : Effect.Effect<Awaited<R>, RPCError | E>
    : never
}

export class RPCError extends Schema.TaggedError<RPCError>('RPCError')('RPCError', {
  message: Schema.String,
  reason: Schema.Defect,
}) {}

const isFunction = (value: unknown): value is Function => {
  return typeof value === 'function'
}

export const wrapStub = <T>(binding: () => DurableObject): EffectDurableObjectStub<T, RPCError> =>
  new Proxy(binding(), {
    get:
      (target, prop, _receiver) =>
      (...args: any) => {
        const method = (target as any)[prop]

        if (!isFunction(method)) {
          return Effect.succeed(method)
        }

        const traceHeaders = Effect.currentSpan.pipe(
          Effect.map(HttpTraceContext.toHeaders),
          Effect.orElseSucceed(() => Headers.empty),
        )

        return pipe(
          traceHeaders,
          Effect.andThen((_headers) => {
            const fn = method(
              // {
              //   b3: headers.b3,
              //   traceparent: headers.traceparent,
              // },
              ...args,
            )

            return Effect.promise(() => fn)
          }),
          Effect.mapError((error: any) => new RPCError({ message: error.message || '', reason: error })),
          Effect.tap(Effect.log),
          Effect.withSpan(`Durable.${prop.toString()}`, {
            attributes: {
              prop: prop.toString(),
            },
          }),
        )
      },
  }) as EffectDurableObjectStub<T, RPCError>

export type DOClass = {
  new (state: DurableObjectState, env: any): DurableObject
}
export const makeDO = (doClass: DOClass) => doClass

// export class RPCError extends Schema.TaggedError<RPCError>("RPCError")("RPCError", {
//   name: Schema.String,
//   message: Schema.String,
//   reason: Schema.Defect,
//   remote: Schema.BooleanFromUnknown.pipe(Schema.optionalWith({ default: () => false })),
// }) {
//   get message(): string {
//     return `${this.name}${this.remote ? " (remote)" : ""}: ${this.message}${this.reason ? `\n${this.reason}` : ""}`
//   }
// }

// type EffectDurableObjectStub<T, E = never> = Omit<
//   {
//     [K in keyof T]: T[K] extends (...args: infer A) => infer R
//       ? (...args: A) => R extends Effect.Effect<any, any, any> ? unknown : Effect.Effect<Awaited<R>, RPCError | E>
//       : never
//   },
//   "fetch" | "alarm" | "webSocketClose" | "webSocketMessage" | "webSocketError" | "onInitialize" | "initialize"
// >

// const isFunction = (value: unknown): value is Function => {
//   return typeof value === "function"
// }
// const catchUnknownError = (name: string) => (e: any) => {
//   if (e._tag && e._tag === RPCError._tag) {
//     return e as RPCError
//   }

//   const errorOrString = Schema.decodeSync(Schema.Defect)(e)

//   const message = errorOrString instanceof Error ? errorOrString.message : (errorOrString as string)
//   const reason = errorOrString instanceof Error ? errorOrString.stack : ""

//   return new RPCError({ name, message, reason, remote: e.remote })
// }

// export const wrapDoStub = <T>(binding: () => DurableObject): EffectDurableObjectStub<T, RPCError> =>
//   new Proxy(binding(), {
//     get:
//       (target, prop) =>
//       (...args: any) => {
//         const method = (target as any)[prop]

//         if (!isFunction(method)) {
//           return Effect.succeed(method)
//         }

//         const name = prop.toString()
//         return pipe(
//           Effect.tryPromise({
//             try: () => method.call(target, ...args) as Promise<any>,
//             catch: catchUnknownError(name),
//           }),
//           Effect.catchAllDefect(catchUnknownError(name)),
//           Effect.withSpan(`Durable.${name}`, { attributes: { name } }),
//         )
//       },
//   }) as EffectDurableObjectStub<T, RPCError>

// type Effectify<Fn, E = never> = Fn extends (...args: infer A) => infer R
//   ? (...args: A) => R extends Effect.Effect<any, any, any> ? unknown : Effect.Effect<Awaited<R>, E>
//   : never

// type EffectStub<T, E = never> = {
//   [K in keyof T]: Effectify<T[K], E | RPCError>
// }

// type Strip<T> = Omit<T, "fetch" | "queue" | "scheduled" | "tail" | "queue" | "test" | "trace">

// export const wrapWorkerEntryPoint: <T extends WorkerEntrypoint>(
//   binding: () => T,
// ) => {
//   invoke: Strip<EffectStub<T, RPCError>>
//   acquire: <A>(name: string, select: (_: Strip<T>) => A) => Effect.Effect<Effectify<A, RPCError>, RPCError, Scope.Scope>
//   acquireUse: <A, A1, E = never, R = never>(
//     name: string,
//     select: (_: Strip<T>) => A,
//     use: (invokeFn: Effectify<A, E | RPCError>) => Effect.Effect<A1, E, R>,
//   ) => Effect.Effect<A1, E | RPCError, R>
// } = <T extends WorkerEntrypoint>(
//   binding: () => T,
// ): {
//   invoke: Strip<EffectStub<T, RPCError>>
//   acquire: <A>(name: string, select: (_: Strip<T>) => A) => Effect.Effect<Effectify<A, RPCError>, RPCError, Scope.Scope>
//   acquireUse: <A, A1, E = never, R = never>(
//     name: string,
//     select: (_: Strip<T>) => A,
//     use: (invokeFn: Effectify<A, E | RPCError>) => Effect.Effect<A1, E, R>,
//   ) => Effect.Effect<A1, E | RPCError, R>
// } => {
//   const invoke = new Proxy(binding(), {
//     get:
//       (target, prop) =>
//       (...args: any) => {
//         const method = (target as any)[prop]

//         const isPromiseLike = Predicate.isPromiseLike(method)

//         if (isPromiseLike || Predicate.isFunction(method)) {
//           const name = prop.toString()
//           return pipe(
//             Effect.tryPromise({
//               try: () => method.call(target, ...args) as Promise<any>,
//               catch: catchUnknownError(name),
//             }),
//             Effect.flatMap((_) => (Predicate.isPromiseLike(_) ? Effect.promise(() => _) : Effect.succeed(_))),
//             Effect.catchAllDefect(catchUnknownError(name)),
//             Effect.withSpan(`WorkerEntryPoint.${name}`, { attributes: { name } }),
//           )
//         }

//         return Effect.succeed(method)
//       },
//   }) as Strip<EffectStub<T, RPCError>>

//   const acquire = <A>(name: string, select: (_: Strip<T>) => A) =>
//     Effect.scopeWith((scope) => {
//       return pipe(
//         Effect.sync(() => select(binding())),
//         Effect.flatMap((method) =>
//           Effect.promise(async () => {
//             const stub = (await method) as A & Disposable
//             const cleanup = () => stub[Symbol.dispose]()
//             return [stub, cleanup] as const
//           }),
//         ),
//         Effect.tap(([_, clean]) => Scope.addFinalizer(scope, Effect.ignore(Effect.try(() => clean())))),
//         Effect.map(([stub]) => {
//           const invokeFn = ((...args: any) =>
//             Effect.tryPromise({
//               try: async () => {
//                 return (await (stub as any)(...args)) as Promise<A>
//               },
//               catch: catchUnknownError(name),
//             })) as unknown as Effectify<A, RPCError>

//           return invokeFn
//         }),
//         Effect.catchAllDefect(catchUnknownError(name)),
//         Effect.withSpan(`WorkerEntryPoint.${name}`, { attributes: { name } }),
//       )
//     })

//   const acquireUse = <A, A1, E = never, R = never>(
//     name: string,
//     select: (_: Strip<T>) => A,
//     use: (invokeFn: Effectify<A, E | RPCError>) => Effect.Effect<A1, E, R>,
//   ): Effect.Effect<A1, E | RPCError, R> =>
//     pipe(
//       Effect.sync(() => select(binding())),
//       Effect.flatMap((method) => {
//         const stub = Predicate.isPromiseLike(method) ? Effect.promise(() => method) : Effect.succeed(() => method)
//         return stub as unknown as Effect.Effect<A & Disposable>
//       }),
//       Effect.flatMap((stub) => {
//         const invokeFn = ((...args: any) =>
//           Effect.tryPromise({
//             try: () => (stub as any)(...args) as Promise<A>,
//             catch: catchUnknownError(name),
//           })) as unknown as Effectify<A, RPCError>

//         return use(invokeFn).pipe(Effect.ensuring(Effect.ignore(Effect.try(() => stub[Symbol.dispose]?.()))))
//       }),
//       Effect.catchAllDefect(catchUnknownError(name)),
//       Effect.withSpan(`WorkerEntryPoint.${name}`, { attributes: { name } }),
//     )

//   return { invoke, acquire, acquireUse }
// }
