import { d1Database, r2Storage } from '@hot-updater/cloudflare'
import { expo } from '@hot-updater/expo'
import * as dotenv from '@dotenvx/dotenvx'
import { defineConfig } from 'hot-updater'
import * as path from 'node:path'
import { workspaceRoot } from '@nx/devkit'
import { Schema } from 'effect'

const env =
  dotenv.config({
    envKeysFile: path.join(workspaceRoot, '.env.keys'),
    path: [path.join(workspaceRoot, '.env')],
    quiet: true,
    ignore: ['MISSING_ENV_FILE'],
    processEnv: {},
  }).parsed ?? {}

const EnvSchema = Schema.Struct({
  HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID: Schema.String,
  HOT_UPDATER_CLOUDFLARE_API_TOKEN: Schema.String,
  HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME: Schema.String,
  HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID: Schema.String,
})

const parsedEnv = Schema.decodeUnknownSync(EnvSchema)(env)

export default defineConfig({
  build: expo({}),
  storage: r2Storage({
    accountId: parsedEnv.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: parsedEnv.HOT_UPDATER_CLOUDFLARE_API_TOKEN,
    bucketName: parsedEnv.HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME,
  }),
  database: d1Database({
    accountId: parsedEnv.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: parsedEnv.HOT_UPDATER_CLOUDFLARE_API_TOKEN,
    databaseId: parsedEnv.HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID,
  }),
  updateStrategy: 'fingerprint',
  compressStrategy: 'tar.br',
  signing: { enabled: false },
  fingerprint: {},
})
