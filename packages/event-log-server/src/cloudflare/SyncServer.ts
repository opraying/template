import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpApiError from '@effect/platform/HttpApiError'
import * as HttpServer from '@effect/platform/HttpServer'
import type * as HttpServerError from '@effect/platform/HttpServerError'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import * as CloudflareBindings from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as CloudflareContext from '@xstack/cloudflare/execution-context'
import { SocketCloseCodes } from '@xstack/event-log/EventLogConfig'
import {
  DurableObjectError,
  type DurableObjectIdentity,
  DurableObjectIdentitySchema,
} from '@xstack/event-log-server/cloudflare/DurableObjectUtils'
import * as EventLogSyncServer from '@xstack/event-log-server/cloudflare/EventLogSyncServer'
import { type SyncServerInfo, type SyncStats, WorkerQueryParams } from '@xstack/event-log-server/schema'
import { SyncHttpApi } from '@xstack/event-log-server/server/api'
import { SyncVaultApiHttpLive } from '@xstack/event-log-server/server/http'
import * as Ratelimit from '@xstack/event-log-server/server/ratelimit'
import * as ServerSchema from '@xstack/event-log-server/server/schema'
import * as Usage from '@xstack/event-log-server/server/usage'
import * as User from '@xstack/event-log-server/server/user'
import type * as Vault from '@xstack/event-log-server/server/vault'
import { ScalarLayer } from '@xstack/server/api/scalar'
import { withGlobalLogLevel, LoggerLive } from '@xstack/server/logger'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { flow, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'

const JSONTier = Schema.parseJson(ServerSchema.Tier)

const tierDecode = flow(Schema.decodeEither(JSONTier), Either.getOrUndefined)

const tierEncode = Schema.encodeSync(JSONTier)

export class DurableState extends Schema.Class<DurableState>('DurableState')({
  identity: DurableObjectIdentitySchema.pipe(
    Schema.Option,
    Schema.optionalWith({ exact: true, default: () => Option.none() }),
  ),
  tier: ServerSchema.Tier.pipe(Schema.Option, Schema.optionalWith({ exact: true, default: () => Option.none() })),
  note: Schema.String.pipe(Schema.optionalWith({ exact: true, default: () => '' })),
}) {
  static encode = Schema.encodeSync(DurableState)

  static decode = Schema.decodeSync(DurableState)

  static JSON = Schema.parseJson(DurableState)

  static encodeJSON = Schema.encodeSync(DurableState.JSON)

  static decodeJSONEither = Schema.decodeEither(DurableState.JSON)

  static decodeEither = Schema.decodeEither(DurableState)
}

export class SyncServerDurableObject extends EventLogSyncServer.SyncDurableServer {
  private state!: DurableState

  /**
   * on initialize
   */
  async onInitialize(): Promise<void> {
    try {
      const value = await this.ctx.storage.get<string>('_state').catch(() => '')
      const state = !value
        ? DurableState.make({})
        : DurableState.decodeJSONEither(value).pipe(
            Either.match({
              onLeft: () => DurableState.make({}),
              onRight: (value) => value,
            }),
          )

      this.state = state
    } catch (error) {
      console.error(`Error initializing state:`, DurableObjectError.fromUnknown(error))
    }
  }

  /**
   * update state
   */
  updateState(updates: Partial<typeof DurableState.Type>): void {
    DurableObjectError.try(() => {
      const state = Object.assign({}, this.state, updates)
      this.state = state
      this.ctx.waitUntil(this.ctx.storage.put('_state', DurableState.encodeJSON(state)))
    })
  }

  /**
   * get identity
   */
  override getIdentity(): Option.Option<DurableObjectIdentity> {
    return this.state.identity
  }

  /**
   * Get Sync stats
   */
  override async getSyncStats(): Promise<SyncStats> {
    return await DurableObjectError.promise(async () => {
      const { count, lastFlushTime } = this.getWriteStats()

      return {
        lastSyncAt: new Date(lastFlushTime),
        syncCount: count,
        usedStorageSize: this.ctx.storage.sql.databaseSize,
        maxStorageSize: Option.getOrElse(
          Option.map(this.state.tier, (tier) => tier.maxStorageBytes),
          () => 0,
        ),
      }
    })
  }

  /**
   * Get Sync durable object info
   */
  async getSyncInfo(): Promise<SyncServerInfo> {
    return await DurableObjectError.promise(async () => {
      const { note } = this.state
      const stats = await this.getSyncStats()

      return {
        note,
        ...stats,
      }
    })
  }

  /**
   * ensure the identity is valid
   */
  override ensure(_: {
    identity: DurableObjectIdentity
    tier: typeof ServerSchema.Tier.Type | undefined
    note?: string | undefined
  }): void {
    try {
      this.updateState({
        identity: Option.fromNullable(_.identity),
        tier: pipe(
          Option.fromNullable(_.tier),
          Option.orElse(() => this.state.tier),
        ),
        note: _.note ?? this.state.note,
      })
    } catch (error) {
      console.error('Error on ensure:', DurableObjectError.fromUnknown(error))
    }
  }

  async create(payload: typeof DurableState.Encoded): Promise<void> {
    return await DurableObjectError.promise(() => {
      const state = DurableState.decode(payload)
      this.state = state
      this.ctx.waitUntil(this.ctx.storage.put('_state', state))
    })
  }

  /**
   * Limit the request
   */
  override limit(): Effect.Effect<boolean, never, Ratelimit.Ratelimit> {
    return Effect.gen(this, function* () {
      const ratelimit = yield* Ratelimit.Ratelimit
      const identity = Option.getOrThrow(this.state.identity)
      const tier = Option.getOrThrow(this.state.tier)

      return yield* ratelimit.limit({ key: identity.id() }).pipe(Effect.provideService(User.Tier, tier))
    }).pipe(
      Effect.tapErrorCause(Effect.logError),
      Effect.catchAll(() => Effect.succeed(false)),
    )
  }

  /**
   * Write limit check
   */
  override writeLimit(): Effect.Effect<boolean, never, never> {
    return Effect.sync(() => {
      const tier = Option.getOrThrow(this.state.tier)
      const currentSize = this.ctx.storage.sql.databaseSize

      if (currentSize > tier.maxStorageBytes) {
        return false
      }

      return true
    })
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === 'GET' && pathname === this.options.syncPath) {
      const headersEither = DurableObjectIdentitySchema.fromHeaders(request.headers)

      const close = (code: number, reason?: string | undefined) => {
        const pair = new WebSocketPair()

        setTimeout(() => {
          pair[1].accept()
          pair[1].close(code, reason ?? 'Uncaught exception during session setup')
        }, 100)

        return new Response(null, { status: 101, webSocket: pair[0] })
      }

      if (Either.isLeft(headersEither)) {
        return close(SocketCloseCodes.UNAUTHORIZED, 'Unauthorized')
      }

      const identity = headersEither.right
      const tier = tierDecode(request.headers.get('x-tier') ?? '')

      this.ensure({ identity, tier })

      return super.fetch(request)
    }

    return super.fetch(request)
  }
}

