import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import type { AuditGenerateMnemonicEvent, AuditImportFromMnemonicEvent } from '@xstack/event-log/Schema'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

/**
 * 审计日志
 *
 * - 记录同步事件 （同步开始、同步结束、结果）
 * - 记录助记词，备份，导出（生成、导入）
 */
export class EventLogAudit extends Context.Tag('@xstack/event-log/EventLogAudit')<
  EventLogAudit,
  {
    recordMnemonicEvent: (
      event: AuditGenerateMnemonicEvent | AuditImportFromMnemonicEvent,
    ) => Effect.Effect<void, never>
  }
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const reactivity = yield* Reactivity.Reactivity
      const table = 'event_log_audit'

      /**
       * 创建审计日志表
       *
       * - id: 自增主键
       * - timestamp: 事件发生时间戳
       * - event_type: 事件类型
       * - details: 事件详细信息(JSON)
       * - created_at: 记录创建时间
       */
      yield* sql`
        CREATE TABLE IF NOT EXISTS ${sql(table)} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME NOT NULL,
          event_type TEXT NOT NULL,
          details TEXT
        )
      `.pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)

      /**
       * 记录助记词相关事件
       */
      const recordMnemonicEvent = (event: AuditGenerateMnemonicEvent | AuditImportFromMnemonicEvent) =>
        Effect.gen(function* () {
          const timestamp = yield* Effect.sync(() => Date.now())
          yield* sql`
            INSERT INTO ${sql(table)} ${sql.insert({
              timestamp,
              event_type: event.type,
              details: '{}',
            })}
          `.pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)

          yield* reactivity.invalidate({ [table]: [] })
        })

      return {
        recordMnemonicEvent,
      }
    }),
  )
}
