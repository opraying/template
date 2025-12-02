import { FileSystem, Path } from '@effect/platform'
import { Effect, pipe } from 'effect'
import type { Unstable_Config } from 'wrangler'
import type { NodeEnv, Stage } from '../domain'
import { shellInPath } from '../utils'
import { CF } from './api'

const workersUploadBlackList = ['build.json', '.env']

const varRejectList = ['PORT', 'DOTENV_PUBLIC_KEY', 'DOTENV_PUBLIC_KEY_TEST', 'DOTENV_PUBLIC_KEY_PRODUCTION']

const varSecretMatchList = [/_TOKEN$/, /_API_TOKEN$/, /_API_KEY$/, /_SECRET$/, /_KEY$/, /_WEBHOOK$/]

const getVars = (env: Record<string, any>) => {
  const envVars = Object.fromEntries(
    Object.keys(env)
      .filter((key) => {
        if (varRejectList.includes(key)) {
          return false
        }

        return true
      })
      .map((key) => {
        const isSecret = varSecretMatchList.some((_) => _.test(key))

        return [
          key,
          {
            value: env[key],
            type: isSecret ? 'secret_text' : 'plain_text',
          },
        ]
      }),
  )

  return envVars
}

type WorkersDeployParams = {
  accountId: string
  apiToken: string
  nodeEnv: NodeEnv
  dist: string
  stage: Stage
  env: Record<string, any>
}

export const runWorkersDeploy = Effect.fn('cloudflare.workers-deploy')(function* (
  projectName: string,
  wranglerConfig: Unstable_Config,
  { accountId, apiToken, nodeEnv, dist, stage, env }: WorkersDeployParams,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cf = yield* CF

  const entryFilename = path.basename(wranglerConfig.main!).replace('.ts', '.js')

  let deployArgs = ''
  deployArgs += 'deploy'
  deployArgs += ` ${entryFilename}`
  if (stage !== 'production') {
    deployArgs += ` --env="${stage}"`
  }
  deployArgs += ' --no-bundle'

  if (stage !== 'production') {
    deployArgs += ' --latest'
  }

  const finalVars = getVars(env)
  // key:value key2:value2
  let vars = ''
  Object.entries(finalVars).map(([key, value]) => {
    if (value.type === 'plain_text') {
      vars += `${key}:${value.value} `
    }
  })
  if (vars) {
    deployArgs += ` --var ${vars}`
  }

  const tmpDir = yield* fs.makeTempDirectory().pipe(Effect.orDie)

  const backup = shellInPath(dist)`
    $ for file in ${workersUploadBlackList.join(' ')}; do [ -e "$file" ] && mv "$file" ${tmpDir}/ || true; done
  `.pipe(Effect.orDie)

  const restore = shellInPath(dist)`
    $ for file in ${workersUploadBlackList.join(' ')}; do [ -e "${tmpDir}/$file" ] && mv "${tmpDir}/$file" . || true; done
    $ rm -rf ${tmpDir}
  `.pipe(Effect.orDie)

  const deployCommand = `wrangler ${deployArgs}`

  const deploy = shellInPath(dist)`
    $ export CLOUDFLARE_API_TOKEN="${apiToken}"
    $ export CLOUDFLARE_ACCOUNT_ID="${accountId}"
    $ export NODE_ENV="${nodeEnv}"
    $ export STAGE="${stage}"
    $ ${deployCommand}
  `.pipe(Effect.withSpan('cloudflare.deploy'))

  yield* Effect.logDebug('Executing Cloudflare Worker deploy').pipe(Effect.annotateLogs('deployArgs', deployArgs))

  yield* pipe(
    backup,
    Effect.zipRight(
      cf
        .createTmpWorkerVersion({
          projectName,
          vars: finalVars,
          wranglerConfig,
        })
        .pipe(
          Effect.catchTag('NoSuchElementException', () => Effect.logInfo('ignore update worker vars')),
          Effect.catchAllCause(Effect.logError),
        ),
    ),
    Effect.flatMap((result) =>
      Effect.onExit(deploy, () =>
        Effect.all([
          restore,
          result ? cf.deleteWorkerVersion(result.worker.id, result.version.id).pipe(Effect.ignoreLogged) : Effect.void,
          result
            ? cf.cleanupWorkerVersions({ workerId: result.worker.id, keepLatest: 10 }).pipe(Effect.ignoreLogged)
            : Effect.void,
        ]),
      ),
    ),
  )

  yield* Effect.logDebug('Cloudflare Workers Deployment created')
})
