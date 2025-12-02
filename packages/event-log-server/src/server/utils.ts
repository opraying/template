import type { DurableObjectId, DurableUserId } from '@xstack/event-log-server/server/types'

export const getUserUniqueId = (namespace: string, userId: string): DurableUserId => {
  return `${namespace}::${userId}` as DurableUserId
}

export const getUserDurableId = (namespace: string, userId: string, publicKey: string): DurableObjectId => {
  return `${namespace}::${userId}::${publicKey}` as DurableObjectId
}

export const Separator = '::'
