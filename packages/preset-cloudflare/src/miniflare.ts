import type {
  D1Database,
  DurableObjectNamespace,
  KVNamespace,
  Queue,
  R2Bucket,
  Socket,
  SocketAddress,
  SocketOptions,
  Workflow,
} from '@cloudflare/workers-types'
import * as dotenv from '@dotenvx/dotenvx'
import { FileSystem, Path } from '@effect/platform'
import { workspaceRoot } from '@nx/devkit'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { parseConfig } from '@xstack/cloudflare/runtime'
import getPorts, { portNumbers } from '@xstack/server/port'
import { ConfigProvider, Context, Effect, Exit, Layer, LogLevel as LogLevelE, Random, Runtime, Schema } from 'effect'
import { Log, LogLevel, Miniflare as MiniflareBase, type MiniflareOptions, type WorkerOptions } from 'miniflare'
import type { Unstable_Config } from 'wrangler'

const ignoreEnv = [
  'DOTENV_PUBLIC_KEY',
  'DOTENV_PUBLIC_KEY_TEST',
  'DOTENV_PUBLIC_KEY_PRODUCTION',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
]

export declare namespace Workflows {
  export type StepSelector = {
    name: string
    index?: number
  }

  export type UserEvent = {
    type: string
    payload: unknown
  }

  export type InstanceStatus = {
    status:
      | 'queued' // means that instance is waiting to be started (see concurrency limits)
      | 'running'
      | 'paused'
      | 'errored'
      | 'terminated' // user terminated the instance while it was running
      | 'complete'
      | 'waiting' // instance is hibernating and waiting for sleep or event to finish
      | 'waitingForPause' // instance is finishing the current work to pause
      | 'unknown'
    error?: string
    output?: object
  }

  export interface InstanceModifier {
    disableSleeps(steps?: StepSelector[] | undefined): Promise<void>
    mockStepResult(step: StepSelector, stepResult: unknown): Promise<void>
    mockStepError(step: StepSelector, error: Error, times?: number | undefined): Promise<void>
    forceStepTimeout(step: StepSelector, times?: number | undefined): Promise<void>
    mockEvent(event: UserEvent): Promise<void>
    forceEventTimeout(step: StepSelector): Promise<void>
  }

  export type WithModifier = Workflow & {
    unsafeGetInstanceModifier: (instanceId: string) => Promise<InstanceModifier>
    unsafeWaitForStepResult: (name: string, instanceId: string, index?: number | undefined) => Promise<unknown>
    unsafeAbort: (instanceId: string, reason?: string | undefined) => Promise<void>
    unsafeWaitForStatus: (instanceId: string, status: InstanceStatus['status']) => Promise<void>
  }
}
class WorkflowIntrospectorInstance {
  private getBindings: () => Record<string, unknown>
  private name: string
  private id: string

  private ins: Workflows.InstanceModifier | undefined

  constructor(getBindings: () => Record<string, unknown>, name: string, id: string) {
    this.getBindings = getBindings
    this.name = name
    this.id = id
  }

  private getBinding() {
    const bindings = this.getBindings()
    const binding = bindings[this.name] as Workflows.WithModifier

    return binding
  }

  private async getIns() {
    if (this.ins) return this.ins
    const bindings = this.getBindings()
    const binding = bindings[this.name] as Workflows.WithModifier
    let ins = await binding.unsafeGetInstanceModifier(this.id)
    this.ins = ins
    return ins
  }

  waitForStepResult(name: string, index?: number | undefined) {
    const binding = this.getBinding()
    return Effect.promise(async () => {
      return await binding.unsafeWaitForStepResult(name, this.id, index)
    })
  }

  abort(reason?: string | undefined) {
    const binding = this.getBinding()
    return Effect.promise(async () => {
      return await binding.unsafeAbort(this.id, reason)
    })
  }

  waitForStatus(status: Workflows.InstanceStatus['status']) {
    const binding = this.getBinding()
    return Effect.promise(async () => {
      return await binding.unsafeWaitForStatus(this.id, status)
    })
  }

