// oxlint-disable triple-slash-reference
/// <reference types="@cloudflare/workers-types" />

import type * as Cloudflare from '@cloudflare/workers-types'
import * as HttpTraceContext from '@effect/platform/HttpTraceContext'
import * as CloudflareBindings from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as CloudflareExecutionContext from '@xstack/cloudflare/execution-context'
import { withGlobalLogLevel } from '@xstack/server/logger'
import type * as CloudflareWorkers from 'cloudflare:workers'
import { WorkerEntrypoint } from 'cloudflare:workers'
import * as Cause from 'effect/Cause'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { LazyArg } from 'effect/Function'
import { flow, identity, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import type * as ParseResult from 'effect/ParseResult'
import * as Predicate from 'effect/Predicate'
import * as Runtime from 'effect/Runtime'
import * as Schema from 'effect/Schema'
import * as Struct from 'effect/Struct'
import * as Tracer from 'effect/Tracer'

export class WorkspaceInstanceError extends Data.TaggedError('WorkspaceInstanceError')<{
  method: string
  reason: unknown
}> {}

export type WorkflowInstance = {
  /**
   * Return the id of a Workflow.  */
  readonly id: Effect.Effect<string>
  /**
   * Return the status of a running Workflow instance.
   */
  readonly status: Effect.Effect<Cloudflare.InstanceStatus>
  /**
   * Pause a running Workflow instance.
   */
  readonly pause: Effect.Effect<void>
  /**
   * Resume a paused Workflow instance.
   */
  readonly resume: Effect.Effect<void>
  /**
   * Restart a Workflow instance.
   */
  readonly restart: Effect.Effect<void>
  /**
   * Terminate a Workflow instance.
   */
  readonly terminate: Effect.Effect<void>
  /**
   * Send an event to a running Workflow instance.
   * Return void on success; throws an exception if the Workflow is not running or is an errored state.
   */
  readonly sendEvent: (_: { type: string; payload: unknown }) => Effect.Effect<void>
}

const makeInstance = (instance: Cloudflare.WorkflowInstance): WorkflowInstance => {
  return {
    id: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.id,
        catch: (error) => new WorkspaceInstanceError({ method: 'id', reason: error }),
      }),
    ),
    status: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.status(),
        catch: (error) => new WorkspaceInstanceError({ method: 'status', reason: error }),
      }),
    ),
    pause: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.pause(),
        catch: (error) => new WorkspaceInstanceError({ method: 'pause', reason: error }),
      }),
    ),
    resume: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.resume(),
        catch: (error) => new WorkspaceInstanceError({ method: 'resume', reason: error }),
      }),
    ),
    restart: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.restart(),
        catch: (error) => new WorkspaceInstanceError({ method: 'restart', reason: error }),
      }),
    ),
    terminate: Effect.orDie(
      Effect.tryPromise({
        try: async () => instance.terminate(),
        catch: (error) => new WorkspaceInstanceError({ method: 'terminate', reason: error }),
      }),
    ),
    sendEvent: (_: { type: string; payload: unknown }) =>
      Effect.orDie(
        Effect.tryPromise({
          try: async () => instance.sendEvent(_),
          catch: (error) => new WorkspaceInstanceError({ method: 'sendEvent', reason: error }),
        }),
      ),
  }
}

interface WorkflowInstanceCreateOptions<T = unknown> {
  readonly id?: string | undefined
  readonly params: T | undefined
}

export interface WorkflowStepConfig {
  readonly retries?: {
    limit: number
    delay: Duration.DurationInput
    backoff?: 'constant' | 'linear' | 'exponential'
  }
  readonly timeout?: Duration.DurationInput
}

const optionsToRetries = (options?: WorkflowStepConfig): CloudflareWorkers.WorkflowStepConfig => {
  const ret: CloudflareWorkers.WorkflowStepConfig = {}

  if (options?.retries) {
    ret.retries = {
      delay: Duration.toMillis(options.retries.delay),
      limit: options.retries.limit,
    }
    if (options.retries.backoff) {
      ret.retries.backoff = options.retries.backoff
    }
  }

  if (options?.timeout) {
    ret.timeout = Duration.toMillis(options.timeout)
  }

  return ret
}

