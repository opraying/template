import { Options } from '@effect/cli'

export const nativeCwdOption = Options.text('cwd').pipe(Options.withDescription('Path to the Expo/React Native app'))

export const nativeHeadOption = Options.text('head').pipe(Options.withDescription(''), Options.withDefault(undefined))

export const nativeBaseOption = Options.text('base').pipe(Options.withDescription(''), Options.withDefault(undefined))

export const nativeRunPlatformOption = Options.choice('platform', ['ios', 'android'] as const).pipe(
  Options.withDescription('Target platform for expo run commands'),
  Options.withDefault('ios'),
)

export const nativeCleanOption = Options.boolean('clean').pipe(
  Options.withDescription('Delete native folders and regenerate before running'),
  Options.withDefault(false),
)

export const nativeDeviceOption = Options.text('device').pipe(
  Options.withDescription('Device name or identifier'),
  Options.withDefault(undefined),
)

export const nativeSchemeOption = Options.text('scheme').pipe(
  Options.withDescription('Custom native scheme to run'),
  Options.withDefault(undefined),
)

export const nativeVariantOption = Options.text('variant').pipe(
  Options.withDescription('Android build variant (e.g., debug, release)'),
  Options.withDefault('debug'),
)

export const nativeXcodeConfigurationOption = Options.text('xcode-configuration').pipe(
  Options.withDescription('iOS build configuration (e.g., Debug, Release)'),
  Options.withDefault('Debug'),
)

export const nativeRunPortOption = Options.integer('port').pipe(
  Options.withDescription('Port to start the Metro bundler on'),
  Options.withDefault(8081),
)

export const nativeInstallOption = Options.boolean('install').pipe(
  Options.withDescription('Install the native binary before running'),
  Options.withDefault(false),
)

export const nativeBundlerOption = Options.boolean('bundler', { ifPresent: false }).pipe(
  Options.withDescription('Start the metro bundler automatically'),
  Options.withDefault(true),
)

export const nativeBuildCacheOption = Options.boolean('build-cache', { ifPresent: false }).pipe(
  Options.withDescription('Use derived data cache for builds'),
  Options.withDefault(true),
)
export const nativeBuildPlatformOption = Options.choice('platform', ['ios', 'android', 'all'] as const).pipe(
  Options.withDescription('Target platform for EAS build'),
  Options.withDefault('ios'),
)

export const nativeBuildProfileOption = Options.text('profile').pipe(
  Options.withDescription('EAS build profile'),
  Options.withDefault('preview'),
)

export const nativeBuildLocalOption = Options.boolean('local', { ifPresent: false }).pipe(
  Options.withDescription('Run EAS build locally'),
  Options.withDefault(true),
)

export const nativeBuildOutputOption = Options.text('output').pipe(
  Options.withDescription('Override artifact output path'),
  Options.withDefault(undefined),
)

export const nativeBuildJsonOption = Options.boolean('json').pipe(
  Options.withDescription('Enable JSON output for EAS build'),
  Options.withDefault(false),
)

export const nativeBuildWaitOption = Options.boolean('wait', { ifPresent: false }).pipe(
  Options.withDescription('Wait for builds to complete'),
  Options.withDefault(true),
)

export const nativeBuildClearCacheOption = Options.boolean('clear-cache').pipe(
  Options.withDescription('Clear build cache before running'),
  Options.withDefault(false),
)

export const nativeBuildMessageOption = Options.text('message').pipe(
  Options.withDescription('Short description for the build'),
  Options.withDefault(undefined),
)

