import type * as Brand from 'effect/Brand'

export type DurableObjectId = string & Brand.Brand<'DurableObjectId'>

export type DurableUserId = string & Brand.Brand<'DurableUserId'>

export interface SyncStats {
  lastSyncAt: Date
  syncCount: number
  usedStorageSize: number
  maxStorageSize: number
}
