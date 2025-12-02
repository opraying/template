import { type DB, Storage } from '@op-engineering/op-sqlite'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import type { StoragePublicKeyUpdateItem } from '@xstack/event-log/Identity'
import { IdentityStorage } from '@xstack/event-log/IdentityStorage'
import * as EventLogSchema from '@xstack/event-log/Schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as RcRef from 'effect/RcRef'
import * as ExpoFileSystem from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

const makeNativeStorage = Effect.gen(function* () {
  const { mnemonicKey, storageLocation } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
  const location = `${storageLocation}/identity-storage`

  const storageRef = yield* RcRef.make({
    acquire: Effect.acquireRelease(
      Effect.sync(() => new Storage({ location: location })).pipe(
        Effect.tap(Effect.logTrace('Opening op-sqlite storage')),
      ),
      Effect.fn(function* (storage) {
        const db = (storage as unknown as { db: DB }).db
        yield* Effect.ignore(Effect.try(() => db.close()))
        yield* Effect.logTrace('Closing op-sqlite storage')
      }),
    ),
    idleTimeToLive: '15 seconds',
  })

  return IdentityStorage.of({
    storageSize: pipe(
      storageRef.get,
      Effect.flatMap((storage) => {
        const db = (storage as unknown as { db: DB }).db
        const dbPath = db.getDbPath()

        return Effect.sync(() => {
          const file = new ExpoFileSystem.File(dbPath);
          const info = file.info();
          return info.exists ? info.size??0 : 0;
        })
      }),
      Effect.scoped,
    ),

    getMnemonic: Effect.promise(() => SecureStore.getItemAsync(mnemonicKey).then((value) => value ?? undefined)),

    setMnemonic: (mnemonic: string) => Effect.promise(() => SecureStore.setItemAsync(mnemonicKey, mnemonic)),

    deleteMnemonic: Effect.promise(() => SecureStore.deleteItemAsync(mnemonicKey)),

    deletePublicKey: (publicKey: string) =>
      pipe(
        storageRef.get,
        Effect.flatMap((storage) => Effect.promise(() => storage.removeItem(publicKey))),
        Effect.scoped,
      ),

    importPublicKeys: (publicKeys: ReadonlyArray<Omit<EventLogSchema.StoragePublicKeyItem, 'synced'>>) =>
      pipe(
        storageRef.get,
        Effect.flatMap((storage) =>
          Effect.promise(async () => {
            for (const item of publicKeys) {
              const data: EventLogSchema.StoragePublicKeyItem = {
                note: item.note,
                publicKey: item.publicKey,
                synced: true,
                lastSyncedAt: item.lastSyncedAt ?? undefined,
                syncCount: item.syncCount ?? 0,
                usedStorageSize: item.usedStorageSize ?? 0,
                maxStorageSize: item.maxStorageSize ?? 0,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
              }
              await storage.setItem(item.publicKey, JSON.stringify(data))
            }
          }),
        ),
        Effect.scoped,
      ),

    clearPublicKeys: () =>
      pipe(
        storageRef.get,
        Effect.flatMap((storage) => Effect.promise(() => storage.clear())),
        Effect.scoped,
      ),

    upsertPublicKey: (publicKey: string, data: StoragePublicKeyUpdateItem = {}) =>
      pipe(
        storageRef.get,
        Effect.flatMap((storage) =>
          Effect.promise(async () => {
            const now = new Date()
            const existingItemStr = await storage.getItem(publicKey)
            const existingItem = existingItemStr ? JSON.parse(existingItemStr) : undefined

            const item: EventLogSchema.StoragePublicKeyItem = {
              note: data.note ?? (existingItem?.note || existingItem?.createdAt || now.toISOString()),
              publicKey,
              synced: existingItem?.synced ?? false,
              lastSyncedAt: data.lastSyncedAt ?? existingItem?.lastSyncedAt ?? undefined,
              syncCount: data.syncCount ?? existingItem?.syncCount ?? 0,
              usedStorageSize: data.usedStorageSize ?? existingItem?.usedStorageSize ?? 0,
              maxStorageSize: data.maxStorageSize ?? existingItem?.maxStorageSize ?? 0,
              createdAt: existingItem?.createdAt ? new Date(existingItem.createdAt) : now,
              updatedAt: now,
            }

            await storage.setItem(publicKey, JSON.stringify(item))
          }),
        ),
        Effect.scoped,
      ),

    getAllPublicKeys: () =>
      pipe(
        storageRef.get,
        Effect.flatMap((storage) =>
          Effect.promise(async () => {
            const keys = storage.getAllKeys()
            const items = await Promise.all(
              keys.map(async (key) => {
                const itemStr = await storage.getItem(key)
                if (!itemStr) return null
                const item = JSON.parse(itemStr)
                return {
                  ...item,
                  lastSyncedAt: item.lastSyncedAt ? new Date(item.lastSyncedAt) : undefined,
                  createdAt: new Date(item.createdAt),
                  updatedAt: new Date(item.updatedAt),
                }
              }),
            )
            const validItems = items.filter((item): item is EventLogSchema.StoragePublicKeyItem => item !== null)
            return EventLogSchema.StoragePublicKeyItem.decodeMany(validItems)
          }),
        ),
        Effect.scoped,
      ),
  })
})

export const Live = Layer.scoped(
  IdentityStorage,
  Effect.gen(function* (_) {
    yield* Effect.logTrace('Using native storage implementation')
    return yield* makeNativeStorage
  }).pipe(Effect.withLogSpan('@event-log/identity')),
)
