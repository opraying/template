import path from 'node:path'
import type { StageContext, StageDefinition } from './types'
import {
  desktopDistRoot,
  discoverNativeArtifact,
  ensureDirRelative,
  ensureEnvVars,
  fileExistsRelative,
  getAndroidArtifactPath,
  getAndroidProfile,
  getAndroidSubmitProfile,
  getAffectedNativeProjects,
  getIosArtifactPath,
  getIosProfile,
  getIosSubmitProfile,
  listFilesRecursive,
  nativeDistRoot,
  repoRoot,
} from './utils'

const getNativeBuildEnv = () => {
  const hermesDir =
    process.env.REACT_NATIVE_OVERRIDE_HERMES_DIR ?? path.resolve(repoRoot, 'node_modules', 'hermes-compiler', 'hermesc')
  const easLocalPlugin =
    process.env.EAS_LOCAL_BUILD_PLUGIN_PATH ??
    path.resolve(repoRoot, 'node_modules', 'eas-cli-local-build-plugin', 'bin', 'run')
  const fixedWorkdir = process.env.EXPO_FIXED_BUILD_WORKDIR ?? repoRoot

  return {
    CI: process.env.CI ?? 'true',
    EXPO_DEBUG: process.env.EXPO_DEBUG ?? 'true',
    EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? 'true',
    EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH ?? 'true',
    EXPO_ATLAS: process.env.EXPO_ATLAS ?? 'true',
    EXPO_FIXED_BUILD_WORKDIR: fixedWorkdir,
    REACT_NATIVE_OVERRIDE_HERMES_DIR: hermesDir,
    EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP: process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ?? 'true',
    EAS_LOCAL_BUILD_PLUGIN_PATH: easLocalPlugin,
    EAS_NO_VCS_CHECK: process.env.EAS_NO_VCS_CHECK ?? '1',
  }
}

const getCiSharedContext = (context: StageContext) => context.ci

