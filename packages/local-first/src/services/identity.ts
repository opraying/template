import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import * as Identity from '@xstack/event-log/Identity'
import { makeAtomService, UseUseServices } from '@xstack/atom-react'
import * as GlobalLayer from '@xstack/atom-react/global'
import type * as InternalClient from '@xstack/sqlite/internal/client'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import type * as Redacted from 'effect/Redacted'
import * as Tracer from 'effect/Tracer'

const Live = pipe(
  GlobalLayer.use(
    'LocalFirstSecurity',
    Tracer.Tracer,
    SqlClient.SqlClient,
    Reactivity.Reactivity,
    Identity.Identity,
    EventLogStates.EventLogStates,
  ),
)

export class IdentityService extends Effect.Service<IdentityService>()('IdentityService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient) as InternalClient.SqlClient
    const identity = yield* Identity.Identity
    const { remoteSyncFlag } = yield* EventLogStates.EventLogStates

    // [INFO]
    // 在初始化以外的地方调用需要在UI表示这是危险操作
    // 执行导入时先清空数据后再导入

    const clearDB = Effect.fn('clearDB')(function* () {
      const excludeTables = ['sqlite_sequence']
      type TableResult = { name: string }

      const tables = yield* sql<TableResult>`SELECT name FROM sqlite_master WHERE type='table'`.withoutTransform.pipe(
        Effect.map((tables) => tables.filter((table) => !excludeTables.includes(table.name))),
        Effect.orElseSucceed(() => [] as TableResult[]),
      )

      // clear table data, keep table structure
      yield* Effect.forEach(tables, (table) => sql`DELETE FROM ${sql(table.name)}`.withoutTransform).pipe(Effect.ignore)
    })

    /**
     * 从助记词恢复
     * 验证助记词正确，清除本地数据，导入新的助记词，开启同步
     */
    const importMnemonic = Effect.fn('importMnemonic')(function* (
      mnemonic: Redacted.Redacted<string>,
      data?: { note: string } | undefined,
    ) {
      yield* identity.parseMnemonic(mnemonic)

      yield* pipe(
        clearDB(),
        Effect.zipRight(identity.importFromMnemonic(mnemonic, data)),
        Effect.zipRight(remoteSyncFlag.resume),
      )
    })

    /**
     * 同时删除本地和远端的身份记录
     */
    const deleteIdentity = Effect.fn('deleteIdentity')(function* (publicKey: string) {
      yield* identity.deletePublicKey(publicKey)
    })

    /**
     * 清除助记词/密钥
     * 清除本地 SQLite 中的数据
     */
    const clearData = Effect.gen(function* () {
      yield* clearDB()

      yield* identity.clear

      yield* remoteSyncFlag.pause
    }).pipe(Effect.withSpan('clearData'))

    return {
      getMnemonic: identity.mnemonic,
      randomMnemonic: identity.randomMnemonic(),
      importMnemonic,
      deleteIdentity,
      clearData,
    }
  }).pipe(
    Effect.withLogSpan('IdentityServiceAtom'),
    Effect.annotateLogs({
      module: 'IdentityServiceAtom',
    }),
  ),
  dependencies: [Live],
}) {
  static get useAtom() {
    return makeAtomService(this, useIdentityService)
  }
}

const useIdentityService = UseUseServices({ IdentityService })(({ runtime, services: { IdentityService } }) => {
  const mnemonic = runtime.atom(IdentityService.getMnemonic, {
    initialValue: Option.none(),
  })

  const randomMnemonic = runtime.fn((_: void, _ctx) => IdentityService.randomMnemonic)

  const importMnemonic = runtime.fn(
    (_: { mnemonic: Redacted.Redacted<string>; data?: { note: string } | undefined }, ctx) =>
      IdentityService.importMnemonic(_.mnemonic, _.data).pipe(Effect.tap(() => ctx.refresh(mnemonic))),
  )

  const deleteIdentity = runtime.fn((publicKey: string, _ctx) => IdentityService.deleteIdentity(publicKey))

  const clearData = runtime.fn((_: void, ctx) =>
    IdentityService.clearData.pipe(Effect.tap(() => ctx.refresh(mnemonic))),
  )

  return {
    mnemonic,
    randomMnemonic,
    importMnemonic,
    clearData,
    deleteIdentity,
  }
})