  status() {
    const binding = this.getBinding()
    return Effect.promise(async () => {
      const ins = await binding.get(this.id)
      return await ins.status()
    })
  }

  disableSleeps(...args: Parameters<Workflows.InstanceModifier['disableSleeps']>) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      return await ins.disableSleeps(...args)
    })
  }

  mockStepResult(step: Workflows.StepSelector, stepResult: any) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      const exit = Schema.ExitFromSelf({ success: Schema.Any, defect: Schema.Defect, failure: Schema.Defect })
      const encode = Schema.encodeUnknownSync(exit)
      const result = encode(Exit.succeed(stepResult))

      return await ins.mockStepResult(step, JSON.parse(JSON.stringify(result)))
    })
  }

  mockStepError(step: Workflows.StepSelector, error: Error, times?: number | undefined) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      const exit = Schema.ExitFromSelf({
        success: Schema.Any,
        defect: Schema.Defect,
        failure: Schema.Defect,
      })
      const exitJson = Schema.parseJson(exit)
      const encode = Schema.encodeUnknownSync(exitJson)

      const result = encode(Exit.fail(error.message))

      return await ins.mockStepError(step, new Error(result), times)
    })
  }

  forceStepTimeout(...args: Parameters<Workflows.InstanceModifier['forceStepTimeout']>) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      return await ins.forceStepTimeout(...args)
    })
  }

  mockEvent(...args: Parameters<Workflows.InstanceModifier['mockEvent']>) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      return await ins.mockEvent(...args)
    })
  }

  forceEventTimeout(...args: Parameters<Workflows.InstanceModifier['forceEventTimeout']>) {
    return Effect.promise(async () => {
      const ins = await this.getIns()
      return await ins.forceEventTimeout(...args)
    })
  }
}
/**
 * Empty array and wait for all promises to resolve until no more added.
 * If a single promise rejects, the rejection will be passed-through.
 * If multiple promises reject, the rejections will be aggregated.
 */
async function waitForWaitUntil(/* mut */ waitUntil: unknown[]): Promise<void> {
  const errors: unknown[] = []

  while (waitUntil.length > 0) {
    const results = await Promise.allSettled(waitUntil.splice(0))
    // Record all rejected promises
    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(result.reason)
      }
    }
  }

  if (errors.length === 1) {
    // If there was only one rejection, rethrow it
    throw errors[0]
  } else if (errors.length > 1) {
    // If there were more rejections, rethrow them all
    throw new AggregateError(errors)
  }
}

export type TestWorkersModule = {
  path: string
  bundle?: boolean | undefined
}

export type TestWorkersConfigModule = WorkerOptions

export type TestWorkersOptions = {
  cwd?: string | undefined
  tsconfig?: string | undefined
  env?: Record<string, string | undefined> | undefined
  alias?: Record<string, string> | undefined
  logLevel?: LogLevelE.Literal | undefined
  port?: number | undefined
} & (
  | {
      persist: string
    }
  | {
      persist?: false | undefined
    }
)

type Fetcher = {
  fetch(input: globalThis.RequestInfo | URL, init?: globalThis.RequestInit): Promise<globalThis.Response>
  connect(address: SocketAddress | string, options?: SocketOptions): Socket
}

const normalizePersistName = (name: string) => {
  return name.replace('.test.ts', '')
}