const withBaseLayer = (env: any, context: ExecutionContext) =>
  flow(
    Layer.provideMerge(
      Layer.mergeAll(
        HttpServer.layerContext,
        CloudflareBindings.CloudflareBindings.fromEnv(env),
        CloudflareContext.CloudflareExecutionContext.fromContext(context, env),
        CacheStorage.fromGlobalCaches,
        Layer.setConfigProvider(makeConfigProvider(env)),
      ),
    ),
    Layer.provide([LoggerLive, withGlobalLogLevel(env)]),
    Layer.tapErrorCause(Effect.logError),
    Layer.orDie,
  )

// OTEL, Error

const toWebHandler = (
  env: any,
  context: ExecutionContext,
  layer: Layer.Layer<ServerSchema.UserSession | Vault.Vault>,
) => {
  const DocsLive =
    // @ts-ignore
    process.env.NODE_ENV === 'production'
      ? Layer.empty
      : Layer.mergeAll(
          HttpApiBuilder.middlewareOpenApi({ path: '/api/openapi.json' }),
          ScalarLayer({ path: '/api/scalar' }),
        )

  const ApiLive = pipe(HttpApiBuilder.api(SyncHttpApi), Layer.provide(SyncVaultApiHttpLive), Layer.provide(layer))

  const Live = pipe(DocsLive, Layer.provideMerge(ApiLive), withBaseLayer(env, context))

  return HttpApiBuilder.toWebHandler(Live, {
    middleware: Effect.fn(function* (app) {
      return yield* app.pipe(
        Effect.catchAll((error) => {
          const errors = error as HttpServerError.RouteNotFound

          if (errors?._tag === 'RouteNotFound') {
            return Effect.succeed(HttpServerResponse.empty({ status: 404 }))
          }

          return Effect.fail(error)
        }),
        // Effect.catchAllDefect((e: any) => {
        //   console.log(11, e)
        //   if (ParseResult.isParseError(e) || e._tag === "ParseError") {
        //     console.log(11, ParseResult.TreeFormatter.formatErrorSync(e))
        //     return Effect.fail(e)
        //   }
        //   return Effect.fail(e)
        // }),
      )
    }),
  })
}

