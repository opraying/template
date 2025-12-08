import type { KVNamespace } from '@cloudflare/workers-types'
import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'
import { CF } from '../cloudflare/api'
import type { EmailBuildSubcommand, EmailDeploySubcommand } from './domain'
import { shellInPath } from '../utils/shell'
import type { Workspace } from '../workspace'
import { EMAIL_TEMPLATE_PREFIX, EmailKV } from '../constants'

interface CompiledTemplate {
  name: string
  content: string
}

const getTemplates = Effect.fn('email.get-templates')(function* (projectRoot: string, options: { emailBin: string }) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const emailsPath = path.join(projectRoot, 'emails')
  const templatesPath = path.join(emailsPath, 'templates')
  const outputPath = path.join(emailsPath, '.rendered')

  const hasTemplates = yield* fs.exists(templatesPath).pipe(
    Effect.withSpan('email.check-templates-exist', {
      attributes: {
        templatesPath,
        projectRoot,
      },
    }),
  )

  const templates: CompiledTemplate[] = []

  if (!hasTemplates) {
    yield* Effect.logInfo('Skip empty email templates')
    return templates
  }

  yield* Effect.logInfo('Starting email templates compilation...')

  yield* shellInPath(emailsPath)`$ ${options.emailBin} build ./templates`.pipe(
    Effect.ignoreLogged,
    Effect.withSpan('email.compile-templates', {
      attributes: {
        emailBin: options.emailBin,
        emailsPath,
        templatesPath,
        outputPath,
      },
    }),
  )

  yield* Effect.logInfo('Reading compiled templates...')
  const compiledFiles = yield* fs.readDirectory(outputPath).pipe(
    Effect.withSpan('email.read-compiled-directory', {
      attributes: {
        outputPath,
      },
    }),
  )

  if (compiledFiles.length === 0) {
    yield* Effect.logInfo('Skip empty compiled fields')
    return templates
  }

  yield* Effect.forEach(
    compiledFiles.filter((file) => file.endsWith('.html')),
    (file) =>
      Effect.gen(function* () {
        const filePath = path.join(outputPath, file)
        const content = yield* fs.readFileString(filePath)
        const baseName = file.replace(/\.html$/, '')

        const existingTemplate = templates.find((t) => t.name === baseName)

        if (existingTemplate) {
          existingTemplate.content = content
        } else {
          templates.push({
            name: baseName,
            content,
          })
        }
      }),
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.withSpan('email.process-template-files', {
      attributes: {
        fileCount: compiledFiles.filter((file) => file.endsWith('.html')).length,
        outputPath,
      },
    }),
  )

  yield* Effect.logInfo(`Processed ${templates.length} templates`)

  return templates
})

export const build = Effect.fn('email.build')(function* (workspace: Workspace, _subcommand: EmailBuildSubcommand) {
  const path = yield* Path.Path
  const emailBin = path.join(workspace.root, 'node_modules', '.bin', 'email')
  const persistTo = path.join(workspace.root, '.wrangler/state/v3')

  const { Miniflare } = yield* Effect.promise(() => import('miniflare')).pipe(
    Effect.withSpan('email.import-miniflare', {
      attributes: {
        projectName: workspace.projectName,
      },
    }),
  )

  const miniflare = new Miniflare({
    script: '',
    modules: true,
    defaultPersistRoot: persistTo,
    kvPersist: true,
    kvNamespaces: {
      KV: EmailKV.DevKV,
    },
  })

  const env: any = yield* Effect.promise(() => miniflare.getBindings()).pipe(
    Effect.withSpan('email.miniflare-bindings', {
      attributes: {
        persistTo,
        kvNamespace: EmailKV.DevKV,
        projectName: workspace.projectName,
      },
    }),
  )

  const kv = env.KV as KVNamespace

  const templates = yield* getTemplates(workspace.projectRoot, { emailBin }).pipe(
    Effect.withSpan('email.get-templates', {
      attributes: {
        projectRoot: workspace.projectRoot,
        emailBin,
        projectName: workspace.projectName,
      },
    }),
  )

  yield* Effect.forEach(templates, (item) => {
    const key = `${EMAIL_TEMPLATE_PREFIX}::${workspace.projectPrefix}::${item.name}`
    return Effect.tryPromise({
      try: () => kv.put(key, item.content),
      catch: (error) => error as Error,
    })
  }).pipe(
    Effect.withSpan('email.put-templates-to-kv', {
      attributes: {
        templateCount: templates.length,
        kvNamespace: EmailKV.DevKV,
        projectPrefix: workspace.projectPrefix,
        projectName: workspace.projectName,
      },
    }),
  )

  yield* Effect.logInfo('Put email templates to local kv')
})

export const deploy = Effect.fn('email.deploy')(function* (workspace: Workspace, subcommand: EmailDeploySubcommand) {
  const path = yield* Path.Path
  const cf = yield* CF

  const emailBin = path.join(workspace.root, 'node_modules', '.bin', 'email')
  const emailTemplateKV = subcommand.stage === 'test' ? EmailKV.DevKV : EmailKV.ProdKV

  const templates = yield* getTemplates(workspace.projectRoot, { emailBin })

  yield* cf
    .putKV(
      emailTemplateKV,
      templates.map((item) => {
        const key = `${EMAIL_TEMPLATE_PREFIX}::${workspace.projectPrefix}::${item.name}`

        return {
          key,
          value: item.content,
        }
      }),
    )
    .pipe(
      Effect.withSpan('email.deploy-templates-to-kv', {
        attributes: {
          templateCount: templates.length,
          kvNamespace: emailTemplateKV,
          stage: subcommand.stage,
          projectPrefix: workspace.projectPrefix,
          projectName: workspace.projectName,
          environment: subcommand.stage === 'test' ? 'development' : 'production',
        },
      }),
    )

  yield* Effect.logInfo('Deploy email templates successfully')
}, Effect.provide(CF.Live))

export const existEmailProject = Effect.fn('email.exist-email-project')(function* (workspace: Workspace) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const paths = [path.join(workspace.projectRoot, 'emails', 'project.json')]

  return yield* Effect.reduce(paths, false, (acc, path) => {
    if (acc) return Effect.succeed(acc)
    return fs.exists(path)
  })
})
