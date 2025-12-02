import { FileSystem, Path } from '@effect/platform'
import { Context, Data, Effect, pipe, Schema } from 'effect'
import { findWorkspaceRoot } from 'nx/src/utils/find-workspace-root'

export const WorkspacePath = Schema.String.pipe(Schema.brand('WorkspacePath'))
export type WorkspacePath = typeof WorkspacePath.Type

export const ProjectPath = Schema.String.pipe(Schema.brand('ProjectPath'))
export type ProjectPath = typeof ProjectPath.Type

export const ProjectName = Schema.String.pipe(Schema.brand('ProjectName'))
export type ProjectName = typeof ProjectName.Type

export const ProjectLocation = Schema.String.pipe(
  Schema.filter((_) => _.split('/').length > 1, {
    message: () => "ProjectLocation must be a valid path, like 'project/web'",
  }),
  Schema.brand('ProjectLocation'),
)
export type ProjectLocation = typeof ProjectLocation.Type

export interface Workspace {
  readonly _tag: 'Workspace'
  readonly root: WorkspacePath
  readonly projectRoot: string
  readonly projectPrefix: string
  readonly projectPath: ProjectPath
  readonly projectLocation: ProjectLocation
  readonly projectName: ProjectName
  readonly projectOutput: ProjectOutput
}

export const Workspace_ = Data.tagged<Workspace>('Workspace')
export const Workspace = Context.GenericTag<Workspace>('@thing:workspace')

export interface ProjectOutput {
  readonly _tag: 'ProjectOutput'
  readonly root: string
  readonly dist: string
}
export const ProjectOutput = Data.tagged<ProjectOutput>('ProjectOutput')

const findPaths = Effect.fn('workspace.find-paths')(function* (cwd: string) {
  const path = yield* Path.Path

  const fullPathCwd = path.isAbsolute(cwd) ? cwd : path.join(process.cwd(), cwd)

  const root = findWorkspaceRoot(fullPathCwd)

  if (!root) {
    return yield* Effect.dieMessage(`Could not find workspace root from ${fullPathCwd}`)
  }

  return {
    root: root.dir,
    projectPath: fullPathCwd,
  }
})

const findPackageJson = Effect.fn('workspace.find-package-json')(function* (root: string, startPath: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  let currentPath = startPath
  while (true) {
    const packageJsonPath = path.join(currentPath, 'package.json')

    const exists = yield* fs.exists(packageJsonPath)

    if (exists) {
      return yield* fs.readFileString(packageJsonPath)
    }

    if (currentPath === root || currentPath === path.dirname(currentPath)) {
      break
    }

    currentPath = path.dirname(currentPath)
  }

  return yield* Effect.dieMessage(`Could not find package.json from ${startPath}`)
})

export const make = Effect.fn('workspace.make')(function* (cwd: string) {
  const path = yield* Path.Path

  const paths = yield* findPaths(cwd)

  const packageJson = yield* pipe(
    findPackageJson(paths.root, paths.projectPath),
    Effect.andThen((_) => JSON.parse(_) as { name: string }),
  )

  const root = WorkspacePath.make(paths.root)
  const projectRoot = ProjectPath.make(path.resolve(paths.projectPath, '..'))
  const projectPrefix = path.basename(projectRoot)
  const projectName = ProjectName.make(packageJson.name.replace('@xstack/', ''))
  const projectLocation = ProjectLocation.make(
    path.join(projectRoot.replace(paths.root, ''), path.basename(paths.projectPath)),
  )
  const projectPath = ProjectPath.make(paths.projectPath)

  const output = ProjectOutput({
    root: path.join(root, 'dist'),
    dist: path.join(root, 'dist', projectLocation),
  })

  return Workspace_({
    root,
    projectRoot,
    projectPrefix,
    projectPath,
    projectLocation,
    projectName,
    projectOutput: output,
  })
})
