import { d1Database, r2Storage } from '@hot-updater/cloudflare'
import { expo } from '@hot-updater/expo'
import * as dotenv from '@dotenvx/dotenvx'
import { defineConfig } from 'hot-updater'
import * as path from 'node:path'
import { workspaceRoot } from '@nx/devkit'

dotenv.config({
  envKeysFile: path.join(workspaceRoot, '.env.keys'),
  path: [path.join(workspaceRoot, '.env')],
  quiet: true,
  ignore: ['MISSING_ENV_FILE'],
})

export default defineConfig({
  build: expo({}),
  storage: r2Storage({
    accountId: process.env.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID!,
    cloudflareApiToken: process.env.HOT_UPDATER_CLOUDFLARE_API_TOKEN!,
    bucketName: process.env.HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME!,
  }),
  database: d1Database({
    accountId: process.env.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID!,
    cloudflareApiToken: process.env.HOT_UPDATER_CLOUDFLARE_API_TOKEN!,
    databaseId: process.env.HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID!,
  }),
  updateStrategy: 'fingerprint',
  compressStrategy: 'tar.br',
  signing: { enabled: false },
  fingerprint: {},
})