interface CloudflareWorkflow {
  /**
   * @link https://developers.cloudflare.com/workflows/build/workers-api/#get
   */
  readonly get: (id: string) => Promise<Cloudflare.WorkflowInstance>

  /**
   * @link https://developers.cloudflare.com/workflows/build/workers-api/#create
   */
  readonly create: (options?: WorkflowInstanceCreateOptions) => Promise<Cloudflare.WorkflowInstance>

  /**
   * @link https://developers.cloudflare.com/workflows/build/workers-api/#createBatch
   */
  readonly createBatch: (options: WorkflowInstanceCreateOptions[]) => Promise<Cloudflare.WorkflowInstance[]>
}

const make = <T extends Record<string, CloudflareWorkflow>, R extends Record<keyof T, WorkflowClass<any, any>>>(
  env: T,
  record: R,
) => {
  const getClass = (workflowTag: keyof T) => record[workflowTag]

  const getBinding = (ins: ReturnType<typeof getClass>): CloudflareWorkflow => {
    if (process.env.NODE_ENV === 'development') {
      if (env['DEV_WORKFLOW_PROXY']) {
        const workflowFetcher = env.DEV_WORKFLOW_PROXY as unknown as Fetcher

        const callProxyWorkflow = (prop: string, args: any[]) =>
          workflowFetcher
            .fetch('http://localhost/workflow', {
              method: 'POST',
              body: JSON.stringify({
                method: prop,
                binding: ins._binding,
                args,
              }),
            })
            .then((response) => response.json() as unknown as { id: string; error?: string | undefined })
            .then((result) => {
              if (result && 'error' in result) {
                return Promise.reject(new Error(result.error))
              }
              return result
            })

        const callProxyWorkspaceInstance = (instanceId: string, method: string) => (args: any[]) =>
          workflowFetcher
            .fetch('http://localhost/instance', {
              method: 'POST',
              body: JSON.stringify({
                instanceId,
                method,
                binding: ins._binding,
                args,
              }),
            })
            .then((response) => response.json())
            .then((result: any) => {
              if (result && 'error' in result) {
                return Promise.reject(new Error(result.error))
              }
              return result
            })

        const proxy = new Proxy(
          {},
          {
            get: (_target, prop) => {
              return async (...args: any[]) => {
                const workflowResult = await callProxyWorkflow(prop as string, args)
                const instanceId = workflowResult.id

                return new Proxy(
                  {},
                  {
                    get(_target, prop) {
                      if (prop === 'then') {
                        return
                      }

                      if (prop === 'id') {
                        return Promise.resolve(instanceId)
                      }

                      return callProxyWorkspaceInstance(instanceId, prop as string)
                    },
                  },
                )
              }
            },
          },
        )

        return proxy as any
      }
    }

    const binding = env[ins._binding]

    return binding as any as CloudflareWorkflow
  }

  const get = (workflowTag: keyof T, id: string) => {
    const workflow = getClass(workflowTag)

    return Effect.tryPromise({
      try: () => getBinding(workflow).get(id),
      catch: () => new Cause.NoSuchElementException(),
    }).pipe(
      Effect.map(makeInstance),
      Effect.asSome,
      Effect.orElseSucceed(() => Option.none<WorkflowInstance>()),
    )
  }

  const create = <A = unknown>(workflowTag: keyof T, options: WorkflowInstanceCreateOptions<A>) => {
    const workflow = getClass(workflowTag)
    const encode = Schema.encodeUnknown(workflow._schema)

    return pipe(
      Effect.all(
        {
          params: options.params ? encode(options.params) : Effect.void,
          headers: Effect.currentSpan.pipe(Effect.map(HttpTraceContext.toHeaders), Effect.optionFromOptional),
        },
        { concurrency: 'unbounded' },
      ),
      Effect.flatMap(({ params, headers }) =>
        Effect.tryPromise(() =>
          getBinding(workflow).create({
            id: options?.id,
            params: {
              ...params,
              __headers: Option.match(headers, {
                onSome: (headers) => ({
                  b3: headers.b3,
                  traceparent: headers.traceparent,
                }),
                onNone: () => ({}),
              }),
            },
          }),
        ),
      ),
      Effect.map(makeInstance),
      Effect.withSpan(`Workflows.create.${workflowTag.toString()}`, {
        attributes: {
          workflowTag,
          id: options?.id,
          params: options?.params,
        },
      }),
      Effect.orDie,
    )
  }

  const createBatch = <A = unknown>(workflowTag: keyof T, options: Array<WorkflowInstanceCreateOptions<A>>) => {
    const workflow = getClass(workflowTag)
    const encode = Schema.encodeUnknown(Schema.Array(workflow._schema))

    return pipe(
      Effect.all(
        {
          params: encode(options.map((_) => _.params)),
          headers: Effect.currentSpan.pipe(Effect.map(HttpTraceContext.toHeaders), Effect.optionFromOptional),
        },
        { concurrency: 'unbounded' },
      ),
      Effect.flatMap(({ params, headers }) => {
        const binding = getBinding(workflow)

        return Effect.forEach(
          params,
          (params, index) =>
            Effect.tryPromise(() =>
              binding.create({
                id: params[index].id,
                params: {
                  ...params,
                  __headers: Option.match(headers, {
                    onSome: (headers) => ({
                      b3: headers.b3,
                      traceparent: headers.traceparent,
                    }),
                    onNone: () => ({}),
                  }),
                },
              }),
            ),
          { concurrency: 'unbounded' },
        )
      }),
      Effect.map((_) => _.map(makeInstance)),
      Effect.withSpan(`Workflows.create.${workflowTag.toString()}`, {
        attributes: {
          workflowTag,
        },
      }),
      Effect.orDie,
    )
  }

  return {
    get,
    create,
    createBatch,
    getWorkflow: <R extends Record<string, WorkflowClass<any, any>>>(workflowTag: keyof R) => ({
      get: (id: string) => get(workflowTag as any, id),
      create: (options: WorkflowInstanceCreateOptions<R[typeof workflowTag]['_a']>) =>
        create(workflowTag as any, options),
      createBatch: (options: Array<WorkflowInstanceCreateOptions<R[typeof workflowTag]['_a']>>) =>
        createBatch(workflowTag as any, options),
    }),
  }
}

