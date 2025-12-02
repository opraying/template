import { LoggerLive } from '@xstack/server/logger'
import * as SyncStorageProxy from '@xstack/event-log-server/cloudflare/SyncStorageProxy'
import { Config } from '../sync-server/config'

export class SyncStorageProxyDurableObject extends SyncStorageProxy.makeDurableObject({
  layer: LoggerLive,
}) {}

export default SyncStorageProxy.makeWorker({
  rpcPath: Config.rpcPath,
  durableObjectBinding: Config.syncStorageProxyDurableObject,
})