type MiniflareOperations = {
  readonly getCf: () => Effect.Effect<Record<string, any>>
  readonly getInspectorURL: () => Effect.Effect<URL>
  readonly url: () => Effect.Effect<URL>
  readonly setOptions: (opts: MiniflareOptions) => Effect.Effect<void>

  readonly fetch: (input: URL | RequestInfo, init?: RequestInit | undefined) => Effect.Effect<Response>
  readonly fetchPromise: (input: URL | RequestInfo, init?: RequestInit | undefined) => Promise<Response>
  readonly waitWaitUntil: () => Effect.Effect<void>
  readonly waitUntil: (promise: Promise<void>) => void

  readonly unsafeGetDirectURL: (workerName: string) => Effect.Effect<URL, never, never>
  readonly getBindings: <Env = Record<string, unknown>>(workerName?: string | undefined) => Effect.Effect<Env>
  readonly getWorker: (workerName?: string | undefined) => Effect.Effect<{
    fetch: Fetcher['fetch']
  }>
  readonly getCaches: () => Effect.Effect<CacheStorage>
  readonly getD1Database: (bindingName: string, workerName?: string | undefined) => Effect.Effect<D1Database>
  readonly getDurableObjectNamespace: (
    bindingName: string,
    workerName?: string | undefined,
  ) => Effect.Effect<DurableObjectNamespace>
  readonly getKVNamespace: (bindingName: string, workerName?: string | undefined) => Effect.Effect<KVNamespace>
  readonly getQueueProducer: <Body = unknown>(
    bindingName: string,
    workerName?: string | undefined,
  ) => Effect.Effect<Queue<Body>>
  readonly getR2Bucket: (bindingName: string, workerName?: string | undefined) => Effect.Effect<R2Bucket>

  readonly workflows: {
    readonly get: (name: string, instanceId: string) => Effect.Effect<WorkflowIntrospectorInstance>
    readonly getAll: () => Effect.Effect<WorkflowIntrospectorInstance[]>
    readonly dispose: () => Effect.Effect<void>
    readonly modifyAll: (callback: (item: WorkflowIntrospectorInstance) => Effect.Effect<void>) => Effect.Effect<void>
  }
}