export const makeDurableObject = (options: {
  layer: Layer.Layer<User.Authentication | Vault.Vault | Ratelimit.Ratelimit | Usage.Usage>
  syncPath?: string | undefined
  rpcPath?: string | undefined
  resetOnStartup?: boolean | undefined
  hibernatableWebSocketEventTimeout?: number | undefined
  syncAgentClientBinding?: string | undefined
}) => {
  class SyncServerDurableObjectServer extends SyncServerDurableObject {
    constructor(ctx: DurableObjectState, env: any) {
      super(ctx, env, {
        layer: options.layer,
        resetOnStartup: options.resetOnStartup ?? false,
        syncPath: options.syncPath ?? '/sync',
        rpcPath: options.rpcPath ?? '/rpc',
        hibernatableWebSocketEventTimeout: options.hibernatableWebSocketEventTimeout ?? 5000,
        syncAgentClientBinding: options.syncAgentClientBinding,
      })
    }
  }

  return SyncServerDurableObjectServer
}

export const makeWorker = (options: {
  layer: Layer.Layer<User.Authentication | Vault.Vault | Ratelimit.Ratelimit | Usage.Usage>
  syncPath?: string
  rpcPath?: string | undefined
  durableObjectPrefix?: string | undefined
  durableObjectBinding: string
}) => {
  return {
    async fetch(request: Request, env: any, context: ExecutionContext): Promise<Response> {
      const { pathname, searchParams } = new URL(request.url)

      const syncPath = options.syncPath ?? '/sync'
      const rpcPath = options.rpcPath ?? '/rpc'
      const bindingName = options.durableObjectBinding

      if (pathname.startsWith('/sync/api')) {
        return Effect.gen(function* () {
          const ratelimit = yield* Ratelimit.Ratelimit

          const token = Redacted.make(request.headers.get('x-session') ?? '')
          const limitSuccess = yield* ratelimit.connectCheck({
            request,
            token,
          })

          if (!limitSuccess) {
            return new Response('Too many requests', { status: 429 })
          }

          const authentication = yield* User.Authentication

          const user = yield* authentication.fromRequest(request)

          if (Option.isNone(user)) {
            return new Response('Unauthorized', { status: 401 })
          }

          const layer = Layer.mergeAll(options.layer, Layer.succeed(ServerSchema.CurrentAuthSession, user.value))

          const handle = toWebHandler(env, context, layer)

          const response = yield* Effect.promise(() =>
            handle.handler(request).finally(() => context.waitUntil(handle.dispose())),
          )

          return response
        }).pipe(Effect.provide(pipe(options.layer, withBaseLayer(env, context))), Effect.runPromise)
      }

      if (!pathname.startsWith(syncPath) && !pathname.startsWith(syncPath)) {
        return new Response(null, { status: 404 })
      }

      // API: /sync

      const program = Effect.gen(function* () {
        const close = (code: number, reason?: string | undefined) => {
          const pair = new WebSocketPair()

          setTimeout(() => {
            pair[1].accept()
            pair[1].close(code, reason ?? 'Uncaught exception during session setup')
          }, 100)

          return new Response(null, { status: 101, webSocket: pair[0] })
        }

        if (request.method === 'GET' && pathname.startsWith(syncPath)) {
          const upgradeHeader = request.headers.get('Upgrade')

          if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response(null, {
              status: 426,
              statusText: 'Durable Object expected Upgrade: websocket',
            })
          }

          const paramsEither = Schema.decodeUnknownEither(WorkerQueryParams)(searchParams.get('q'))

          if (Either.isLeft(paramsEither)) {
            return close(SocketCloseCodes.MISSING_FIELDS, 'Missing required fields')
          }

          const { namespace, publicKey, token } = paramsEither.right

          const ratelimit = yield* Ratelimit.Ratelimit

          const limitSuccess = yield* ratelimit.connectCheck({ request, token })

          if (!limitSuccess) {
            return close(SocketCloseCodes.TOO_MANY_REQUESTS, 'Too many requests')
          }

          const authentication = yield* User.Authentication

          const user = yield* authentication.fromToken({ namespace, token })

          if (Option.isNone(user)) {
            return close(SocketCloseCodes.UNAUTHORIZED, 'Unauthorized')
          }

          const tier = Option.getOrThrow(Option.map(user, (user) => user.tier))
          const usage = yield* Usage.Usage

          const checkParams = {
            namespace,
            userId: Option.getOrThrow(Option.map(user, (user) => user.id)),
            publicKey,
          }

          const checkResult = yield* Effect.all(
            [usage.checkDeviceCount(checkParams), usage.checkVaultCount(checkParams)],
            {
              mode: 'either',
            },
          ).pipe(Effect.provideService(User.Tier, tier), Effect.map(Either.all))

          if (Either.isLeft(checkResult)) {
            return close(checkResult.left.code, checkResult.left.message)
          }

          const identity = DurableObjectIdentitySchema.make({
            namespace,
            publicKey,
            userId: Option.map(user, (user) => user.id),
            userEmail: Option.map(user, (user) => user.email),
          })

          const workerHeaders = identity.assignTo(new Headers(request.headers))
          workerHeaders.set('x-tier', tierEncode(tier))

          const durableObjectIdentity = identity.id()

          const durableObject = yield* CloudflareBindings.CloudflareBindings.use((bindings) =>
            bindings.getDurableObjectNamespace(bindingName),
          ).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.dieMessage(`Durable Object Namespace not found: ${bindingName}`),
                onSome: (_) => Effect.succeed(_ as unknown as DurableObjectNamespace<SyncServerDurableObject>),
              }),
            ),
          )

          const durableObjectId = durableObject.idFromName(durableObjectIdentity)
          const stub = durableObject.get(durableObjectId)

          return yield* Effect.promise((signal) =>
            stub.fetch(
              new Request(`http://localhost${syncPath}`, {
                method: request.method,
                headers: workerHeaders,
                body: request.body,
                cf: request.cf,
                signal,
              } as RequestInit),
            ),
          )
        }

        if (request.method === 'POST' && pathname.startsWith(rpcPath)) {
          const upgradeHeader = request.headers.get('Upgrade')

          if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response(null, {
              status: 426,
              statusText: 'Durable Object expected Upgrade: websocket',
            })
          }

          const identityEither = DurableObjectIdentitySchema.fromHeaders(request.headers)

          if (Either.isLeft(identityEither)) {
            const error = Effect.runSync(HttpApiError.HttpApiDecodeError.fromParseError(identityEither.left))
            return new Response(JSON.stringify(error), { status: 400 })
          }

          const identity = identityEither.right

          const durableObjectIdentity = identity.id()

          const durableObject = yield* CloudflareBindings.CloudflareBindings.use((bindings) =>
            bindings.getDurableObjectNamespace(bindingName),
          ).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.dieMessage(`Durable Object Namespace not found: ${bindingName}`),
                onSome: (_) => Effect.succeed(_ as unknown as DurableObjectNamespace<SyncServerDurableObject>),
              }),
            ),
          )
          const durableObjectId = durableObject.idFromName(durableObjectIdentity)
          const stub = durableObject.get(durableObjectId)

          return yield* Effect.promise((signal) =>
            stub.fetch(
              new Request(`http://localhost${rpcPath}`, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                cf: request.cf,
                signal,
              } as RequestInit),
            ),
          )
        }

        return new Response(null, { status: 404 })
      })

      return program.pipe(Effect.provide(pipe(options.layer, withBaseLayer(env, context))), (_) =>
        Effect.runPromise(_, { signal: request.signal }),
      )
    },
  } satisfies ExportedHandler<any>
}
