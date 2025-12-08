import path from 'node:path'
import type { StageDefinition } from './types'
import { workspaceRoot } from '@nx/devkit'
import {
  discoverNativeArtifact,
  ensureEnvVars,
  fileExistsRelative,
  getAndroidProfile,
  getAndroidSubmitProfile,
  getIosProfile,
  getIosSubmitProfile,
  getNativeProjectsFromContext,
  listFilesRecursive,
  resolveNativeProjects,
  storeNativeProjects,
} from './utils'

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
      selectors: [{ tagsAny: ['web'] }],
    },
    steps: [
      {
        name: 'Build',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=build', '--parallel=4'],
      },
    ],
  },
  'deploy-web': {
    description: 'Deploy web/worker apps',
    steps: [
      {
        name: 'Deploy apps',
        command: 'pnpm',
        args: ['nx', 'affected', '--target=deploy', '--parallel=4'],
      },
    ],
  },
  'native-android': {
    description: 'Typecheck RN project and build Android artifacts via Nx/EAS',
    surface: {
      selectors: [{ tagsAny: ['native'] }],
    },
    requiredEnv: [],
    prepare: (context) => {
      const projects = resolveNativeProjects(context, 'android')
      storeNativeProjects(context, projects)
    },
    steps: [
      {
        name: 'Android builds',
        command: 'pnpm',
        args: (context) => {
          const projects = getNativeProjectsFromContext(context)
          return [
            'nx',
            'run-many',
            `--target=build:android`,
            `--projects=${projects.join(',')}`,
            '--parallel=1',
            '--profile',
            getAndroidProfile(),
          ]
        },
      },
    ],
  },
  'deploy-native-android': {
    description: 'Submit Android artifacts to Google Play via EAS submit',
    requiredEnv: [],
    prepare: (context) => {
      const projects = resolveNativeProjects(context, 'android')
      storeNativeProjects(context, projects)
      const overridePath = process.env.ANDROID_ARTIFACT_PATH
      const artifactPath =
        overridePath && overridePath.length > 0 ? overridePath : discoverNativeArtifact('android', ['aab', 'apk'])
      if (!artifactPath || !fileExistsRelative(artifactPath)) {
        throw new Error(`Android artifact not found at ${artifactPath}. Ensure artifacts are extracted to dist/native.`)
      }
      context.androidArtifactPath = artifactPath
    },
    steps: [
      {
        name: 'Android submit',
        command: 'pnpm',
        args: (context) => {
          const projects = getNativeProjectsFromContext(context)
          return [
            'nx',
            'run-many',
            `--target=deploy:android`,
            `--projects=${projects.join(',')}`,
            '--parallel=1',
            '--profile',
            getAndroidSubmitProfile(),
          ]
        },
      },
    ],
  },
  'native-ios': {
    description: 'Build iOS artifacts via Nx',
    surface: {
      selectors: [{ tagsAny: ['native'] }],
    },
    requiredEnv: [],
    supportedPlatforms: ['macos'],
    prepare: (context) => {
      const projects = resolveNativeProjects(context, 'ios')
      storeNativeProjects(context, projects)
    },
    steps: [
      {
        name: 'iOS builds',
        command: 'pnpm',
        args: (context) => {
          const projects = getNativeProjectsFromContext(context)
          return [
            'nx',
            'run-many',
            `--target=build:ios`,
            `--projects=${projects.join(',')}`,
            '--parallel=1',
            '--profile',
            getIosProfile(),
          ]
        },
      },
    ],
  },
  'deploy-native-ios': {
    description: 'Deploy iOS artifacts to App Store',
    requiredEnv: [],
    prepare: (context) => {
      const projects = resolveNativeProjects(context, 'ios')
      storeNativeProjects(context, projects)
      const overridePath = process.env.IOS_ARTIFACT_PATH
      const artifactPath =
        overridePath && overridePath.length > 0 ? overridePath : discoverNativeArtifact('ios', ['ipa'])
      if (!artifactPath || !fileExistsRelative(artifactPath)) {
        throw new Error(`iOS artifact not found at ${artifactPath}. Ensure artifacts are extracted to dist/native.`)
      }
      context.iosArtifactPath = artifactPath
    },
    steps: [
      {
        name: 'iOS submit',
        command: 'pnpm',
        args: (context) => {
          const projects = getNativeProjectsFromContext(context)
          return [
            'nx',
            'run-many',
            `--target=deploy:ios`,
            `--projects=${projects.join(',')}`,
            '--parallel=1',
            '--profile',
            getIosSubmitProfile(),
          ]
        },
      },
    ],
  },
  'js-update': {
    description: 'Bundle and publish JS updates via hot-updater CLI',
    steps: [
      {
        name: 'Publish JS update',
        command: 'pnpm',
        args: () => {
          const env = process.env.JS_UPDATE_ENV ?? process.env.UPDATE_ENV ?? 'staging'
          const branchOverride = process.env.VERSION_BRANCH ?? ''
          const args = ['tsx', 'scripts/ci/js-update.ts', '--env', env]
          if (branchOverride) {
            args.push('--branch', branchOverride)
          }
          const platform = process.env.JS_UPDATE_PLATFORM
          if (platform) {
            args.push('--platform', platform)
          }
          const channelOverride = process.env.JS_UPDATE_CHANNEL
          if (channelOverride) {
            args.push('--channel', channelOverride)
          }
          return args
        },
      },
    ],
  },
  desktop: {
    description: 'Electron / desktop builds (placeholder until desktop project lands)',
    surface: {
      selectors: [{ tagsAny: ['desktop'] }],
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
          DESKTOP_ARTIFACT_DIR: path.resolve(workspaceRoot, String(context.desktopArtifactDir)),
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
          DESKTOP_ARTIFACT_DIR: path.resolve(workspaceRoot, String(context.desktopArtifactDir)),
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
          DESKTOP_ARTIFACT_DIR: path.resolve(workspaceRoot, String(context.desktopArtifactDir)),
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