const make = (
  options: TestWorkersOptions,
  workers: {
    configs?: TestWorkersConfigModule[] | undefined
    module?: TestWorkersModule[] | undefined
  },
) =>
  Effect.gen(function* () {
    const min = yield* Random.nextIntBetween(8500, 8600)
    const max = yield* Random.nextIntBetween(8700, 8800)

    const port =
      options.port ??
      (yield* Effect.tryPromise(() => getPorts({ port: portNumbers(min, max) })).pipe(Effect.repeatN(3)))

    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    let env: Record<string, string> = {}

    if (options.cwd) {
      env =
        dotenv.config({
          envKeysFile: path.join(workspaceRoot, '.env.keys'),
          path: [path.join(options.cwd, '.env'), path.join(options.cwd, '.env.local')],
          quiet: true,
          ignore: ['MISSING_ENV_FILE'],
          processEnv: {},
        }).parsed || {}

      ignoreEnv.forEach((key) => {
        delete env[key]
      })
    }

    const persistEnabled = typeof options.persist === 'string' ? true : !!options.persist
    const persistName = typeof options.persist === 'string' ? normalizePersistName(options.persist) : 'default'

    const persistRoot = path.join(workspaceRoot, '.wrangler', 'testing', persistName)

    if (persistEnabled && !(yield* fs.exists(persistRoot))) {
      yield* fs.makeDirectory(persistRoot, { recursive: true })
    }
    const workersCompiledPath = path.join(workspaceRoot, '.wrangler', 'testing', persistName, 'workers')

    if (persistEnabled && !(yield* fs.exists(workersCompiledPath))) {
      yield* fs.makeDirectory(workersCompiledPath)
    }

    const miniflareCachePath = 'miniflare'
    const cachePersistPath = path.join(miniflareCachePath, 'cache')
    const d1PersistPath = path.join(miniflareCachePath, 'd1')
    const kvPersistPath = path.join(miniflareCachePath, 'kv')
    const r2PersistPath = path.join(miniflareCachePath, 'r2')
    const durableObjectsPersistPath = path.join(miniflareCachePath, 'durable-objects')
    const workflowsPersistPath = path.join(miniflareCachePath, 'workflows')
    const analyticsEngineDatasetsPersistPath = path.join(miniflareCachePath, 'analytics-engine-datasets')

    const cachePersist = path.join(persistRoot, cachePersistPath)
    const d1Persist = path.join(persistRoot, d1PersistPath)
    const kvPersist = path.join(persistRoot, kvPersistPath)
    const r2Persist = path.join(persistRoot, r2PersistPath)
    const durableObjectsPersist = path.join(persistRoot, durableObjectsPersistPath)
    const workflowsPersist = path.join(persistRoot, workflowsPersistPath)
    const analyticsEngineDatasetsPersist = path.join(persistRoot, analyticsEngineDatasetsPersistPath)

    const workersWranglerConfigs = yield* Effect.forEach(
      workers.module ?? [],
      (config) =>
        parseConfig(config.path).pipe(
          Effect.map((_) => {
            return {
              bundle: config.bundle,
              wranglerConfig: _.config,
              path: _.path,
            }
          }),
        ),
      {
        concurrency: 'unbounded',
      },
    )

    const workersFiles: Map<
      string,
      Array<{
        path: string
        filename: string
        main: boolean
        content: string | undefined
      }>
    > = new Map()

    const bundler = yield* Effect.tryPromise({
      try: () => import('rolldown'),
      catch: () => new Error('rolldown not found'),
    }).pipe(Effect.orDie)

    yield* Effect.forEach(
      workersWranglerConfigs,
      Effect.fn(function* (config) {
        const { wranglerConfig } = config
        const workersName = wranglerConfig.name!
        const workersEntry = wranglerConfig.main!

        if (config.bundle) {
          const tsconfigPath = options.tsconfig ?? path.join(path.dirname(wranglerConfig.configPath!), 'tsconfig.json')

          const results = yield* Effect.promise(() =>
            bundler.build({
              input: workersEntry,
              platform: 'browser',
              external: [/^cloudflare:/, /^node:/],
              tsconfig: tsconfigPath,
              write: false,
              experimental: {
                attachDebugInfo: 'simple',
              },
              optimization: {
                inlineConst: true,
              },
              transform: {
                target: 'esnext',
                define: {
                  'process.env.NODE_ENV': JSON.stringify('development'),
                  'process.env.STAGE': JSON.stringify('test'),
                },
              },
              resolve: {
                mainFields: ['browser', 'module', 'main'],
              },
              treeshake: true,
              output: {
                format: 'esm',
                legalComments: 'none',
                minify: {
                  codegen: { removeWhitespace: false },
                  compress: {
                    keepNames: {
                      class: true,
                      function: true,
                    },
                    target: 'esnext',
                  },
                  mangle: false,
                },
                esModule: true,
                sourcemap: true,
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
                // 如果持久化则拆分方便 Debug，否则不拆分
                ...(persistEnabled
                  ? {
                      advancedChunks: {
                        groups: [
                          {
                            name: 'react',
                            test: /node_modules[\\/]react/,
                            priority: 1,
                          },
                          {
                            name: 'effect',
                            test: /node_modules[\\/]effect/,
                            priority: 1,
                          },
                          {
                            name: 'effect-platform',
                            test: /node_modules[\\/]@effect\/platform/,
                            priority: 1,
                          },
                          {
                            test: /node_modules/,
                            name: 'libs',
                          },
                        ],
                      },
                    }
                  : {
                      file: `${workersName}.js`,
                    }),
              },
            }),
          )

          const files = results.output.map((file) => {
            const filename = path.basename(file.fileName)
            const isMain = file.type === 'chunk'
            return {
              path: path.join(workersCompiledPath, workersName, file.fileName),
              filename,
              main: isMain,
              content: file.type === 'chunk' ? file.code : '',
            }
          })

          workersFiles.set(workersName, files)

          if (persistEnabled) {
            const savePath = path.join(workersCompiledPath, workersName)

            if (!(yield* fs.exists(savePath))) {
              yield* fs.makeDirectory(savePath)
            }

            yield* Effect.forEach(
              results.output,
              Effect.fn(function* (output) {
                if (output.type === 'asset') {
                  yield* fs.writeFile(
                    path.join(savePath, output.fileName),
                    output.source.slice() as Uint8Array<ArrayBufferLike>,
                  )
                }
                if (output.type === 'chunk') {
                  yield* fs.writeFileString(path.join(savePath, output.fileName), output.code)
                }
              }),
              {
                concurrency: 'unbounded',
              },
            )
          }
        }
      }),
      { concurrency: 3 },
    ).pipe(Effect.orDie)

    const testEnv = {
      NODE_ENV: 'development',
      STAGE: 'test',
      LOG_LEVEL: options.logLevel ?? LogLevelE.All._tag,
      TEST: true,
    }

    const globalWaitUntil: unknown[] = []
    function registerGlobalWaitUntil(promise: unknown) {
      globalWaitUntil.push(promise)
    }
    const waitUntilMap = new Map<string, PromiseWithResolvers<any>>()

    const workflowInstanceIntrospectors: Array<{ name: string; id: string }> = []
    const modifierCallbacks: Array<(item: WorkflowIntrospectorInstance) => Effect.Effect<void>> = []
    let workflowIntrospectorsRt: Runtime.Runtime<never>

    const runWorkflowModifierCallback = async () => {
      const bindings = await miniflare.getBindings()

      await Runtime.runPromise(
        workflowIntrospectorsRt,
        Effect.gen(function* () {
          for (let item of workflowInstanceIntrospectors) {
            yield* Effect.forEach(
              modifierCallbacks,
              Effect.fnUntraced(function* (cb) {
                yield* cb(new WorkflowIntrospectorInstance(() => bindings, item.name, item.id))
              }),
              { concurrency: 'unbounded' },
            )
          }
        }),
      )
    }

    // workflow introspector
    const workflows = {
      get: Effect.fnUntraced(function* (name: string, instanceId: string) {
        const bindings = yield* Effect.promise(() => miniflare.getBindings())

        return new WorkflowIntrospectorInstance(() => bindings, name, instanceId)
      }),
      getAll: Effect.fnUntraced(function* () {
        const bindings = yield* Effect.promise(() => miniflare.getBindings())
        return workflowInstanceIntrospectors.map(
          (item) => new WorkflowIntrospectorInstance(() => bindings, item.name, item.id),
        )
      }),
      dispose: Effect.fnUntraced(function* () {
        const bindings = yield* Effect.promise(() => miniflare.getBindings())

        for (const item of workflowInstanceIntrospectors) {
          const binding = bindings[item.name] as Workflows.WithModifier

          // await binding.unsafeAbort(item.id, 'Instance dispose')
        }
      }),
      modifyAll: Effect.fnUntraced(function* (callback: (item: WorkflowIntrospectorInstance) => Effect.Effect<void>) {
        workflowIntrospectorsRt = yield* Effect.runtime<never>()
        modifierCallbacks.push(callback)
      }),
    }

    const wranglerWorkers: WorkerOptions[] = workersWranglerConfigs
      .map((_) => _.wranglerConfig)
      .map((config) => {
        const mainScript = (workersFiles.get(config.name!) ?? []).find((script) => !!script.main)

        const serviceBindings = {
          ...Object.fromEntries(
            (config.services || []).map((_) => {
              return [
                _.binding,
                {
                  name: _.service,
                  entrypoint: _.entrypoint,
                },
              ]
            }),
          ),

          ...(config.workflows.length > 0
            ? {
                async DEV_WORKFLOW_PROXY(request: Request) {
                  if (request.method !== 'POST') {
                    return Response.json({ error: 'Method not allowed' }, { status: 405 })
                  }
                  const url = new URL(request.url)
                  const bindings = await miniflare.getBindings()

                  if (url.pathname === '/workflow') {
                    const body: any = await request.json()
                    const method = body.method
                    const { binding, args } = body

                    const workflowBinding = bindings[binding] as Workflow | undefined
                    if (!workflowBinding) {
                      return Response.json({ error: `Binding ${binding} not found` })
                    }

                    try {
                      if (method === 'get') {
                        const result = await workflowBinding.get(args[0])
                        return Response.json({ id: result.id })
                      }
                      if (method === 'create') {
                        if (!args[0].id) {
                          args[0].id = crypto.randomUUID()
                        }
                        const id = args[0].id
                        const result = await workflowBinding.create(args[0])

                        workflowInstanceIntrospectors.push({
                          name: binding,
                          id: id,
                        })

                        await runWorkflowModifierCallback()

                        return Response.json({ id: result.id })
                      }
                      if (method === 'createBatch') {
                        const result = await workflowBinding.createBatch(args[0])
                        return Response.json({ data: result })
                      }
                    } catch (error) {
                      console.error('Workflow proxy error:', error)
                      return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' })
                    }

                    return Response.json({ error: `Unknown method: ${method}` })
                  }

                  if (url.pathname === '/instance') {
                    const body: any = await request.json()
                    const { instanceId, method, binding, args } = body

                    const workflowBinding = bindings[binding] as Workflow | undefined
                    if (!workflowBinding) {
                      return Response.json({ error: `Binding ${binding} not found` })
                    }

                    const instance = await workflowBinding.get(instanceId)
                    if (!instance) {
                      return Response.json({ error: `Instance ${instanceId} not found` })
                    }

                    let result
                    switch (method) {
                      case 'status':
                        result = await instance.status()
                        break
                      case 'pause':
                        try {
                          await instance.pause()
                        } catch (error: any) {
                          result = { error: error.message }
                        }
                        break
                      case 'resume':
                        try {
                          await instance.resume()
                        } catch (error: any) {
                          result = { error: error.message }
                        }
                        break
                      case 'restart':
                        try {
                          await instance.restart()
                        } catch (error: any) {
                          result = { error: error.message }
                        }
                        break
                      case 'terminate':
                        try {
                          await instance.terminate()
                        } catch (error: any) {
                          result = { error: error.message }
                        }
                        break
                      case 'sendEvent':
                        try {
                          await instance.sendEvent(args)
                        } catch (error: any) {
                          result = { error: error.message }
                        }
                        break
                      default:
                        return Response.json({ error: `Unknown instance method: ${method}` })
                    }

                    return Response.json(result ?? {})
                  }
                },
              }
            : {}),

          DEV_WAIT_UNTIL_PROXY: async (request: Request) => {
            const url = new URL(request.url)
            const id = url.searchParams.get('id')
            const status = url.searchParams.get('status')
            const error = url.searchParams.get('error')

            if (!id) {
              return Response.json({ error: 'Missing id parameter' })
            }

            let item = waitUntilMap.get(id)

            if (!item) {
              item = Promise.withResolvers<any>()
              waitUntilMap.set(id, item)
              registerGlobalWaitUntil(item.promise)

              return Response.json({ id })
            }

            if (status === 'resolve') {
              item.resolve(undefined)
              waitUntilMap.delete(id)
              return Response.json({ id })
            }

            if (status === 'reject') {
              item.reject(new Error(error || 'Wait-until rejected'))
              waitUntilMap.delete(id)
              return Response.json({ id })
            }

            return Response.json({ error: 'Invalid status parameter' })
          },
        }

        return {
          name: config.name,
          modules: true,
          // 如果持久化使用 script path 否则 使用 script
          ...(persistEnabled && mainScript
            ? {
                scriptPath: mainScript.path,
                modulesRoot: workersCompiledPath,
              }
            : {
                script: mainScript?.content ?? generateDummyScript(config),
              }),
          compatibilityFlags: config.compatibility_flags,
          compatibilityDate: config.compatibility_date,
          cache: true,
          d1Databases: Object.fromEntries(
            config.d1_databases.map((_) => {
              return [_.binding, _.database_id || '']
            }),
          ),
          kvNamespaces: Object.fromEntries(
            config.kv_namespaces.map((_) => {
              return [_.binding, _.id || '']
            }),
          ),
          r2Buckets: Object.fromEntries(
            config.r2_buckets.map((_) => {
              return [_.binding, _.bucket_name || '']
            }),
          ),
          durableObjects: Object.fromEntries(
            config.durable_objects.bindings.map((_) => {
              return [
                _.name,
                {
                  className: _.class_name,
                  scriptName: _.script_name,
                  useSQLite: true,
                },
              ]
            }),
          ),
          workflows: Object.fromEntries(
            config.workflows.map((_) => {
              return [
                _.binding,
                {
                  name: _.name,
                  className: _.class_name,
                  scriptName: _.script_name,
                },
              ]
            }),
          ),
          analyticsEngineDatasets: Object.fromEntries(
            config.analytics_engine_datasets.map((_) => {
              return [
                _.binding,
                {
                  dataset: _.dataset || '',
                },
              ]
            }),
          ),
          ratelimits: Object.fromEntries(
            config.ratelimits.map((_) => {
              return [
                _.name,
                {
                  namespace_id: _.namespace_id,
                  simple: _.simple,
                },
              ]
            }),
          ),
          ...(config.images
            ? {
                images: {
                  binding: config.images.binding,
                },
              }
            : {}),
          ...(config.browser
            ? {
                browserRendering: {
                  binding: config.browser.binding,
                },
              }
            : {}),
          // ...(config.ai
          //   ? {
          //       ai: {
          //         binding: config.ai.binding,
          //       },
          //     }
          //   : {}),
          // vectorize: Object.fromEntries(
          //   config.vectorize.map((_) => {
          //     return [
          //       _.binding,
          //       {
          //         index_name: _.index_name,
          //       },
          //     ]
          //   }),
          // ),
          queueConsumers: Object.fromEntries(
            (config.queues.consumers ?? []).map((_) => {
              return [
                _.queue,
                {
                  maxBatchSize: _.max_batch_size,
                  maxBatchTimeout: _.max_batch_timeout,
                  maxRetries: _.max_retries,
                  deadLetterQueue: _.dead_letter_queue,
                  retryDelay: _.retry_delay,
                },
              ]
            }),
          ),
          queueProducers: Object.fromEntries(
            (config.queues.producers ?? []).map((_) => {
              return [
                _.binding,
                {
                  queueName: _.queue,
                  deliveryDelay: _.delivery_delay,
                },
              ]
            }),
          ),
          bindings: {
            ...testEnv,
            ...env,
            ...options.env,
          },
          serviceBindings,
          modulesRules: [
            {
              include: ['**/*.js'],
              type: 'ESModule',
            },
          ],
        } satisfies WorkerOptions
      })

    const configWorkers = workers.configs ?? []

    const workersOptions: WorkerOptions[] = wranglerWorkers.concat(configWorkers)

    if (workersOptions.length === 0) {
      workersOptions.push({
        name: 'default',
        modules: true,
        script: "export default { fetch() { return new Response('Hello World!') } }",
        bindings: {
          ...testEnv,
          NAMESPACE: 'test',
          NAME: 'test-react-router',
        },
      })
    }

    const miniflare = new MiniflareBase({
      log: new Log(LogLevel.ERROR), // Logger Miniflare uses for debugging
      liveReload: false,
      port,
      inspectorPort: port - 1,
      ...(persistEnabled
        ? {
            cachePersist,
            d1Persist,
            kvPersist,
            r2Persist,
            durableObjectsPersist,
            workflowsPersist,
            analyticsEngineDatasetsPersist,
          }
        : {}),
      workers: workersOptions,
    })

    yield* Effect.addFinalizer(() => Effect.ignoreLogged(Effect.tryPromise(() => miniflare.dispose())))

    yield* Effect.promise(() => miniflare.ready)

    const getCf = () => Effect.promise(() => miniflare.getCf())

    const getInspectorURL = () => Effect.promise(() => miniflare.getInspectorURL())

    const setOptions = (opts: MiniflareOptions) => Effect.promise(() => miniflare.setOptions(opts))

    const url = Effect.sync(() => new URL(`http://localhost:${port}`))

    const fetch = (input: string | URL, init?: globalThis.RequestInit | undefined) =>
      Effect.promise(() => miniflare.dispatchFetch(input, init as any) as unknown as Promise<Response>)

    const fetchPromise = (input: string | URL, init?: globalThis.RequestInit | undefined) =>
      miniflare.dispatchFetch(input, init as any) as unknown as Promise<Response>

    const waitUntil = (promise: Promise<void>) => registerGlobalWaitUntil(promise)

    const waitWaitUntil = () => Effect.ignoreLogged(Effect.promise(() => waitForWaitUntil(globalWaitUntil)))

    const unsafeGetDirectURL = (workerName: string) => Effect.promise(() => miniflare.unsafeGetDirectURL(workerName))

    const getBindings = <Env = Record<string, unknown>>(workerName?: string | undefined) =>
      Effect.promise(() => miniflare.getBindings<Env>(workerName))

    const getWorker = (workerName?: string | undefined) => Effect.promise(() => miniflare.getWorker(workerName))

    const getCaches = () => Effect.promise(() => miniflare.getCaches())

    const getD1Database = (bindingName: string, workerName?: string | undefined) =>
      Effect.promise(() => miniflare.getD1Database(bindingName, workerName))

    const getDurableObjectNamespace = (bindingName: string, workerName?: string) =>
      Effect.promise(() => miniflare.getDurableObjectNamespace(bindingName, workerName))

    const getKVNamespace = (bindingName: string, workerName?: string | undefined) =>
      Effect.promise(() => miniflare.getKVNamespace(bindingName, workerName))

    const getQueueProducer = <Body = unknown>(bindingName: string, workerName?: string | undefined) =>
      Effect.promise(() => miniflare.getQueueProducer<Body>(bindingName, workerName))

    const getR2Bucket = (bindingName: string, workerName?: string | undefined) =>
      Effect.promise(() => miniflare.getR2Bucket(bindingName, workerName))

    return {
      getCf,
      getInspectorURL,
      setOptions,
      url,
      fetch,
      fetchPromise,
      waitUntil,
      waitWaitUntil,
      unsafeGetDirectURL,
      getBindings,
      getWorker,
      getCaches,
      getD1Database,
      getDurableObjectNamespace,
      getKVNamespace,
      getQueueProducer,
      getR2Bucket,
      workflows,
    } as unknown as MiniflareOperations
  })