export const nativeBuildLoggerOption = Options.choice('build-logger-level', [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const).pipe(Options.withDescription('EAS build logger level'), Options.withDefault(undefined))

export const nativeBuildFreezeCredentialsOption = Options.boolean('freeze-credentials').pipe(
  Options.withDescription('Prevent credential updates in non-interactive mode'),
  Options.withDefault(false),
)

export const nativePrebuildCleanOption = Options.boolean('clean').pipe(
  Options.withDescription('Delete native folders before prebuild'),
  Options.withDefault(false),
)

export const nativeAnalyzePlatformOption = Options.choice('platform', ['all', 'ios', 'android', 'web'] as const).pipe(
  Options.withDescription('Platform bundle to export'),
  Options.withDefault('all'),
)

export const nativeAnalyzeDevOption = Options.boolean('dev').pipe(
  Options.withDescription('Generate a dev build during export'),
  Options.withDefault(false),
)

export const nativeAnalyzeClearOption = Options.boolean('clear').pipe(
  Options.withDescription('Clear metro cache before export'),
  Options.withDefault(false),
)

export const nativeAnalyzeMinifyOption = Options.boolean('minify', { ifPresent: false }).pipe(
  Options.withDescription('Minify bundle output'),
  Options.withDefault(false),
)

export const nativeAnalyzeBytecodeOption = Options.boolean('bytecode').pipe(
  Options.withDescription('Emit Hermes bytecode bundles'),
  Options.withDefault(false),
)

export const nativeJsEnvOption = Options.text('env').pipe(
  Options.withDescription('Deployment environment (maps to hot-updater channels)'),
  Options.withDefault('staging'),
)

export const nativeJsChannelOption = Options.text('channel').pipe(
  Options.withDescription('Explicit hot-updater channel name'),
  Options.withDefault(undefined),
)

export const nativeJsPlatformOption = Options.choice('platform', ['ios', 'android', 'all'] as const).pipe(
  Options.withDescription('Target platform(s) for JS updates'),
  Options.withDefault('all'),
)

export const nativeJsMessageOption = Options.text('message').pipe(
  Options.withDescription('Custom release message for hot-updater deploys'),
  Options.withDefault(undefined),
)

export const nativeJsForceOption = Options.boolean('force', { ifPresent: false }).pipe(
  Options.withDescription('Force publish even if target version is unchanged'),
  Options.withDefault(false),
)

export const nativeJsTargetVersionOption = Options.text('target-version').pipe(
  Options.withDescription('Override runtime target version for JS updates'),
  Options.withDefault(undefined),
)

export const nativeJsDryRunOption = Options.boolean('dry-run').pipe(
  Options.withDescription('Print commands without executing hot-updater'),
  Options.withDefault(false),
)

export const nativeDeploySubmitPlatformOption = Options.choice('platform', ['ios', 'android'] as const).pipe(
  Options.withDescription('Platform to submit to the store'),
  Options.withDefault('ios'),
)

export const nativeDeploySubmitProfileOption = Options.text('profile').pipe(
  Options.withDescription('EAS submit profile declared in eas.json'),
  Options.withDefault('production'),
)

export const nativeDeploySubmitPathOption = Options.text('path').pipe(
  Options.withDescription('Path to a build artifact to submit'),
  Options.withDefault(undefined),
)

export const nativeDeploySubmitBuildIdOption = Options.text('build-id').pipe(
  Options.withDescription('Use a specific EAS build ID for submission'),
  Options.withDefault(undefined),
)

export const nativeDeploySubmitLatestOption = Options.boolean('latest', { ifPresent: false }).pipe(
  Options.withDescription('Submit the latest EAS build when no explicit artifact is provided'),
  Options.withDefault(true),
)

export const nativeDeploySubmitNonInteractiveOption = Options.boolean('non-interactive', {
  ifPresent: false,
}).pipe(Options.withDescription('Disable interactive prompts during eas submit'), Options.withDefault(true))

export const nativeDeploySubmitWaitOption = Options.boolean('wait', { ifPresent: false }).pipe(
  Options.withDescription('Wait for the submission to finish'),
  Options.withDefault(true),
)

export const nativeDeploySubmitJsonOption = Options.boolean('json').pipe(
  Options.withDescription('Emit JSON output from eas submit'),
  Options.withDefault(false),
)

export const nativeDeploySubmitVerboseOption = Options.boolean('verbose', {
  ifPresent: false,
}).pipe(Options.withDescription('Enable verbose logging for eas submit'), Options.withDefault(false))