// @effect-diagnostics-next-line unsupportedServiceAccessors:off
export class Workflows extends Effect.Tag('@cloudflare:workflows')<Workflows, ReturnType<typeof make>>() {
  static fromRecord: <T extends Record<string, WorkflowClass<any, any>>>(
    record: LazyArg<T>,
  ) => Layer.Layer<Workflows, never, never> = <T extends Record<string, WorkflowClass<any, any>>>(record: LazyArg<T>) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const raw = yield* CloudflareBindings.CloudflareBindings.getRaw()
        return make(raw, record())
      }),
    )

  static getWorkflow: <R extends Record<string, WorkflowClass<any, any>>>(
    workflowTag: keyof R,
  ) => Effect.Effect<
    {
      get: (id: string) => Effect.Effect<Option.Option<WorkflowInstance>, never, never>
      create: (
        options: WorkflowInstanceCreateOptions<R[keyof R]['_a']>,
      ) => Effect.Effect<WorkflowInstance, never, never>
      createBatch: (
        options: Array<WorkflowInstanceCreateOptions<R[keyof R]['_a']>>,
      ) => Effect.Effect<WorkflowInstance[], never, never>
    },
    never,
    Workflows
  > = <R extends Record<string, WorkflowClass<any, any>>>(workflowTag: keyof R) =>
    Effect.map(this, (_) => _.getWorkflow<R>(workflowTag))
}

const workerZone = DateTime.zoneUnsafeMakeNamed('UTC')

export class WorkflowEvent extends Context.Tag('@cloudflare:workflow-event')<
  WorkflowEvent,
  CloudflareWorkers.WorkflowEvent<unknown>
>() {
  static params: <T>(_: T) => Context.Tag<WorkflowEvent, CloudflareWorkers.WorkflowEvent<T>> = <T>(_: T) =>
    this as Context.Tag<WorkflowEvent, CloudflareWorkers.WorkflowEvent<T>>
}

type DoPayload<Payload extends Schema.Struct.Fields> = {
  [k in Exclude<keyof Payload, '_tag'>]: Payload[k] extends Schema.Schema.All ? Payload[k]['Type'] : never
}

