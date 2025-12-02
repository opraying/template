import * as SyncAgentClient from '@xstack/event-log-server/cloudflare/SyncAgentClient'
import { Config } from '../config'

export class SyncAgentClientDurableObject extends SyncAgentClient.makeDurableObject({
  syncProxyStorageBinding: Config.syncStorageProxyBinding,
  syncServerBinding: Config.syncServerBinding,
  events: [],
}) {}

export default SyncAgentClient.makeWorker({
  rpcPath: Config.rpcPath,
  durableObjectBinding: Config.syncAgentClientDurableObject,
})
