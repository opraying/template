import * as SyncStorageProxy from '@xstack/event-log-server/cloudflare/SyncStorageProxy'
import { Config } from '../config'

export class SyncStorageProxyDurableObject extends SyncStorageProxy.makeDurableObject({}) {}

export default SyncStorageProxy.makeWorker({
  rpcPath: Config.rpcPath,
  durableObjectBinding: Config.syncStorageProxyDurableObject,
})
