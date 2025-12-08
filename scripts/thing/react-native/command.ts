import { Command } from '@effect/cli'
import { Effect } from 'effect'
import {
  nativeBundlerOption,
  nativeHeadOption,
  nativeBaseOption,
  nativeBuildCacheOption,
  nativeBuildClearCacheOption,
  nativeBuildFreezeCredentialsOption,
  nativeBuildJsonOption,
  nativeBuildLocalOption,
  nativeBuildLoggerOption,
  nativeBuildMessageOption,
  nativeBuildOutputOption,
  nativeBuildPlatformOption,
  nativeBuildProfileOption,
  nativeBuildWaitOption,
  nativeCleanOption,
  nativeCwdOption,
  nativeDeploySubmitBuildIdOption,
  nativeDeploySubmitJsonOption,
  nativeDeploySubmitLatestOption,
  nativeDeploySubmitNonInteractiveOption,
  nativeDeploySubmitPathOption,
  nativeDeploySubmitPlatformOption,
  nativeDeploySubmitProfileOption,
  nativeDeploySubmitVerboseOption,
  nativeDeploySubmitWaitOption,
  nativeDeviceOption,
  nativeAnalyzeMinifyOption,
  nativeAnalyzeBytecodeOption,
  nativeAnalyzeClearOption,
  nativeAnalyzeDevOption,
  nativeAnalyzePlatformOption,
  nativeInstallOption,
  nativeJsChannelOption,
  nativeJsDryRunOption,
  nativeJsEnvOption,
  nativeJsForceOption,
  nativeJsMessageOption,
  nativeJsPlatformOption,
  nativeJsTargetVersionOption,
  nativeRunPlatformOption,
  nativeRunPortOption,
  nativeSchemeOption,
  nativeVariantOption,
  nativeXcodeConfigurationOption,
  nativePrebuildCleanOption,
} from './options'
import {
  ReactNativeAnalyzeSubcommand,
  ReactNativeBuildSubcommand,
  ReactNativeDeployCheckSubcommand,
  ReactNativeDeploySubmitSubcommand,
  ReactNativeDeployJsUpdateSubcommand,
  ReactNativePrebuildSubcommand,
  ReactNativeRunSubcommand,
} from './domain'
import * as Native from './subcommand'
import * as Workspace from '../workspace'
import type { Workspace as WorkspaceModel } from '../workspace'

const withWorkspace = <R, E>(cwd: string, f: (workspace: WorkspaceModel) => Effect.Effect<void, E, R>) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.make(cwd)
    return yield* f(workspace)
  })

const prebuildCommand = Command.make(
  'prebuild',
  {
    cwd: nativeCwdOption,
    platform: nativeBuildPlatformOption,
    install: nativeInstallOption,
    clean: nativePrebuildCleanOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.prebuild(
        workspace,
        ReactNativePrebuildSubcommand({
          cwd: config.cwd,
          platform: config.platform,
          install: config.install,
          clean: config.clean,
        }),
      ),
    ),
)

const buildCommand = Command.make(
  'build',
  {
    cwd: nativeCwdOption,
    platform: nativeBuildPlatformOption,
    profile: nativeBuildProfileOption,
    local: nativeBuildLocalOption,
    json: nativeBuildJsonOption,
    wait: nativeBuildWaitOption,
    clearCache: nativeBuildClearCacheOption,
    message: nativeBuildMessageOption,
    buildLoggerLevel: nativeBuildLoggerOption,
    freezeCredentials: nativeBuildFreezeCredentialsOption,
    output: nativeBuildOutputOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.build(
        workspace,
        ReactNativeBuildSubcommand({
          cwd: config.cwd,
          platform: config.platform,
          profile: config.profile,
          local: config.local,
          json: config.json,
          wait: config.wait,
          clearCache: config.clearCache,
          message: config.message,
          buildLoggerLevel: config.buildLoggerLevel,
          freezeCredentials: config.freezeCredentials,
          output: config.output,
        }),
      ),
    ),
)

