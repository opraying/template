import { type APIError, Cloudflare } from 'cloudflare'
import { Cause, Config, Data, Effect, Encoding, Layer, Option, Predicate, pipe } from 'effect'
import type { Unstable_Config } from 'wrangler'

export const CloudflareConfig = Config.all({
  ACCOUNT_ID: Config.string('CLOUDFLARE_ACCOUNT_ID'),
  ACCOUNT_EMAIL: Config.string('CLOUDFLARE_EMAIL'),
  API_TOKEN: Config.string('CLOUDFLARE_API_TOKEN'),
})

class CloudflareError extends Data.TaggedError('CloudflareError')<{
  status: number
  errors: Array<{
    code?: number
    message?: string
  }>
}> {
  get message() {
    return this.toString()
  }

  toString() {
    return `CloudflareError: ${this.status} - ${this.errors.map((e) => `${e.code}: ${e.message}`).join(', ')}`
  }

  static fromApiError(error: APIError) {
    return new CloudflareError({
      status: error.status ?? 500,
      errors: error.errors,
    })
  }
}

const make = Effect.gen(function* () {
  const { ACCOUNT_ID, ACCOUNT_EMAIL, API_TOKEN } = yield* CloudflareConfig

  const ins = new Cloudflare({
    apiToken: API_TOKEN,
    apiEmail: ACCOUNT_EMAIL,
  })

  const use = <A>(fn: (ins: Cloudflare) => Promise<A>) =>
    Effect.tryPromise({
      try: () => fn(ins),
      catch: (e) => {
        if (Predicate.hasProperty('status') && Predicate.hasProperty('errors')) {
          return CloudflareError.fromApiError(e as APIError)
        }

        return new CloudflareError({
          status: 500,
          errors: [{ code: 500, message: JSON.stringify(e) }],
        })
      },
    })

  const getWorker = ({ projectName }: { projectName: string }) =>
    use((api) => api.workers.beta.workers.get(projectName, { account_id: ACCOUNT_ID })).pipe(
      Effect.mapError((error) => {
        if (error.status === 404) {
          return new Cause.NoSuchElementException()
        }
        return error
      }),
      Effect.withSpan('cloudflare.getWorker'),
    )

  const latestWorkersVersion = ({ workerId }: { workerId: string }) =>
    pipe(
      use((ins) =>
        ins.workers.beta.workers.versions.list(workerId, {
          account_id: ACCOUNT_ID,
        }),
      ),
      Effect.mapError((error) => {
        if (error.status === 404) {
          return new Cause.NoSuchElementException()
        }
        return error
      }),
      Effect.map((res) => res.result),
      Effect.flatMap((_) => Option.fromNullable(_[0])),
      Effect.catchTag('CloudflareError', Effect.die),
      Effect.withSpan('cloudflare.latestWorkersVersion'),
    )

  const createTmpWorkerVersion = Effect.fn('cloudflare.update-workers-env')(function* ({
    projectName,
    vars,
    wranglerConfig,
  }: {
    projectName: string
    vars: Record<string, { value: string; type: string }>
    wranglerConfig: Unstable_Config
  }) {
    const worker = yield* getWorker({ projectName })
    const lastVersion = yield* latestWorkersVersion({ workerId: worker.id })

    const envBindings: Cloudflare.Workers.Beta.Workers.Versions.VersionCreateParams['bindings'] = Object.entries(
      vars,
    ).map(
      ([key, value]) =>
        ({
          name: key,
          text: value.value,
          type: value.type,
        }) as any,
    )

    const newBindings = lastVersion.bindings ?? []

    envBindings.forEach((binding) => {
      let existIndex = newBindings.findIndex((b) => b.name === binding.name)
      if (existIndex !== -1) {
        newBindings[existIndex] = binding
      } else {
        newBindings.push(binding)
      }
    })

    const doClasses: string[] = []
    const workflowsClasses: string[] = []
    if (wranglerConfig.durable_objects?.bindings) {
      const bindings = wranglerConfig.durable_objects.bindings ?? []
      bindings.forEach((_) => {
        doClasses.push(`export class ${_.class_name} {}`)
      })
    }
    if (wranglerConfig.workflows) {
      const workflows = wranglerConfig.workflows ?? []
      workflows.forEach((_) => {
        workflowsClasses.push(`export class ${_.name} {}`)
      })
    }

    const dummyScript = Encoding.encodeBase64(`
      export default {
        fetch() {
          return new Response("Hello, world!");
        }
      }
      ${doClasses.join('\n')}
      ${workflowsClasses.join('\n')}
    `)

    const modules: Cloudflare.Workers.Beta.Workers.Versions.VersionCreateParams['modules'] = [
      {
        name: 'index.js',
        content_type: 'application/javascript+module',
        content_base64: dummyScript,
      },
    ]

    const newVersion = yield* use((ins) =>
      ins.workers.beta.workers.versions.create(worker.id, {
        account_id: ACCOUNT_ID,
        annotations: {
          'workers/message': 'Updated variables from api',
          'workers/tag': 'Temporary version',
        },
        main_module: 'index.js',
        compatibility_date: lastVersion.compatibility_date!,
        compatibility_flags: lastVersion.compatibility_flags!,
        usage_model: 'standard',
        assets: lastVersion.assets!,
        limits: lastVersion.limits ?? { cpu_ms: 30 },
        modules: modules,
        placement: lastVersion.placement ?? {},
        migrations: lastVersion.migrations!,
        bindings: envBindings,
      }),
    ).pipe(Effect.withSpan('cloudflare.createWorkersTmpVersion'))

    yield* Effect.logInfo('Update worker environment variables success')

    return { version: newVersion, worker }
  })

  const deleteWorkerVersion = Effect.fn('cloudflare.delete-worker-version')(function* (
    workerId: string,
    versionId: string,
  ) {
    return yield* use((ins) =>
      ins.workers.beta.workers.versions.delete(workerId, versionId, { account_id: ACCOUNT_ID }),
    )
  })

  const cleanupWorkerVersions = Effect.fn('cloudflare.cleanup-worker-versions')(function* ({
    workerId,
    keepLatest = 10,
  }: {
    workerId: string
    keepLatest?: number
  }) {
    const versions = yield* use(async (ins) => {
      const collected: Array<Cloudflare.Workers.Beta.Workers.Versions.Version> = []
      let currentPage = await ins.workers.beta.workers.versions.list(workerId, {
        account_id: ACCOUNT_ID,
        per_page: 100,
      })

      collected.push(...(currentPage.result ?? []))

      while (currentPage.hasNextPage()) {
        currentPage = await currentPage.getNextPage()
        collected.push(...(currentPage.result ?? []))
      }

      return collected
    })

    const apiVersions = versions.filter((version) => version.source === 'api')
    const sortedNonApiVersions = versions
      .filter((version) => version.source !== 'api')
      .slice()
      .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))

    if (apiVersions.length === 0 && sortedNonApiVersions.length <= keepLatest) {
      yield* Effect.logInfo('cloudflare.cleanup-worker-versions skipped').pipe(
        Effect.annotateLogs({
          workerId,
          keepLatest,
          versionCount: versions.length,
          apiVersionCount: apiVersions.length,
        }),
      )
      return
    }

    const staleNonApiVersions = sortedNonApiVersions.slice(keepLatest)

    const staleVersionMap = new Map<string, Cloudflare.Workers.Beta.Workers.Versions.Version>()
    apiVersions.forEach((version) => staleVersionMap.set(version.id, version))
    staleNonApiVersions.forEach((version) => staleVersionMap.set(version.id, version))

    const staleVersions = Array.from(staleVersionMap.values())

    if (staleVersions.length === 0) {
      yield* Effect.logInfo('cloudflare.cleanup-worker-versions skipped')
      return
    }

    yield* Effect.logInfo('cloudflare.cleanup-worker-versions start').pipe(
      Effect.annotateLogs({
        workerId,
        keepLatest,
        deleteCount: staleVersions.length,
        versionCount: versions.length,
        apiVersionCount: apiVersions.length,
      }),
    )

    yield* Effect.forEach(
      staleVersions,
      (version) =>
        deleteWorkerVersion(workerId, version.id).pipe(
          Effect.zipRight(
            Effect.logInfo('Deleted worker version').pipe(Effect.annotateLogs({ workerId, versionId: version.id })),
          ),
          Effect.catchAllCause((cause) => Effect.logWarning('Failed to delete worker version', cause)),
        ),
      { concurrency: 10, discard: true },
    )
  })

  const getWorkersDeployment = Effect.fn('cloudflare.get-workers-deployment')(function* (
    projectName: string,
    wranglerConfig: Unstable_Config,
  ) {
    const previewUrls = new Set<string>()
    const branchUrls = new Set<string>()

    wranglerConfig.routes?.forEach((config) => {
      branchUrls.add(typeof config === 'string' ? config : config.pattern)
    })

    if (wranglerConfig.workers_dev) {
      previewUrls.add(`${projectName}.opraying.workers.dev`)
    }

    return {
      branchUrls: Array.from(branchUrls),
      previewUrls: Array.from(previewUrls),
    }
  })

  const putKV = (namespaceId: string, body: Cloudflare.KV.Namespaces.KeyBulkUpdateParams['body']) =>
    use((ins) =>
      ins.kv.namespaces.bulkUpdate(namespaceId, {
        account_id: ACCOUNT_ID,
        body,
      }),
    ).pipe(Effect.orDie)

  return {
    accountId: ACCOUNT_ID,
    apiToken: API_TOKEN,

    // ----- Workers -----
    createTmpWorkerVersion,
    deleteWorkerVersion,
    cleanupWorkerVersions,
    getWorkersDeployment,

    // ----- KV -----
    putKV,
  }
})

export class CF extends Effect.Tag('@thing:cf')<CF, Effect.Effect.Success<typeof make>>() {
  static Live = Layer.effect(this, make)
}
