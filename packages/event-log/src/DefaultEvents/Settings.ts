import * as SqlClient from '@effect/sql/SqlClient'
import * as EventGroup from '@xstack/event-log/EventGroup'
import * as Events from '@xstack/event-log/Events'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export const table = 'x_settings'

class SettingsEventGroup extends EventGroup.empty.add({
  tag: 'SettingChange',
  primaryKey: (_) => _.name,
  payload: Schema.Struct({
    name: Schema.String,
    json: Schema.String,
  }),
}) {}

export class SettingsEvents extends Events.make(SettingsEventGroup, {
  reactivity: [table] as const,
  handlers: (handlers) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      yield* sql`
          CREATE TABLE IF NOT EXISTS ${sql(table)} (
            name TEXT PRIMARY KEY,
            json TEXT NOT NULL
          )
        `.pipe(Effect.orDie)

      return handlers.handle('SettingChange', ({ payload, conflicts }) =>
        Effect.gen(function* () {
          yield* sql`INSERT INTO ${sql(table)} ${sql.insert({ name: payload.name, json: payload.json })} ON CONFLICT (name) DO UPDATE SET json = ${payload.json}`.pipe(
            Effect.annotateLogs({ name: payload.name }),
            Effect.orDie,
          )
        }),
      )
    }),
}) {}