export class Workflow extends Context.Tag('@cloudflare:workflow')<
  Workflow,
  {
    readonly do: <A, E = never, R = never>(
      label: string,
      effect: Effect.Effect<A, E, R>,
      options?: WorkflowStepConfig,
    ) => Effect.Effect<A, E, never>

    readonly schema: <
      Tag extends string,
      Payload extends Schema.Struct.Fields,
      Success extends Schema.Schema.All,
      Failure extends Schema.Schema.All,
      R,
    >(
      SchemaClass: Schema.TaggedRequestClass<
        any,
        Tag,
        {
          readonly _tag: Schema.tag<Tag>
        } & Payload,
        Success,
        Failure
      >,
      effect: (payload: Payload) => Effect.Effect<Success['Type'], Failure['Type'], R>,
      options?: WorkflowStepConfig,
    ) => (_: Payload) => Effect.Effect<Success['Type'], Failure['Type'], never>

    readonly sleep: (label: string, duration: Duration.DurationInput) => Effect.Effect<void, never>

    readonly sleepUntil: (label: string, timestamp: DateTime.DateTime) => Effect.Effect<void, never>

    readonly waitForEvent: <T = never>(
      label: string,
      options: { type: string; timeout?: Duration.DurationInput | undefined },
    ) => Effect.Effect<
      {
        payload: T
        timestamp: Date
        type: string
      },
      never
    >
  }
>() {
  static do = <A, E = never, R = never>(label: string, effect: Effect.Effect<A, E, R>, options?: WorkflowStepConfig) =>
    Effect.flatMap(Workflow, (workflow) => workflow.do(label, effect, options))

  static schema =
    <
      Tag extends string,
      Payload extends Schema.Struct.Fields,
      Success extends Schema.Schema.All,
      Failure extends Schema.Schema.All,
      R,
    >(
      SchemaClass: Schema.TaggedRequestClass<any, Tag, Payload, Success, Failure>,
      effect: (payload: DoPayload<Payload>) => Effect.Effect<Success['Type'], Failure['Type'], R>,
      options?: WorkflowStepConfig,
    ) =>
    (payload: DoPayload<Payload>) =>
      Effect.flatMap(Workflow, (workflow) => workflow.schema(SchemaClass as any, effect, options)(payload))

  static sleep = (label: string, duration: Duration.DurationInput) =>
    Effect.flatMap(Workflow, (workflow) => workflow.sleep(label, duration))

  static sleepUntil = (label: string, timestamp: DateTime.DateTime) =>
    Effect.flatMap(Workflow, (workflow) => workflow.sleepUntil(label, timestamp))

  static waitForEvent = <T>(label: string, options: { type: string; timeout?: Duration.DurationInput | undefined }) =>
    Effect.flatMap(Workflow, (workflow) => workflow.waitForEvent<T>(label, options))
}

export interface WorkflowClass<A, I> extends WorkerEntrypoint<never> {
  readonly _a: A
  readonly _i: I
  readonly _schema: Schema.Schema<A, I>
  readonly _binding: string
  readonly run: (...args: any) => Promise<void>
}

