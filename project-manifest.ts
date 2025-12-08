import {
  LEVEL0_BASE_PATH,
  LEVEL2_BASE_PATH,
  LEVEL3_BASE_PATH,
  tsApp,
  tsLib,
  type AliasDefinition,
  type ProjectDefinition,
} from './scripts/generate-tsconfig/types'

export const ALIAS_DEFINITIONS: AliasDefinition[] = [
  // =========================
  // Packages
  // =========================
  { name: '@xstack/server-testing', path: 'packages/server-testing/src' },
  { name: '@xstack/testing', path: 'packages/testing/src' },
  { name: '@xstack/internal-kit', path: 'packages/internal-kit/src' },
  { name: '@xstack/local-first', path: 'packages/local-first/src' },
  { name: '@xstack/user-kit', path: 'packages/user-kit/src' },
  { name: '@xstack/app-kit', path: 'packages/app-kit/src' },
  { name: '@xstack/app', path: 'packages/app/src' },
  { name: '@xstack/preset-server', path: 'packages/preset-server/src' },
  { name: '@xstack/preset-web', path: 'packages/preset-web/src' },
  { name: '@xstack/preset-cloudflare', path: 'packages/preset-cloudflare/src' },
  { name: '@xstack/preset-react-native', path: 'packages/preset-react-native/src' },
  { name: '@xstack/errors', path: 'packages/errors/src' },
  { name: '@xstack/sql-op-sqlite', path: 'packages/sql-op-sqlite/src' },
  { name: '@xstack/sql-do-proxy', path: 'packages/sql-do-proxy/src' },
  { name: '@xstack/sql-kysely', path: 'packages/sql-kysely/src' },
  { name: '@xstack/sqlite', path: 'packages/sqlite/src' },
  { name: '@xstack/db', path: 'packages/db/src', allowIndex: true },
  { name: '@xstack/cloudflare', path: 'packages/cloudflare/src' },
  { name: '@xstack/server', path: 'packages/server/src' },
  { name: '@xstack/atom-react', path: 'packages/atom-react/src', allowIndex: true },
  { name: '@xstack/react-router', path: 'packages/react-router/src' },
  { name: '@xstack/tailwind', path: 'packages/tailwind/src' },
  { name: '@xstack/vite', path: 'packages/vite/src' },
  { name: '@xstack/react-native', path: 'packages/react-native/src' },
  { name: '@xstack/expo-bip39', path: 'packages/expo-bip39/src' },
  { name: '@xstack/event-log-server', path: 'packages/event-log-server/src', allowIndex: true },
  { name: '@xstack/event-log', path: 'packages/event-log/src', allowIndex: true },
  { name: '@xstack/toaster', path: 'packages/toaster/src', allowIndex: true },
  { name: '@xstack/router', path: 'packages/router/src', allowIndex: true },
  { name: '@xstack/purchase', path: 'packages/purchase/src' },
  { name: '@xstack/emails', path: 'packages/emails/src' },
  { name: '@xstack/form', path: 'packages/form/src' },
  { name: '@xstack/i18n', path: 'packages/i18n/src' },
  { name: '@xstack/otel', path: 'packages/otel/src' },
  { name: '@xstack/cms', path: 'packages/cms/src', allowIndex: true },
  { name: '@xstack/lib', path: 'packages/lib/src' },
  { name: '@xstack/fx', path: 'packages/fx/src', allowIndex: true },

  // =========================
  // UI
  // =========================
  { name: '@/components/ui', path: 'packages/lib/src/ui' },
  { name: '@/lib', path: 'packages/lib/src' },
]

export const PROJECT_DEFINITIONS: ProjectDefinition[] = [
  {
    projectName: 'packages',
    items: ALIAS_DEFINITIONS.filter((def) => def.name.startsWith('@xstack/')).map((pkg) =>
      tsLib(pkg.name.replace('@xstack/', ''), {
        baseConfigPath: LEVEL2_BASE_PATH,
        isPackage: true,
      }),
    ),
  },
  {
    projectName: 'apps',
    items: [
      tsLib('client'),
      tsLib('emails', { baseConfigPath: LEVEL2_BASE_PATH }),
      tsLib('shared', { baseConfigPath: LEVEL0_BASE_PATH }),
      tsApp('cms', { baseConfigPath: LEVEL2_BASE_PATH, checkIncludes: [] }),
      tsApp('server', { checkIncludes: [] }),
      tsApp('web', { checkIncludes: ['client', 'shared', 'emails'] }),
      tsApp('native', {
        checkIncludes: ['client', 'shared'],
        projectOverrides: {
          main: {
            include: ['nativewind-env.d.ts'],
          },
        },
      }),
      tsApp('local-first/sync-server', { baseConfigPath: LEVEL3_BASE_PATH, checkIncludes: [] }),
      tsApp('local-first/sync-agent-client', {
        baseConfigPath: LEVEL3_BASE_PATH,
        checkIncludes: [],
      }),
      tsApp('local-first/sync-storage-proxy', {
        baseConfigPath: LEVEL3_BASE_PATH,
        checkIncludes: [],
      }),
    ],
    baseTargets: [
      {
        name: 'shared',
        alias: {
          map: (paths) => Object.fromEntries(Object.entries(paths).filter(([key]) => !key.startsWith('@local-first/'))),
        },
      },
    ],
  },
]
