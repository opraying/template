import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiError from '@effect/platform/HttpApiError'
import { Unauthorized } from '@effect/platform/HttpApiError'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import {
  SyncPublicKeyItem,
  SyncPublicKeysUrlParams,
  SyncRegisterUrlParams,
  SyncStats,
} from '@xstack/event-log-server/schema'
import * as Schema from 'effect/Schema'
import { VaultNotFoundError } from './errors'

/**
 * 用于用户数据管理
 * - 提供给其他的服务调用，认证由调用方负责
 * - 同步公钥，删除公钥，查看同步状态
 * - 备份，恢复
 */
export class SyncApi extends HttpApiGroup.make('sync')
  .add(
    HttpApiEndpoint.put('register', '/register')
      .setUrlParams(
        Schema.Struct({
          q: SyncRegisterUrlParams,
        }),
      )
      .setPayload(
        Schema.Struct({
          items: Schema.Array(
            Schema.Struct({
              publicKey: Schema.String,
              note: Schema.String,
              createdAt: Schema.Date,
              updatedAt: Schema.Date,
            }),
          ),
        }),
      )
      .addSuccess(Schema.Array(SyncPublicKeyItem)),
  )
  .add(
    HttpApiEndpoint.get('stats', '/stats')
      .setUrlParams(
        Schema.Struct({
          q: SyncPublicKeysUrlParams,
        }),
      )
      .addSuccess(SyncStats)
      .addError(VaultNotFoundError),
  )
  .add(
    HttpApiEndpoint.patch('update', '/update')
      .setUrlParams(
        Schema.Struct({
          q: SyncPublicKeysUrlParams,
        }),
      )
      .setPayload(Schema.Struct({ note: Schema.String }))
      .addSuccess(Schema.Void)
      .addError(VaultNotFoundError),
  )
  .add(
    HttpApiEndpoint.del('destroy', '/destroy')
      .setUrlParams(
        Schema.Struct({
          q: SyncPublicKeysUrlParams,
        }),
      )
      .addSuccess(Schema.Void)
      .addError(VaultNotFoundError),
  )
  .addError(Unauthorized)
  .addError(HttpApiError.BadRequest)
  .annotateContext(
    OpenApi.annotations({
      title: 'Public Api',
      description: 'Public Api for user',
    }),
  )
  .prefix('/sync/api') {}

export class SyncHttpApi extends HttpApi.make('api')
  .add(SyncApi)
  .annotateContext(
    OpenApi.annotations({
      title: 'Local First Sync Api',
      description: 'Local First Sync Api',
    }),
  ) {}
