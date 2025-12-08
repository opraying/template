import * as SqlClient from '@effect/sql/SqlClient'
import * as SqlSchema from '@effect/sql/SqlSchema'
import { SyncPublicKeyItem } from '@xstack/event-log-server/schema'
import * as DestroyVault from '@xstack/event-log-server/server/destroy-vault'
import { type Tier, Vault as VaultSchema } from '@xstack/event-log-server/server/schema'
import * as Storage from '@xstack/event-log-server/server/storage'
import { getUserUniqueId } from '@xstack/event-log-server/server/utils'
import * as Arr from 'effect/Array'
import type * as Brand from 'effect/Brand'
import * as Cause from 'effect/Cause'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import { flow, pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

export class Vault extends Effect.Service<Vault>()('Vault', {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const destroyVault = yield* DestroyVault.DestroyVault
    const storage = yield* Storage.Storage

    /**
     * Check if a vault exists
     */
    const vaultExists = flow(
      SqlSchema.findOne({
        Request: Schema.Struct({ userUniqueId: Schema.String, publicKey: Schema.String }),
        Result: Schema.Struct({ count: Schema.Number }),
        execute: ({ userUniqueId, publicKey }) => sql<{ count: number }>`
          SELECT EXISTS(
            SELECT 1 FROM "vault"
            WHERE ${sql.and([sql`user_id = ${userUniqueId}`, sql`public_key = ${publicKey}`])}
          ) as count
        `,
      }),
      Effect.map(
        Option.match({
          onNone: () => false,
          onSome: (value) => value.count === 1,
        }),
      ),
    )

    /**
     * Get vault by user and public key
     */
    const _findVaultByUser = SqlSchema.findOne({
      Request: Schema.Struct({ userUniqueId: Schema.String, publicKey: Schema.String }),
      Result: VaultSchema,
      execute: ({ userUniqueId, publicKey }) => sql<typeof VaultSchema.Encoded>`
        SELECT * FROM "vault" WHERE ${sql.and([sql`user_id = ${userUniqueId}`, sql`public_key = ${publicKey}`])}
      `,
    })

    /**
     * Get all vaults for a user
     */
    const findVaultsByUser = SqlSchema.findAll({
      Request: Schema.Struct({ userUniqueId: Schema.String }),
      Result: VaultSchema,
      execute: ({ userUniqueId }) => sql<(typeof VaultSchema.Encoded)[]>`
        SELECT * FROM "vault" WHERE user_id = ${userUniqueId}
      `,
    })

    /**
     * Count vaults for a user (optimized for counting)
     */
    const getUserVaultCount = flow(
      SqlSchema.findOne({
        Request: Schema.Struct({ userUniqueId: Schema.String }),
        Result: Schema.Struct({ count: Schema.Number }),
        execute: ({ userUniqueId }) => sql<{ count: number }>`
          SELECT COUNT(*) as count FROM "vault" WHERE user_id = ${userUniqueId}
        `,
      }),
      Effect.map(
        Option.match({
          onNone: () => 0,
          onSome: (value) => value.count,
        }),
      ),
    )

    /**
     * Remove a vault
     */
    const removeVault = SqlSchema.void({
      Request: Schema.Struct({
        userUniqueId: Schema.String,
        publicKey: Schema.String,
      }),
      execute: ({ userUniqueId, publicKey }) => sql`
        DELETE FROM "vault" WHERE ${sql.and([sql`user_id = ${userUniqueId}`, sql`public_key = ${publicKey}`])}
      `,
    })

    /**
     * Insert vault (using SqlModel schema)
     */
    const insert = SqlSchema.single({
      Request: VaultSchema.insert,
      Result: VaultSchema,
      execute: (input) => sql`
        INSERT INTO "vault" ${sql.insert(input)} RETURNING *
      `,
    })

    /**
     * Insert a new vault wrapper
     */
    const insertVault = (...args: Parameters<typeof VaultSchema.insert.make>) =>
      insert(VaultSchema.insert.make(...args))

    /**
     * Update vault by id (using SqlModel schema)
     */
    const updateById = SqlSchema.single({
      Request: VaultSchema.update,
      Result: VaultSchema,
      execute: (input) => sql`
        UPDATE "vault" SET ${sql.update(input)}
        WHERE id = ${input.id}
        RETURNING *
      `,
    })

    /**
     * Update an existing vault wrapper
     */
    const updateVault = (...args: Parameters<typeof VaultSchema.update.make>) =>
      updateById(VaultSchema.update.make(...args))

    const getClientCount = Effect.fn('Vault.vaultClientCount')(function* ({
      namespace,
      userId,
      publicKey,
    }: {
      namespace: string
      userId: string
      publicKey: string
    }) {
      const userUniqueId = getUserUniqueId(namespace, userId)

      yield* pipe(
        vaultExists({
          userUniqueId,
          publicKey,
        }),
        Effect.filterOrFail(
          (exists) => exists,
          () => new Cause.NoSuchElementException(),
        ),
      )

      return yield* storage.getSyncClientCount({ namespace, userId, publicKey })
    })

    const getStats = Effect.fn('Vault.stats')(function* ({
      namespace,
      userId,
      publicKey,
    }: {
      namespace: string
      userId: string
      publicKey: string
    }) {
      const userUniqueId = getUserUniqueId(namespace, userId)

      yield* pipe(
        vaultExists({
          userUniqueId,
          publicKey,
        }),
        Effect.filterOrFail(
          (exists) => exists,
          () => new Cause.NoSuchElementException(),
        ),
      )

      return yield* storage.getSyncStats({ namespace, userId, publicKey })
    })

    /**
     * 同步公钥 - 注册用户的公钥并返回同步信息
     * 这是用户设备注册和获取同步状态的主要接口
     */
    const register = Effect.fn('Vault.register')(function* ({
      namespace,
      userId,
      userEmail,
      tier,
      items,
    }: {
      namespace: string
      userId: string
      userEmail: string & Brand.Brand<'CustomerEmail'>
      tier: Tier
      items: ReadonlyArray<{
        publicKey: string
        note: string
        createdAt: Date
        updatedAt: Date
      }>
    }) {
      const userUniqueId = getUserUniqueId(namespace, userId)

      const existingVaults = yield* findVaultsByUser({ userUniqueId })

      const itemsMap = new Map(items.map((item) => [item.publicKey, item]))
      const publicKeys = items.map((item) => item.publicKey)

      const allPublicKeys = Arr.dedupe([...publicKeys, ...existingVaults.map((v) => v.publicKey)])

      yield* Effect.annotateLogsScoped({ userId, maxVaults: tier.maxVaults })

      if (allPublicKeys.length > tier.maxVaults) {
        yield* Effect.logWarning(`User attempting to sync ${allPublicKeys.length} keys`)

        // 只处理限制内的公钥（保留现有的，限制新增的）
        const existingPublicKeys = existingVaults.map((v) => v.publicKey)
        const newPublicKeys = publicKeys.filter((pk) => !existingPublicKeys.includes(pk))
        const allowedNewKeys = newPublicKeys.slice(0, Math.max(0, tier.maxVaults - existingPublicKeys.length))

        // 重新计算允许的公钥列表和对应的 items
        const allowedPublicKeys = [...existingPublicKeys, ...allowedNewKeys]
        const allowedItems = allowedPublicKeys.map((pk) => itemsMap.get(pk)).filter(Boolean) as typeof items

        yield* Effect.logInfo(
          `Limited public keys to ${allowedPublicKeys.length} (${existingPublicKeys.length} existing + ${allowedNewKeys.length} new)`,
        )

        const results = yield* processPublicKeys({
          namespace,
          userId,
          userEmail,
          userUniqueId,
          tier,
          items: allowedItems,
          existingVaults,
        })

        return results
      }

      const results = yield* processPublicKeys({
        namespace,
        userId,
        userUniqueId,
        userEmail,
        tier,
        items,
        existingVaults,
      })

      return results
    })

    /**
     * 处理公钥列表的内部函数
     */
    const processPublicKeys = Effect.fn(function* ({
      namespace,
      userId,
      userEmail,
      userUniqueId,
      tier,
      items,
      existingVaults,
    }: {
      namespace: string
      userId: string
      userEmail: string
      userUniqueId: string
      tier: Tier
      items: ReadonlyArray<{
        publicKey: string
        note: string
        createdAt: Date
        updatedAt: Date
      }>
      existingVaults: ReadonlyArray<typeof VaultSchema.Type>
    }) {
      // 创建现有 vault 的快速查找映射
      const existingVaultMap = new Map(existingVaults.map((vault) => [vault.publicKey, vault]))
      const existingItems: Array<{ item: (typeof items)[number]; vault: typeof VaultSchema.Type }> = []
      const newItems: (typeof items)[number][] = []

      for (const item of items) {
        const existingVault = existingVaultMap.get(item.publicKey)
        if (existingVault) {
          existingItems.push({ item, vault: existingVault })
        } else {
          newItems.push(item)
        }
      }

      // 并行处理现有 vaults（更新操作）
      const existingResults = yield* Effect.all(
        existingItems.map(({ item, vault }) =>
          Effect.gen(function* () {
            const [updatedVault] = yield* Effect.all(
              [
                updateVault({
                  id: vault.id,
                  userId: userUniqueId,
                  publicKey: item.publicKey,
                }),
                storage.update({ namespace, userId, publicKey: item.publicKey }, { note: item.note }),
              ],
              { concurrency: 2 },
            )

            const syncInfo = yield* storage.getSyncInfo({
              namespace,
              userId,
              publicKey: item.publicKey,
            })

            return Option.some(
              SyncPublicKeyItem.make({
                note: syncInfo.note,
                publicKey: item.publicKey,
                lastSyncedAt: syncInfo.lastSyncAt,
                syncCount: syncInfo.syncCount,
                usedStorageSize: syncInfo.usedStorageSize,
                maxStorageSize: syncInfo.maxStorageSize,
                createdAt: item.createdAt,
                updatedAt: DateTime.toDate(updatedVault.updatedAt),
              }),
            )
          }).pipe(Effect.orElseSucceed(() => Option.none<SyncPublicKeyItem>())),
        ),
        { concurrency: 3 },
      )

      // 插入新 vaults
      const newResults = yield* Effect.all(
        newItems.map((item) =>
          Effect.gen(function* () {
            const [newVault] = yield* Effect.all(
              [
                insertVault({
                  userId: userUniqueId,
                  publicKey: item.publicKey,
                }),
                storage.create(
                  { namespace, userId, userEmail, publicKey: item.publicKey },
                  {
                    tier,
                    note: item.note,
                  },
                ),
              ],
              { concurrency: 2 },
            )

            return Option.some(
              SyncPublicKeyItem.make({
                note: item.note,
                publicKey: item.publicKey,
                lastSyncedAt: item.createdAt,
                syncCount: 0,
                usedStorageSize: 0,
                maxStorageSize: tier.maxStorageBytes,
                createdAt: DateTime.toDate(newVault.createdAt),
                updatedAt: DateTime.toDate(newVault.updatedAt),
              }),
            )
          }).pipe(Effect.orElseSucceed(() => Option.none<SyncPublicKeyItem>())),
        ),
        { concurrency: 3 },
      )

      const allResults = [...existingResults, ...newResults]

      const successfulItems = allResults.filter(Option.isSome).map((item) => item.value)

      yield* Effect.logInfo(
        `Successfully processed ${successfulItems.length}/${items.length} items (${existingItems.length} existing, ${newItems.length} new)`,
      )

      return successfulItems
    })

    const update = Effect.fn(function* ({
      namespace,
      userId,
      publicKey,
      info,
    }: {
      namespace: string
      userId: string
      publicKey: string
      info: { note: string }
    }) {
      const userUniqueId = getUserUniqueId(namespace, userId)

      yield* pipe(
        vaultExists({
          userUniqueId,
          publicKey,
        }),
        Effect.filterOrFail(
          (exists) => exists,
          () => new Cause.NoSuchElementException(),
        ),
      )

      return yield* storage.update({ namespace, userId, publicKey }, info).pipe(Effect.orDie)
    })

    /**
     * Destroy a vault (with existence check and cleanup)
     */
    const destroyVault_ = Effect.fn('Vault.destroyVault')(function* ({
      namespace,
      userId,
      publicKey,
    }: {
      namespace: string
      userId: string
      publicKey: string
    }) {
      const userUniqueId = getUserUniqueId(namespace, userId)

      yield* pipe(
        vaultExists({
          userUniqueId,
          publicKey,
        }),
        Effect.filterOrFail(
          (exists) => exists,
          () => new Cause.NoSuchElementException(),
        ),
      )

      const cleanupIng = yield* destroyVault.get({ namespace, userId, publicKey })

      if (Option.isSome(cleanupIng)) return

      yield* removeVault({ userUniqueId, publicKey })

      yield* destroyVault.destroy({ namespace, userId, publicKey })
    })

    return {
      getUserVaultCount,
      getClientCount,
      getStats,

      access: destroyVault.access,

      register,
      update,
      destroy: destroyVault_,
    }
  }),
}) {}