const runCommand = Command.make(
  'run',
  {
    cwd: nativeCwdOption,
    platform: nativeRunPlatformOption,
    device: nativeDeviceOption,
    scheme: nativeSchemeOption,
    variant: nativeVariantOption,
    xcodeConfiguration: nativeXcodeConfigurationOption,
    port: nativeRunPortOption,
    bundler: nativeBundlerOption,
    buildCache: nativeBuildCacheOption,
    clean: nativeCleanOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.run(
        workspace,
        ReactNativeRunSubcommand({
          cwd: config.cwd,
          platform: config.platform,
          device: config.device,
          scheme: config.scheme,
          variant: config.variant,
          xcodeConfiguration: config.xcodeConfiguration,
          port: config.port,
          bundler: config.bundler,
          buildCache: config.buildCache,
          clean: config.clean,
        }),
      ),
    ),
)

const analyzeCommand = Command.make(
  'analyze',
  {
    cwd: nativeCwdOption,
    base: nativeBaseOption,
    head: nativeBaseOption,
    platform: nativeRunPlatformOption,
    minify: nativeAnalyzeMinifyOption,
    bytecode: nativeAnalyzeBytecodeOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.analyze(
        workspace,
        ReactNativeAnalyzeSubcommand({
          cwd: config.cwd,
          base: config.base,
          head: config.head,
          platform: config.platform,
          minify: config.minify,
          bytecode: config.bytecode,
        }),
      ),
    ),
)

const deployCheckCommand = Command.make(
  'deploy-check',
  {
    cwd: nativeCwdOption,
    platform: nativeJsPlatformOption,
    base: nativeBaseOption,
    head: nativeHeadOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.deployCheck(
        workspace,
        ReactNativeDeployCheckSubcommand({
          cwd: config.cwd,
          platform: config.platform,
          base: config.base,
          head: config.head,
        }),
      ),
    ),
)

const deployJsUpdateCommand = Command.make(
  'deploy-js-update',
  {
    cwd: nativeCwdOption,
    env: nativeJsEnvOption,
    base: nativeBaseOption,
    head: nativeHeadOption,
    channel: nativeJsChannelOption,
    platform: nativeJsPlatformOption,
    message: nativeJsMessageOption,
    dryRun: nativeJsDryRunOption,
    force: nativeJsForceOption,
    targetVersion: nativeJsTargetVersionOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.deployJsUpdate(
        workspace,
        ReactNativeDeployJsUpdateSubcommand({
          cwd: config.cwd,
          env: config.env,
          base: config.base,
          head: config.head,
          channel: config.channel,
          platform: config.platform,
          message: config.message,
          dryRun: config.dryRun,
          force: config.force,
          targetVersion: config.targetVersion,
        }),
      ),
    ),
)

const deploySubmitCommand = Command.make(
  'deploy-submit',
  {
    cwd: nativeCwdOption,
    platform: nativeDeploySubmitPlatformOption,
    profile: nativeDeploySubmitProfileOption,
    path: nativeDeploySubmitPathOption,
    buildId: nativeDeploySubmitBuildIdOption,
    latest: nativeDeploySubmitLatestOption,
    nonInteractive: nativeDeploySubmitNonInteractiveOption,
    wait: nativeDeploySubmitWaitOption,
    json: nativeDeploySubmitJsonOption,
    verbose: nativeDeploySubmitVerboseOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Native.deploySubmit(
        workspace,
        ReactNativeDeploySubmitSubcommand({
          cwd: config.cwd,
          platform: config.platform,
          profile: config.profile,
          path: config.path,
          buildId: config.buildId,
          latest: config.latest,
          nonInteractive: config.nonInteractive,
          wait: config.wait,
          json: config.json,
          verbose: config.verbose,
        }),
      ),
    ),
)

export const nativeCommand = Command.make('native').pipe(
  Command.withSubcommands([
    prebuildCommand,
    runCommand,
    buildCommand,
    analyzeCommand,
    deployCheckCommand,
    deployJsUpdateCommand,
    deploySubmitCommand,
  ]),
)