export const runEffectWorkflow = <A, I, E = never>(
  schema: Schema.Schema<A, I>,
  run: (event: A) => Effect.Effect<void, E, Workflow | WorkflowEvent>,
) => {
  const decode = Schema.decodeUnknown(schema)
  const DoExitSchema = Schema.Exit({
    success: Schema.Any,
    failure: Schema.Defect,
    defect: Schema.Defect,
  })
  const encodeDoExit = Schema.encodeUnknownSync(DoExitSchema)
  const decodeDoExit = Schema.decodeUnknown(DoExitSchema)

  const catchAll =
    (_: { decode: (input: unknown) => Effect.Effect<Exit.Exit<any, any>, ParseResult.ParseError, never> }) =>
    (effect: Effect.Effect<any, any>) =>
      pipe(
        effect,
        Effect.flatMap((result) => {
          // Step do success, but not return anything
          if (!result) {
            return Effect.void
          }

          return pipe(
            _.decode(result),
            Effect.orDieWith((cause) => new Error('Failed to parse exit', { cause })),
            Effect.flatMap((exit) =>
              Exit.match(exit, {
                onSuccess: (value) => Effect.succeed(value),
                onFailure: (cause) => (Cause.isDieType(cause) ? Effect.die(cause.defect) : Effect.failCause(cause)),
              }),
            ),
          )
        }),
        Effect.catchAllCause((cause) => {
          if (cause._tag === 'Fail') {
            const fromError = Effect.sync(() => {
              if (cause.error instanceof Error) {
                return cause.error
              }
              if (Predicate.isObject(cause.error)) {
                return cause.error
              }
              return JSON.stringify(cause.error)
            })

            const safeError = cause.error?.message
              ? Effect.orElse(
                  Effect.try(() => JSON.parse(cause.error.message) as object),
                  () => fromError,
                )
              : fromError

            return pipe(
              safeError,
              Effect.flatMap((exitError: any) => {
                if (exitError && exitError._tag === 'Failure' && exitError.cause && exitError.cause.failure) {
                  exitError.cause.error = exitError.cause.failure
                  exitError.cause.failure = undefined
                }
                return _.decode(exitError)
              }),
              Effect.orDieWith((cause) => new Error('Failed to parse exit', { cause })),
              Effect.flatMap((exit) =>
                Exit.match(exit, {
                  onSuccess: () => Effect.dieMessage('Should never happen'),
                  onFailure: (cause) => (Cause.isDieType(cause) ? Effect.die(cause.defect) : Effect.failCause(cause)),
                }),
              ),
            )
          }

          if (cause._tag === 'Die') {
            return Effect.die(cause.defect)
          }

          return Effect.die(Cause.squash(cause))
        }),
        Effect.tapErrorCause((cause) => Effect.logError(Cause.pretty(cause, { renderErrorCause: true }))),
        Effect.tapDefect(Effect.logError),
      )

  return (event: CloudflareWorkers.WorkflowEvent<I>, step: CloudflareWorkers.WorkflowStep) =>
    pipe(
      decode(event.payload),
      Effect.flatMap((payload) => run(payload)),
      Effect.provide(
        Layer.mergeAll(
          Layer.sync(Workflow, () => ({
            do: (label, callback, options) => {
              const run = pipe(
                Effect.runtime<never>(),
                Effect.flatMap((runtime) =>
                  Effect.tryPromise({
                    try: (signal) => {
                      const run = Runtime.runPromise(runtime)

                      return step.do(label, optionsToRetries(options), async () => {
                        const exit = await run(Effect.exit(callback as Effect.Effect<any, any>), {
                          signal,
                        })

                        if (Exit.isSuccess(exit)) {
                          return encodeDoExit(exit)
                        }

                        if (Exit.isFailure(exit)) {
                          /**
                           * If it is "die", then no exception is thrown;
                           * pass this step up to the outer layer to handle the termination.
                           */
                          if (Cause.isDieType(exit.cause)) {
                            // Worker unsupported Serialization Effect Cause
                            // Covert to plain error message, not Effect Cause
                            return encodeDoExit(exit)
                          }

                          /**
                           * Throw an error to make step do retry
                           * Cloudflare Workflow will wrap error string to Error instance
                           */
                          throw JSON.stringify(encodeDoExit(exit))
                        }
                      })
                    },
                    catch: (error) => error as any,
                  }),
                ),
                catchAll({ decode: decodeDoExit }),
                Effect.withSpan('Workflows.do', { attributes: { label } }),
              )

              return run as any
            },
            schema: (SchemaClass, callback, options) => (payload) => {
              const sc = new SchemaClass(Struct.omit(payload, '_tag') as any) as unknown as Schema.TaggedRequest<
                string,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                never
              >
              const successSchema = Schema.successSchema(sc)
              const failureSchema = Schema.failureSchema(sc)
              const isAllowEmpty = successSchema.ast._tag === 'VoidKeyword'

              const ExitSchema = Schema.Exit({
                defect: Schema.Defect,
                failure: Schema.Union(Schema.Defect, failureSchema),
                success: Schema.transform(successSchema, Schema.Any, {
                  decode: (fa) => {
                    return fa
                  },
                  encode: (ti) => {
                    return isAllowEmpty ? undefined : ti
                  },
                  strict: false,
                }),
              })
              const encodeExit = Schema.encodeUnknownSync(ExitSchema)
              const decodeExit = Schema.decodeUnknown(ExitSchema)

              const run = pipe(
                Effect.runtime<never>(),
                Effect.flatMap((runtime) =>
                  Effect.tryPromise({
                    try: (signal) => {
                      const run = Runtime.runPromise(runtime)

                      return step.do(SchemaClass.identifier, optionsToRetries(options), async () => {
                        const exit = await run(Effect.exit(callback(payload as any) as Effect.Effect<any, any>), {
                          signal,
                        })

                        if (Exit.isSuccess(exit)) {
                          try {
                            return encodeExit(exit)
                          } catch (error) {
                            return encodeExit(Exit.die(error))
                          }
                        }

                        if (Exit.isFailure(exit)) {
                          /**
                           * If it is "die", then no exception is thrown;
                           * pass this step up to the outer layer to handle the termination.
                           */
                          if (Cause.isDieType(exit.cause)) {
                            // Worker unsupported Serialization Effect Cause
                            // Covert to plain error message, not Effect Cause
                            try {
                              return encodeExit(exit)
                            } catch (error) {
                              return encodeExit(Exit.die(error))
                            }
                          }

                          /**
                           * Throw an error to make step do retry
                           * Cloudflare Workflow will wrap error string to Error instance
                           */
                          throw JSON.stringify(encodeExit(exit))
                        }
                      })
                    },
                    catch: (error) => error as any,
                  }),
                ),
                catchAll({ decode: decodeExit }),
                Effect.withSpan('Workflows.doSchema', { attributes: { label: SchemaClass.identifier } }),
              )

              return run as any
            },
            sleep: (label, duration) =>
              Effect.withSpan(
                Effect.promise(async () => step.sleep(label, Duration.toMillis(duration))),
                'Workflows.sleep',
                { attributes: { label, duration } },
              ),
            sleepUntil: (label, timestamp) =>
              Effect.withSpan(
                Effect.promise(async () => step.sleepUntil(label, DateTime.toEpochMillis(timestamp))),
                'Workflows.sleepUntil',
                { attributes: { label, timestamp } },
              ),
            waitForEvent: (label, options) =>
              Effect.withSpan(
                Effect.promise(async () =>
                  step.waitForEvent<any>(label, {
                    type: options.type,
                    timeout: Duration.toMillis(options.timeout ?? Duration.days(1)),
                  }),
                ),
                'Workflows.waitForEvent',
                { attributes: { label, type: options.type } },
              ),
          })),
          Layer.succeed(WorkflowEvent, event),
        ),
      ),
      DateTime.withCurrentZone(workerZone),
    )
}

