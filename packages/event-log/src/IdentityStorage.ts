import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import type * as Tag from '@xstack/event-log/Identity'
import * as EventLogSchema from '@xstack/event-log/Schema'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as RcRef from 'effect/RcRef'

export interface IdentityStorage {
  storageSize: Effect.Effect<number>

  setMnemonic: (mnemonic: string) => Effect.Effect<void>

  getMnemonic: Effect.Effect<string | undefined>

  deleteMnemonic: Effect.Effect<void>

  deletePublicKey: (publicKey: string) => Effect.Effect<void>

  importPublicKeys: (
    publicKeys: ReadonlyArray<Omit<EventLogSchema.StoragePublicKeyItem, 'synced'>>,
  ) => Effect.Effect<void>

  clearPublicKeys: () => Effect.Effect<void>

  upsertPublicKey: (publicKey: string, data?: Tag.StoragePublicKeyUpdateItem) => Effect.Effect<void>

  getAllPublicKeys: () => Effect.Effect<ReadonlyArray<EventLogSchema.StoragePublicKeyItem>>
}

export const IdentityStorage = Context.GenericTag<IdentityStorage>('@xstack/event-log/IdentityStorage')

export const makeMemoryStorage = Effect.gen(function* () {
  const { mnemonicKey } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)

  const store = new Map<string, string>()
  const publicKeyStore = new Map<string, EventLogSchema.StoragePublicKeyItem>()

  return IdentityStorage.of({
    storageSize: Effect.sync(() => 0),

    getMnemonic: Effect.sync(() => store.get(mnemonicKey)),

    setMnemonic: (mnemonic) =>
      Effect.sync(() => {
        store.set(mnemonicKey, mnemonic)
      }),

    deleteMnemonic: Effect.sync(() => {
      store.delete(mnemonicKey)
    }),

    deletePublicKey: (publicKey) =>
      Effect.sync(() => {
        publicKeyStore.delete(publicKey)
      }),

    importPublicKeys: (publicKeys) =>
      Effect.sync(() => {
        publicKeys.forEach((item) => {
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
          publicKeyStore.set(item.publicKey, data)
        })
      }),

    clearPublicKeys: () =>
      Effect.sync(() => {
        publicKeyStore.clear()
      }),

    upsertPublicKey: (publicKey, data = {}) =>
      Effect.sync(() => {
        const now = new Date()
        const existingItem = publicKeyStore.get(publicKey)

        const item: EventLogSchema.StoragePublicKeyItem = {
          note: data.note ?? (existingItem?.note || existingItem?.createdAt.toISOString() || now.toISOString()),
          publicKey,
          synced: existingItem?.synced ?? false,
          lastSyncedAt: data.lastSyncedAt ?? existingItem?.lastSyncedAt ?? undefined,
          syncCount: data.syncCount ?? existingItem?.syncCount ?? 0,
          usedStorageSize: data.usedStorageSize ?? existingItem?.usedStorageSize ?? 0,
          maxStorageSize: data.maxStorageSize ?? existingItem?.maxStorageSize ?? 0,
          createdAt: existingItem?.createdAt ?? now,
          updatedAt: now,
        }
        publicKeyStore.set(publicKey, item)
      }),

    getAllPublicKeys: () => Effect.succeed(Array.from(publicKeyStore.values())),
  })
})

export const Memory = Layer.effect(IdentityStorage, makeMemoryStorage)

