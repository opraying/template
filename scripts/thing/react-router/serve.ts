import { Path } from '@effect/platform'
import { ip as ipAddress } from 'address'
import {
  Array,
  Cause,
  Effect,
  HashMap,
  Layer,
  List,
  Logger,
  LogLevel,
  type LogSpan,
  pipe,
  Predicate,
  Runtime,
} from 'effect'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Tracer from 'effect/Tracer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSecureServer } from 'node:http2'
import { resolve } from 'node:path'
import type { Duplex } from 'node:stream'
import { type AppLoadContext, createRequestHandler, type RequestHandler } from 'react-router'
import { tsImport } from 'tsx/esm/api'
import type { Connect } from 'vite'
import { WebSocketServer, type WebSocket as WebSocketType } from 'ws'
import { getPlatformProxy } from '../cloudflare/wrangler'
import { type ServeSubcommand } from '../domain'
import { BuildReactRouterParameters } from './domain'
import { Workspace } from '../workspace'
import { launchEditor } from './launch-editor'
import { otelForward } from './otel-forward'
import { createRequestListener } from './server'

const extractTraceId = (traceParent: string) => {
  const splitId = traceParent.split('-')

  const version = splitId[0]
  const traceId = splitId[1]
  const parentId = splitId[2]
  const flags = splitId[3]

  return {
    flags,
    parentId,
    traceId,
    version,
  }
}

const withParentRequestTrace =
  <A, E, R>(request: Request) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const traceParent = request.headers.get('traceparent')

    let requestSpan: Tracer.ExternalSpan | undefined

    if (traceParent) {
      const { parentId, traceId } = extractTraceId(traceParent)
      if (!traceId || !parentId) {
        return effect
      }

      requestSpan = Tracer.externalSpan({
        spanId: parentId,
        traceId,
        sampled: true,
      })

      return Effect.withParentSpan(effect, requestSpan)
    }

    return effect
  }

function humanize(times: string[]) {
  const [delimiter, separator] = [',', '.']
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, `$1${delimiter}`))
  return orderTimes.join(separator)
}

interface LoadContextParams {
  env: Record<string, any>
  caches: globalThis.CacheStorage
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
}

interface HandleAppLoadContext {
  env: Record<string, any>
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
  runtime: ManagedRuntime.ManagedRuntime<never, never>
  globalHandleRequestTraceSpan?: Tracer.AnySpan | undefined
}

type make = <A>(
  layer: Layer.Layer<A>,
  options?: {
    getLoadContext?: (params: LoadContextParams) => Record<string, any>
  },
) => {
  getLoadContext: (params: LoadContextParams) => HandleAppLoadContext
}

function time(start: number) {
  const delta = Date.now() - start
  return humanize([delta < 1e3 ? `${delta}ms` : `${Math.round(delta / 1e3)}s`])
}

function colorStatus(status: number) {
  const out = {
    7: `\x1B[35m${status}\x1B[0m`,
    5: `\x1B[31m${status}\x1B[0m`,
    4: `\x1B[33m${status}\x1B[0m`,
    3: `\x1B[36m${status}\x1B[0m`,
    2: `\x1B[32m${status}\x1B[0m`,
    1: `\x1B[32m${status}\x1B[0m`,
    0: `\x1B[33m${status}\x1B[0m`,
  } as Record<number, string>
  const calculateStatus = (status / 100) | 0
  return out[calculateStatus]
}