const parseProjectOverride = (value: string | undefined) =>
  (value ?? '')
    .split(/[, ]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const getNativeProjectsFromContext = (context: StageContext): string[] => {
  const value = context['nativeProjects']
  return Array.isArray(value) ? (value as string[]) : []
}

const storeNativeProjects = (context: StageContext, projects: string[]) => {
  context['nativeProjects'] = projects
}

const resolveNativeProjects = (context: StageContext, label: string) => {
  const override = parseProjectOverride(process.env.NX_NATIVE_PROJECTS)
  if (override.length > 0) {
    console.log(`[${label}] Using NX_NATIVE_PROJECTS override: ${override.join(', ')}`)
    return override
  }
  const ci = getCiSharedContext(context)
  if (ci) {
    const native = ci.affectedProjects.filter((project) => {
      const tags = ci.projectMeta?.[project]?.tags ?? []
      return tags.includes('ci:surface:native')
    })
    if (native.length === 0) {
      console.log(`[${label}] No affected native projects detected from surface analysis.`)
    } else {
      console.log(`[${label}] Native projects from surface analysis: ${native.join(', ')}`)
    }
    return native
  }
  const projects = getAffectedNativeProjects()
  if (projects.length === 0) {
    console.log(`[${label}] No affected native projects detected via Nx.`)
  } else {
    console.log(`[${label}] Native projects via Nx detection: ${projects.join(', ')}`)
  }
  return projects
}

const createRunManyArgs = (projects: string[], platform: 'android' | 'ios', profile: string): string[] => {
  if (projects.length === 0) {
    return ['exec', 'node', '-e', `console.log("No affected native projects for ${platform} build. Skipping.")`]
  }
  return [
    'exec',
    'nx',
    'run-many',
    '--target=rn:build',
    `--projects=${projects.join(',')}`,
    '--parallel=1',
    '--',
    '--platform',
    platform,
    '--profile',
    profile,
    '--local',
    '--interactive=false',
  ]
}

export const STAGES: Record<string, StageDefinition> = {
  lint: {
    description: 'Lint, circular dependency detection, typecheck, and unit tests',
    surface: {
      defaultToAffected: true,
    },
    steps: [
      {
        name: 'Lint (oxlint)',
        command: 'pnpm',
        args: ['lint'],
      },
      {
        name: 'Circular dependency check',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=madge', '--parallel=1'],
      },
      {
        name: 'Typecheck affected projects',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=typecheck', '--parallel=3'],
      },
      {
        name: 'Unit tests',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=test', '--parallel=2'],
      },
    ],
  },
  web: {
    description: 'Build Nx libs/apps that target web, SSR, and workers',
    surface: {
      selectors: [{ tagsAny: ['ci:surface:web'] }],
    },
    steps: [
      {
        name: 'Build libraries',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=build', '--parallel=4'],
      },
      {
        name: 'Build apps (app-build target)',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=app-build', '--parallel=2'],
      },
    ],
  },
  'deploy-web': {
    description: 'Deploy web/worker apps',
    steps: [
      {
        name: 'Deploy libraries',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=deploy', '--parallel=1'],
      },
      {
        name: 'Deploy apps',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=app-deploy', '--parallel=1'],
      },
    ],
  },
  'native-android': {
    description: 'Typecheck RN project and build Android artifacts via Nx/EAS',
    surface: {
      selectors: [{ tagsAny: ['ci:surface:native'] }],
    },
    requiredEnv: ['EXPO_TOKEN'],
    prepare: (context) => {
      ensureDirRelative(nativeDistRoot)
      const projects = resolveNativeProjects(context, 'android')
      storeNativeProjects(context, projects)
    },
    steps: [
      {
        name: 'Nx Android builds',
        command: 'pnpm',
        args: (context) => createRunManyArgs(getNativeProjectsFromContext(context), 'android', getAndroidProfile()),
        env: () => getNativeBuildEnv(),
      },
    ],
  },
  'deploy-native-android': {
    description: 'Submit Android artifacts to Google Play via EAS submit',
    requiredEnv: ['EXPO_TOKEN'],
    prepare: (context) => {
      const overridePath = process.env.ANDROID_ARTIFACT_PATH
      const discovered =
        overridePath && overridePath.length > 0 ? overridePath : discoverNativeArtifact('android', ['aab', 'apk'])
      const artifactPath = discovered ?? getAndroidArtifactPath()
      if (!fileExistsRelative(artifactPath)) {
        throw new Error(`Android artifact not found at ${artifactPath}. Ensure artifacts are extracted to dist/native.`)
      }
      context.androidArtifactPath = artifactPath
    },
    steps: [
      {
        name: 'EAS Android submit',
        command: 'pnpm',
        args: (context) => [
          'exec',
          'eas',
          'submit',
          '--platform',
          'android',
          '--path',
          String(context.androidArtifactPath),
          '--profile',
          getAndroidSubmitProfile(),
          '--non-interactive',
        ],
        env: {
          EAS_NO_VCS_CHECK: '1',
        },
      },
    ],
  },
  'native-ios': {
    description: 'Typecheck RN project and build iOS artifacts via Nx/EAS',
    surface: {
      selectors: [{ tagsAny: ['ci:surface:native'] }],
    },
    requiredEnv: ['EXPO_TOKEN'],
    supportedPlatforms: ['macos'],
    prepare: (context) => {
      ensureDirRelative(nativeDistRoot)
      const projects = resolveNativeProjects(context, 'ios')
      storeNativeProjects(context, projects)
    },
    steps: [
      {
        name: 'Nx iOS builds',
        command: 'pnpm',
        args: (context) => createRunManyArgs(getNativeProjectsFromContext(context), 'ios', getIosProfile()),
        env: () => getNativeBuildEnv(),
      },
    ],
  },
  'deploy-native-ios': {
    description: 'Submit iOS artifacts to App Store via EAS submit',
    requiredEnv: ['EXPO_TOKEN'],
    prepare: (context) => {
      const overridePath = process.env.IOS_ARTIFACT_PATH
      const discovered = overridePath && overridePath.length > 0 ? overridePath : discoverNativeArtifact('ios', ['ipa'])
      const artifactPath = discovered ?? getIosArtifactPath()
      if (!fileExistsRelative(artifactPath)) {
        throw new Error(`iOS artifact not found at ${artifactPath}. Ensure artifacts are extracted to dist/native.`)
      }
      context.iosArtifactPath = artifactPath
    },
    steps: [
      {
        name: 'EAS iOS submit',
        command: 'pnpm',
        args: (context) => [
          'exec',
          'eas',
          'submit',
          '--platform',
          'ios',
          '--path',
          String(context.iosArtifactPath),
          '--profile',
          getIosSubmitProfile(),
          '--non-interactive',
        ],
        env: {
          EAS_NO_VCS_CHECK: '1',
        },
      },
    ],
  },
  desktop: {
    description: 'Electron / desktop builds (placeholder until desktop project lands)',
    surface: {
      selectors: [{ tagsAny: ['ci:surface:desktop'] }],
    },
    steps: [],
  },
  'deploy-desktop': {
    description: 'Upload packaged desktop artifacts to Cloudflare R2 or GitHub Releases',
    prepare: (context) => {
      const artifactDir = desktopDistRoot()
      const files = listFilesRecursive(artifactDir)
      if (files.length === 0) {
        throw new Error(
          `No desktop artifacts found under ${artifactDir}. Set DESKTOP_ARTIFACT_DIR or ensure dist/desktop exists.`,
        )
      }
      const target = (process.env.DESKTOP_DEPLOY_TARGET ?? 'r2').toLowerCase()
      if (!['r2', 'github-release'].includes(target)) {
        throw new Error(`Unsupported DESKTOP_DEPLOY_TARGET "${target}". Use "r2" or "github-release".`)
      }
      if (target === 'r2') {
        ensureEnvVars('deploy-desktop', [
          'CLOUDFLARE_R2_BUCKET',
          'CLOUDFLARE_ACCOUNT_ID',
          'CLOUDFLARE_R2_ACCESS_KEY_ID',
          'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
        ])
      }
      if (target === 'github-release') {
        ensureEnvVars('deploy-desktop', ['GITHUB_TOKEN'])
      }
      context.desktopArtifactDir = artifactDir
      context.desktopFiles = files
      context.desktopTarget = target
    },
    steps: [
      {
        name: 'List desktop artifacts',
        command: 'bash',
        args: () => ['-c', 'set -euo pipefail\nls -al "$DESKTOP_ARTIFACT_DIR"\nfind "$DESKTOP_ARTIFACT_DIR" -type f'],
        env: (context) => ({
          DESKTOP_ARTIFACT_DIR: path.resolve(repoRoot, String(context.desktopArtifactDir)),
        }),
      },
      {
        name: 'Upload artifacts to Cloudflare R2',
        command: 'bash',
        args: () => [
          '-c',
          [
            'set -euo pipefail',
            'if [ "${DESKTOP_DEPLOY_TARGET}" != "r2" ]; then',
            '  echo "Skipping R2 upload";',
            '  exit 0;',
            'fi',
            'PREFIX=""',
            'if [ -n "${DESKTOP_R2_PREFIX}" ]; then',
            '  PREFIX="/${DESKTOP_R2_PREFIX%/}"',
            'fi',
            'DEST="s3://${CLOUDFLARE_R2_BUCKET}${PREFIX}"',
            'aws s3 sync "$DESKTOP_ARTIFACT_DIR" "$DEST" --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" --delete --acl private',
          ].join('\n'),
        ],
        env: (context) => ({
          DESKTOP_DEPLOY_TARGET: String(context.desktopTarget),
          DESKTOP_ARTIFACT_DIR: path.resolve(repoRoot, String(context.desktopArtifactDir)),
          DESKTOP_R2_PREFIX: process.env.DESKTOP_R2_PREFIX ?? '',
          CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET ?? '',
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
          AWS_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
          AWS_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
        }),
      },
      {
        name: 'Upload artifacts to GitHub Release',
        command: 'bash',
        args: () => [
          '-c',
          [
            'set -euo pipefail',
            'if [ "${DESKTOP_DEPLOY_TARGET}" != "github-release" ]; then',
            '  echo "Skipping GitHub Release upload";',
            '  exit 0;',
            'fi',
            'TAG=${DESKTOP_RELEASE_TAG:-desktop/dev-$(date +%Y%m%d%H%M%S)}',
            'NAME=${DESKTOP_RELEASE_NAME:-$TAG}',
            'BODY=${DESKTOP_RELEASE_BODY:-Automated desktop deploy}',
            'DRAFT_FLAG=',
            'if [ "${DESKTOP_RELEASE_DRAFT}" = "true" ]; then',
            '  DRAFT_FLAG="--draft"',
            'fi',
            'if gh release view "$TAG" >/dev/null 2>&1; then',
            '  echo "Reusing release $TAG"',
            'else',
            '  gh release create "$TAG" --title "$NAME" --notes "$BODY" $DRAFT_FLAG',
            'fi',
            'mapfile -t files < <(find "$DESKTOP_ARTIFACT_DIR" -type f)',
            'if [ "${#files[@]}" -eq 0 ]; then',
            '  echo "No files found in $DESKTOP_ARTIFACT_DIR";',
            '  exit 1;',
            'fi',
            'gh release upload "$TAG" "${files[@]}" --clobber',
          ].join('\n'),
        ],
        env: (context) => ({
          DESKTOP_DEPLOY_TARGET: String(context.desktopTarget),
          DESKTOP_ARTIFACT_DIR: path.resolve(repoRoot, String(context.desktopArtifactDir)),
          DESKTOP_RELEASE_TAG: process.env.DESKTOP_RELEASE_TAG ?? '',
          DESKTOP_RELEASE_NAME: process.env.DESKTOP_RELEASE_NAME ?? '',
          DESKTOP_RELEASE_BODY: process.env.DESKTOP_RELEASE_BODY ?? '',
          DESKTOP_RELEASE_DRAFT: process.env.DESKTOP_RELEASE_DRAFT ?? 'false',
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
        }),
      },
    ],
  },
}
