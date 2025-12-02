import { LoggerLive } from '@xstack/server/logger'
import * as SyncAgentClient from '@xstack/event-log-server/cloudflare/SyncAgentClient'
import { Config } from '../sync-server/config'

export class SyncAgentClientDurableObject extends SyncAgentClient.makeDurableObject({
  syncProxyStorageBinding: Config.syncStorageProxyBinding,
  syncServerBinding: Config.syncServerBinding,
  layer: LoggerLive,
  events: [],
}) {}

export default SyncAgentClient.makeWorker({
  rpcPath: Config.rpcPath,
  durableObjectBinding: Config.syncAgentClientDurableObject,
})