const makeIndexedDBStorage = Effect.gen(function* () {
  const { namespace, mnemonicKey } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)

  const dbVersion = 1
  const dbName = `${namespace}-event-log`
  const identityTable = 'identity'
  const identityPublicKeysTable = 'identity-public-keys'

  const makeIndexedDB = Effect.promise(
    () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result

          if (!db.objectStoreNames.contains(identityTable)) {
            db.createObjectStore(identityTable)
          }

          if (!db.objectStoreNames.contains(identityPublicKeysTable)) {
            db.createObjectStore(identityPublicKeysTable, { keyPath: 'publicKey' })
          }
        }
      }),
  )

  const storageRef = yield* RcRef.make({
    acquire: Effect.acquireRelease(
      pipe(
        makeIndexedDB,
        Effect.tap(
          Effect.logTrace('Opening IndexedDB').pipe(
            Effect.annotateLogs({
              dbName,
            }),
          ),
        ),
      ),
      Effect.fn(function* (storage) {
        yield* Effect.ignore(Effect.try(() => storage.close()))
        yield* Effect.logTrace('Closing IndexedDB').pipe(
          Effect.annotateLogs({
            dbName,
          }),
        )
      }),
    ),
    idleTimeToLive: '15 seconds',
  })

  return IdentityStorage.of({
    storageSize: Effect.sync(() => 0),
    getMnemonic: pipe(
      storageRef.get,
      Effect.flatMap((db) =>
        Effect.promise(
          () =>
            new Promise<string | undefined>((resolve, reject) => {
              const tx = db.transaction(identityTable, 'readonly')
              const request = tx.objectStore(identityTable).get(mnemonicKey)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            }),
        ),
      ),
      Effect.scoped,
    ),

    setMnemonic: (mnemonic) =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve, reject) => {
                const tx = db.transaction(identityTable, 'readwrite')
                tx.objectStore(identityTable).put(mnemonic, mnemonicKey)
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
              }),
          ),
        ),
        Effect.scoped,
      ),

    deleteMnemonic: pipe(
      storageRef.get,
      Effect.flatMap((db) =>
        Effect.promise(
          () =>
            new Promise<void>((resolve, reject) => {
              const tx = db.transaction(identityTable, 'readwrite')
              tx.objectStore(identityTable).delete(mnemonicKey)
              tx.oncomplete = () => resolve()
              tx.onerror = () => reject(tx.error)
            }),
        ),
      ),
      Effect.scoped,
    ),

    deletePublicKey: (publicKey) =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve, reject) => {
                const tx = db.transaction(identityPublicKeysTable, 'readwrite')
                tx.objectStore(identityPublicKeysTable).delete(publicKey)
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
              }),
          ),
        ),
        Effect.scoped,
      ),

    importPublicKeys: (publicKeys) =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve, reject) => {
                const tx = db.transaction(identityPublicKeysTable, 'readwrite')
                const store = tx.objectStore(identityPublicKeysTable)

                publicKeys.forEach((item) => {
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

                  store.put(data)
                })

                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
              }),
          ),
        ),
        Effect.scoped,
      ),

    clearPublicKeys: () =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve, reject) => {
                const tx = db.transaction(identityPublicKeysTable, 'readwrite')
                tx.objectStore(identityPublicKeysTable).clear()
                tx.oncomplete = () => resolve()
                tx.onerror = () => reject(tx.error)
              }),
          ),
        ),
        Effect.scoped,
      ),

    upsertPublicKey: (publicKey, data = {}) =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve, reject) => {
                const tx = db.transaction(identityPublicKeysTable, 'readwrite')
                const store = tx.objectStore(identityPublicKeysTable)

                // Check if the public key already exists
                const getRequest = store.get(publicKey)
                getRequest.onsuccess = () => {
                  const now = new Date()
                  const existingItem = getRequest.result as EventLogSchema.StoragePublicKeyItem | undefined

                  const item: EventLogSchema.StoragePublicKeyItem = {
                    note:
                      data.note ?? (existingItem?.note || existingItem?.createdAt.toISOString() || now.toISOString()),
                    publicKey,
                    synced: existingItem?.synced ?? false,
                    lastSyncedAt: data.lastSyncedAt ?? existingItem?.lastSyncedAt ?? undefined,
                    syncCount: data.syncCount ?? existingItem?.syncCount ?? 0,
                    usedStorageSize: data.usedStorageSize ?? existingItem?.usedStorageSize ?? 0,
                    maxStorageSize: data.maxStorageSize ?? existingItem?.maxStorageSize ?? 0,
                    createdAt: existingItem?.createdAt ?? now,
                    updatedAt: now,
                  }

                  store.put(item)

                  tx.oncomplete = () => resolve()
                  tx.onerror = () => reject(tx.error)
                }
                getRequest.onerror = () => reject(getRequest.error)
              }),
          ),
        ),
        Effect.scoped,
      ),

    getAllPublicKeys: () =>
      pipe(
        storageRef.get,
        Effect.flatMap((db) =>
          Effect.promise(
            () =>
              new Promise<ReadonlyArray<EventLogSchema.StoragePublicKeyItem>>((resolve, reject) => {
                const tx = db.transaction(identityPublicKeysTable, 'readonly')
                const store = tx.objectStore(identityPublicKeysTable)
                const request = store.openCursor()
                const items: (typeof EventLogSchema.StoragePublicKeyItem.Encoded)[] = []

                request.onsuccess = (event) => {
                  const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
                  if (cursor) {
                    items.push(cursor.value)
                    cursor.continue()
                  } else {
                    resolve(EventLogSchema.StoragePublicKeyItem.decodeMany(items))
                  }
                }
                request.onerror = () => reject(request.error)
              }),
          ),
        ),
        Effect.scoped,
      ),
  })
})

export const Live = Layer.scoped(
  IdentityStorage,
  Effect.gen(function* (_) {
    const isIndexedDBAvailable = typeof indexedDB !== 'undefined'
    yield* Effect.logTrace(
      isIndexedDBAvailable ? 'IndexedDB is available' : 'IndexedDB not available, using memory storage',
    )
    if (isIndexedDBAvailable) {
      return yield* makeIndexedDBStorage
    }

    return yield* makeMemoryStorage
  }).pipe(Effect.withLogSpan('@event-log/identity')),
)
