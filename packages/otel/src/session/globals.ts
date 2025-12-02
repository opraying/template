import { InternalEventTarget } from '@xstack/otel/session/event-target'
import type { SessionId } from '@xstack/otel/session/types'
import { generateId } from '@xstack/otel/session/utils'

const globalStoreId = Symbol.for('x/otel/globalStore')

if (!(globalStoreId in globalThis)) {
  ;(globalThis as any)[globalStoreId] = new Map()
}

const globalStore = (globalThis as any)[globalStoreId] as Map<unknown, any>

const globalValue = <A>(id: unknown, compute: () => A): A => {
  if (!globalStore.has(id)) {
    globalStore.set(id, compute())
  }

  return globalStore.get(id)!
}

export let rumSessionId = globalValue<SessionId>('rumSessionId', () => generateId(64))
export const setRumSessionId = (id: SessionId) => {
  rumSessionId = id
}

export let recentActivity = globalValue<boolean>('recentActivity', () => false)
export const setRecentActivity = (status: boolean) => {
  recentActivity = status
}

export const eventTarget = globalValue<InternalEventTarget>('eventTarget', () => new InternalEventTarget())