export class Miniflare extends Context.Tag('@testing:miniflare')<Miniflare, MiniflareOperations>() {
  static Config: (
    options: TestWorkersOptions,
    workers: {
      configs?: TestWorkersConfigModule[] | undefined
      module?: TestWorkersModule[] | undefined
    },
  ) => Layer.Layer<Miniflare, never, FileSystem.FileSystem | Path.Path> = (
    options: TestWorkersOptions,
    workers: {
      configs?: TestWorkersConfigModule[] | undefined
      module?: TestWorkersModule[] | undefined
    },
    // F**K CF Types
  ) => Layer.scoped(Miniflare, make(options, workers) as any)
}

function generateDummyScript(config: Unstable_Config): string {
  const doClasses: string[] = []
  const workflowsClasses: string[] = []

  if (config.durable_objects?.bindings) {
    const bindings = config.durable_objects.bindings ?? []
    bindings.forEach((_) => {
      doClasses.push(`export class ${_.class_name} {}`)
    })
  }

  if (config.workflows) {
    const workflows = config.workflows ?? []
    workflows.forEach((_) => {
      workflowsClasses.push(`export class ${_.name} {}`)
    })
  }

  const dummyScript = `
    export default {
      fetch() {
        return new Response("Hello, world!")
      }
    };
    ${doClasses.join('\n')}
    ${workflowsClasses.join('\n')}
  `

  return dummyScript
}

export const MiniflareLive = Layer.unwrapScoped(
  Effect.gen(function* () {
    const miniflare = yield* Miniflare
    const bindings = yield* miniflare.getBindings()

    const builtin: Array<[string, any]> = []
    const env = Object.entries(bindings)
      .filter(([_k, v]) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => [k, v as any] as const)
    const envs = env.concat(builtin)

    yield* Effect.addFinalizer(() => miniflare.waitWaitUntil())

    return Layer.mergeAll(
      CloudflareBindings.fromEnv(bindings),
      CacheStorage.fromCaches(globalThis.caches as any),
      CloudflareExecutionContext.fromContext(
        {
          waitUntil: miniflare.waitUntil,
          passThroughOnException: () => {},
          props: {},
        },
        bindings,
      ),
      Layer.setConfigProvider(ConfigProvider.fromMap(new Map(envs))),
    )
  }),
)