export const makeWorkflowEntrypoint = <A, I, E = never>(
  { binding, schema }: { binding: string; schema: Schema.Schema<A, I> },
  run: (event: A) => Effect.Effect<void, E, Workflow | WorkflowEvent>,
) => {
  const entrypoint = class extends WorkerEntrypoint<never> {
    static _binding = binding
    static _schema = schema
    run(...args: [event: CloudflareWorkers.WorkflowEvent<I>, step: CloudflareWorkers.WorkflowStep]) {
      const headers = (args[0].payload as any as { __headers?: any })?.__headers
      const externalSpan: Option.Option<Tracer.ExternalSpan> = headers
        ? HttpTraceContext.fromHeaders(headers)
        : Option.none()

      const main = flow(
        runEffectWorkflow<A, I, E>(schema, run),
        Effect.provide(
          Layer.provide(
            Layer.mergeAll(
              CloudflareBindings.CloudflareBindings.fromEnv(this.env),
              CloudflareExecutionContext.CloudflareExecutionContext.fromContext(this.ctx, this.env),
              CacheStorage.fromGlobalCaches,
              Layer.setConfigProvider(makeConfigProvider(this.env)),
            ),
            withGlobalLogLevel(this.env),
          ),
        ),
        externalSpan._tag === 'None' ? identity : Effect.withParentSpan(externalSpan.value),

        Effect.exit,
        Effect.runPromise,
      )

      return main.apply(null, args).then((exit) => {
        if (exit._tag === 'Success') {
          return exit.value
        }

        throw Cause.squash(exit.cause)
      })
    }
  }

  return entrypoint as unknown as WorkflowClass<A, I>
}

export const makeWorkflow = <A, I, E = never>(
  { binding, schema }: { binding: string; schema: Schema.Schema<A, I> },
  run: (event: A) => Effect.Effect<void, E, Workflow | WorkflowEvent>,
) => makeWorkflowEntrypoint({ binding, schema }, run)