const defaultDateFormat = (date: Date): string =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`

const withColor = (text: string, ...colors: ReadonlyArray<string>) => {
  let out = ''
  for (let i = 0; i < colors.length; i++) {
    out += `\x1b[${colors[i]}m`
  }
  return `${out + text}\x1b[0m`
}

const colors = {
  bold: '1',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  cyan: '36',
  white: '37',
  gray: '90',
  black: '30',
  bgBrightRed: '101',
} as const

const logLevelColors: Record<LogLevel.LogLevel['_tag'], ReadonlyArray<string>> = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warning: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black],
}

const filterKeyName = (key: string) => key.replace(/[\s="]/g, '_')

const renderLogSpanLogFmt = (self: LogSpan.LogSpan): string => {
  const label = filterKeyName(self.label)
  return `${label}=${self.startTime}ms`
}

const logBrowserLog = (json_: {
  message: string
  logLevel: string
  timestamp: string
  annotations: Record<string, string>
  spans: Record<string, string>
  fiberId: string
  cause: unknown
}) => {
  const color = withColor
  try {
    const json = {
      message: json_.message,
      logLevel: LogLevel.fromLiteral(
        // ALL -> All
        (json_.logLevel.slice(0, 1) + json_.logLevel.slice(1, json_.logLevel.length).toLowerCase()) as LogLevel.Literal,
      ),
      timestamp: defaultDateFormat(new Date(json_.timestamp)),
      annotations: HashMap.fromIterable(Object.entries(json_.annotations)),
      spans: List.fromIterable<LogSpan.LogSpan>(
        Object.entries(json_.spans).map(([label, startTime]) => ({
          label,
          startTime: Number(startTime),
        })),
      ),
      fiberId: json_.fiberId,
      cause: json_.cause ? Cause.fail(json_.cause) : Cause.empty,
    }

    const message = Array.ensure(json.message)
    let firstLine =
      color(`[${json.timestamp}]`, colors.white) +
      ` ${color(json.logLevel.label, ...logLevelColors[json.logLevel._tag])}` +
      ` (${json.fiberId})` +
      ` ${color('CLIENT', colors.red)}`

    if (List.isCons(json.spans)) {
      for (const span of json.spans) {
        firstLine += ` ${renderLogSpanLogFmt(span)}`
      }
    }

    firstLine += ':'
    let messageIndex = 0
    if (message.length > 0) {
      const firstMaybeString = message[0]
      if (typeof firstMaybeString === 'string') {
        firstLine += ` ${color(firstMaybeString, colors.bold, colors.cyan)}`
        messageIndex++
      }
    }

    console.log(firstLine)
    console.group()

    if (!Cause.isEmpty(json.cause)) {
      console.log(Cause.pretty(json.cause, { renderErrorCause: true }))
    }

    if (messageIndex < message.length) {
      for (; messageIndex < message.length; messageIndex++) {
        console.log(message[messageIndex])
      }
    }

    if (HashMap.size(json.annotations) > 0) {
      for (const [key, value] of json.annotations) {
        console.log(`${color(key, colors.bold, colors.white)} =`, value)
      }
    }

    console.groupEnd()
  } catch {
    console.error(json_)
  }
}

function log(out: boolean, method: string, path: string, status = 0, elapsed = '') {
  const decodePath = decodeURIComponent(path)

  if (['/v1/traces', '/v1/metrics', '/v1/logs'].some((v) => decodePath.indexOf(v) > -1)) {
    return Effect.void
  }

  const str = !out ? `----> ${method} ${decodePath}` : `<---- ${method} ${decodePath} ${colorStatus(status)} ${elapsed}`

  if (status >= 500) {
    return Effect.logError(str)
  }

  return Effect.logInfo(str)
}

interface OtelWebSocketMessage {
  id: string
  type: 'traces' | 'logs' | 'metrics' | 'dev-logs'
  params: any
  data: number[]
}

export const start = Effect.fn('react-router.serve-start')(function* (subcommand: ServeSubcommand) {
  const path = yield* Path.Path
  const workspace = yield* Workspace
  const contextFilePath = `${workspace.projectPath}/context.dev.ts`
  const parameters = yield* BuildReactRouterParameters
  const tsconfigPath = path.join(workspace.projectPath, 'tsconfig.app.json')

  if (subcommand.target._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid target')
  }

  /**
   * TODO:
   * 新增 vite 插件，当 context.dev, .env 文件改变时，重新加载
   */
  const { contextBuilder } = yield* Effect.promise(
    () =>
      tsImport(contextFilePath, {
        parentURL: import.meta.url,
        tsconfig: tsconfigPath,
      }) as Promise<{
        contextBuilder: ReturnType<make>
      }>,
  ).pipe(Effect.tap(Effect.logInfo('Import Context Builder')), Effect.tapErrorCause(Effect.logError), Effect.orDie)

  if (!contextBuilder) {
    return yield* Effect.dieMessage('No contextBuilder function export found')
  }

  const wrangler = yield* getPlatformProxy({ workspace })

  const viteDevServer = yield* Effect.promise(() =>
    import('vite').then(({ createServer }) => {
      try {
        const server = createServer({
          configFile: `${workspace.projectPath}/vite.config.ts`,
          appType: 'custom',
          env: {},
          server: {
            allowedHosts: true,
            middlewareMode: true,
            hmr: {
              overlay: true,
              clientPort: 443,
              path: '/vite-hmr',
            },
          },
        })

        return server
      } catch (e) {
        return Promise.reject(e)
      }
    }),
  ).pipe(
    Effect.tapErrorCause(Effect.logError),
    Effect.tap(Effect.logInfo('Create Vite Server')),
    Effect.withSpan('vite.createServer'),
  )

  const port = viteDevServer.config.server.port
  const httpsConfig = viteDevServer.config.server.https

  if (!port) {
    return yield* Effect.dieMessage('No port found')
  }

  if (!httpsConfig) {
    return yield* Effect.dieMessage('No https config found')
  }

  const ws = new WebSocketServer({ noServer: true })

  // Handle WebSocket connections
  const otel = otelForward()

  const otelHandler = createRequestListener((request) => {
    const { pathname } = new URL(request.url)

    if (request.method === 'POST' && pathname.startsWith('/traces')) {
      return otel.traces(request.body).then((_) => Response.json(_))
    }
    if (request.method === 'POST' && pathname.startsWith('/logs')) {
      return otel.logs(request.body).then((_) => Response.json(_))
    }
    if (request.method === 'POST' && pathname.startsWith('/metrics')) {
      return otel.metrics(request.body).then((_) => Response.json(_))
    }

    return new Response(null, { status: 404 })
  })

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  function handleOtelWebSocket(ws: WebSocketType) {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as OtelWebSocketMessage
        const id = data.id
        const binaryData = new Uint8Array(data.data)

        const ack = (id: string, error?: string) => ws.send(encoder.encode(JSON.stringify({ type: 'ack', id, error })))

        switch (data.type) {
          case 'logs':
            await otel.logs(binaryData)
            ack(id)
            break
          case 'traces':
            await otel.traces(binaryData)
            ack(id)
            break
          case 'metrics':
            await otel.metrics(binaryData)
            ack(id)
            break
          case 'dev-logs':
            logBrowserLog(JSON.parse(decoder.decode(binaryData)))
            ack(id)
            break
          default:
            ack(id, 'Invalid message type')
        }
      } catch (error) {
        ws.send(
          encoder.encode(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          ),
        )
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error)
    })
  }

  const launchEditorEndpoint = '/__inspect-open-in-editor'

  const launchEditorHandler = createRequestListener(async (req) => {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams.entries()) as any

    if (!params.fileName) {
      return new Response(null, { status: 400 })
    }

    const fileName = resolve(workspace.root, params.fileName)

    await launchEditor(
      {
        filePath: fileName,
        lineNumber: params.lineNumber,
        colNumber: params.colNumber,
      },
      params.editor ? [params.editor] : ['zed'],
    )

    return new Response(null, { status: 200 })
  })

  const loadContext = async () => {
    const context = contextBuilder.getLoadContext({
      env: {
        ...parameters.env,
        ...wrangler.env,
      },
      caches: wrangler.caches as any,
      waitUntil: wrangler.ctx.waitUntil.bind(wrangler.ctx),
      passThroughOnException: wrangler.ctx.passThroughOnException.bind(wrangler.ctx),
    })

    return context as unknown as HandleAppLoadContext
  }

  const building = yield* Effect.makeSemaphore(1)

  let routerHandler: RequestHandler

  const createHandler = pipe(
    Effect.all(
      [
        pipe(
          Effect.sleep(100),
          Effect.zipRight(
            Effect.promise(() => viteDevServer.ssrLoadModule('virtual:react-router/server-build') as Promise<any>),
          ),
          Effect.withSpan('ReactRouter.loadServerBuild'),
          Effect.tap((serverBuild) => {
            routerHandler = createRequestHandler(serverBuild, 'development')
          }),
          Effect.withSpan('ReactRouter.createRequestHandler'),
        ),
        Effect.sleep(400),
      ],
      {
        concurrency: 'unbounded',
      },
    ),
    Effect.map(([_]) => _),
    building.withPermits(1),
  )

  yield* createHandler

  const rt = yield* Effect.runtime<never>()
  const runPromise = Runtime.runPromise(rt)

  viteDevServer.watcher.on('all', (type, path) => {
    const ignorePatterns = [
      /\.tsx$/,
      /\.html$/,
      /\.mjs$/,
      /\.js$/,
      /\.json$/,
      /\.jsonc$/,
      /\vite-config\.ts$/,
      /public/,
    ]

    if (ignorePatterns.some((pattern) => pattern.test(path))) {
      // console.log('File ignored:', type, path)
      return
    }

    // console.log('File changed:', type, path)
    return runPromise(createHandler)
  })

  const handler = createRequestListener((request) => {
    const method = request.method
    const url = new URL(request.url)
    const path = `${url.pathname}${url.search}`
    const start = Date.now()

    return pipe(
      Effect.gen(function* () {
        yield* log(false, method, path)

        yield* building.take(1)
        yield* building.release(1)

        Object.assign(globalThis, {
          i18nDetectRequestHook: (detect: any) => detect(request),
        })

        const appLoadContext = yield* Effect.promise(loadContext)

        const runtime = appLoadContext.runtime

        const disableTrace = false // [/^\/__manifest/].some((reg) => reg.test(url.pathname))

        return yield* Effect.promise(() =>
          pipe(
            Effect.gen(function* () {
              // trigger i18n init
              // @ts-ignore
              const value = globalThis.initI18n()

              yield* Effect.promise(() => (Predicate.isPromiseLike(value) ? value : Promise.resolve(value))).pipe(
                Effect.withSpan('ReactRouter.initI18n'),
              )

              const { readable, writable } = new TransformStream()

              let flag = false
              request.signal.addEventListener('abort', () => {
                if (!flag) {
                  flag = true
                  pipe(appLoadContext.runtime.disposeEffect, Effect.runPromise)
                }
              })

              const response: Response = yield* pipe(
                Effect.currentSpan,
                Effect.tap((traceSpan) => {
                  if (!disableTrace) {
                    appLoadContext.globalHandleRequestTraceSpan = traceSpan
                  }
                }),
                Effect.zipRight(
                  Effect.promise(() => routerHandler(request, appLoadContext as unknown as AppLoadContext)),
                ),
                Effect.orElseSucceed(() => new Response('Internal Server Error', { status: 500 })),
                Effect.withSpan('ReactRouter.handleRequest'),
              )

              if (response.body) {
                response
                  .body!.pipeTo(writable, {
                    signal: request.signal,
                    preventAbort: true,
                    preventCancel: true,
                    preventClose: false,
                  })
                  .finally(() => {
                    if (!request.signal.aborted && !flag) {
                      flag = true
                      return appLoadContext.runtime.dispose()
                    }
                  })
                  .catch(() => {})
              } else {
                const writer = writable.getWriter()
                writer.close()
                if (!request.signal.aborted && !flag) {
                  flag = true
                  appLoadContext.runtime.dispose()
                }
              }

              const internalErrorStatus = response.headers.get('X-Error-Status')

              if (internalErrorStatus) {
                response.headers.delete('X-Error-Status')
              }

              const status = request.signal.aborted
                ? 499
                : internalErrorStatus
                  ? parseInt(internalErrorStatus, 10)
                  : response.status

              return new Response(readable, {
                status,
                statusText: response.statusText,
                headers: response.headers,
              })
            }),
            Effect.tap((response) =>
              Effect.annotateCurrentSpan({
                'http.response.status_code': response.status,
                'http.status_code': response.status,
              }),
            ),
            Effect.withSpan('ReactRouter.handle', {
              attributes: {
                'http.request.method': request.method,
                'http.method': request.method,
                'url.full': request.url,
                'http.url': request.url,
              },
            }),
            withParentRequestTrace(request),
            Effect.withTracerEnabled(!disableTrace),
            runtime.runPromise,
          ),
        )
      }),
      Effect.tap((res) => {
        const status = res.status || 200
        const elapsed = time(start)

        return log(true, method, path, status, elapsed)
      }),
      Effect.catchAllCause((cause) =>
        log(true, method, path, 500, time(start)).pipe(
          Effect.annotateLogs('error', Cause.pretty(cause)),
          Effect.as(new Response('Internal Server Error', { status: 500 })),
        ),
      ),
      Effect.provide(Logger.replace(Logger.defaultLogger, Logger.prettyLogger())),
      Logger.withMinimumLogLevel(LogLevel.All),
      Effect.withLogSpan('server'),
      Effect.runPromise,
    )
  })

  const server = yield* Effect.sync(() =>
    createSecureServer(
      {
        cert: httpsConfig.cert,
        key: httpsConfig.key,
        allowHTTP1: true,
      },
      (req, res) => {
        const server = viteDevServer.middlewares
          .use('/v1', (req: Connect.IncomingMessage, res: ServerResponse<Connect.IncomingMessage>) =>
            otelHandler(req, res),
          )
          .use(launchEditorEndpoint, (req: Connect.IncomingMessage, res: ServerResponse<Connect.IncomingMessage>) =>
            launchEditorHandler(req, res),
          )
          .use((req: Connect.IncomingMessage, res: ServerResponse<Connect.IncomingMessage>) => handler(req, res))

        return server(req as any, res as any)
      },
    ),
  ).pipe(Effect.withSpan('http.create-server'))

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const { pathname } = new URL(req.url || '', `https://${req.headers.host || 'localhost'}`)

      if (pathname.startsWith('/telemetry')) {
        ws.handleUpgrade(req, socket, head, (websocket) => {
          handleOtelWebSocket(websocket)
        })
        return
      }

      // reject other websocket connection
      socket.destroy()
    } catch (error) {
      console.error('WebSocket Error in upgrade handler:', error)
      socket.destroy()
    }
  })

  ws.on('error', (error) => {
    console.error('WebSocket server error:', error)
  })

  server.on('error', async (error) => {
    console.log('Server error:', error)
    ws.close()
    await viteDevServer.close()
    process.exit(1)
  })

  const localUrl = `https://localhost:${port}`
  let lanUrl: string | null = null
  const localIp = ipAddress() ?? 'Unknown'
  // Check if the address is a private ip
  // https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
  // https://github.com/facebook/create-react-app/blob/d960b9e38c062584ff6cfb1a70e1512509a966e7/packages/react-dev-utils/WebpackDevServerUtils.js#LL48C9-L54C10
  if (/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(localIp)) {
    lanUrl = `https://${localIp}:${port}`
  }

  yield* Effect.addFinalizer(
    Effect.fn('react-router.serve-stop')(function* () {
      yield* Effect.promise(() => viteDevServer.close()).pipe(Effect.ignore)
      yield* Effect.try(() => ws.close()).pipe(Effect.ignore)
      yield* Effect.try(() => server.close()).pipe(Effect.ignore)

      yield* Effect.logInfo('Dev Server stopped 🛏️')
    }),
  )

  server.listen(port)

  yield* Effect.logInfo('Starting the development server 🚀').pipe(
    Effect.annotateLogs({
      local: localUrl,
      network: lanUrl,
    }),
  )

  return yield* Effect.never.pipe(Effect.withSpan('react-router.serve'))
})
