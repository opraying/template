import * as SqlClient from '@effect/sql/SqlClient'
import * as EventGroup from '@xstack/event-log/EventGroup'
import * as Events from '@xstack/event-log/Events'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

class AgentEventGroup extends EventGroup.empty
  .add({
    tag: 'SetName',
    primaryKey: (_) => _.name,
    payload: Schema.Struct({
      name: Schema.String,
    }),
  })
  .add({
    tag: 'Hi',
    primaryKey: (_) => _.id.toString(),
    payload: Schema.Struct({
      id: Schema.Number,
      message: Schema.String,
    }),
  }) {}

class ClientEventGroup extends EventGroup.empty
  .add({
    tag: 'SetName',
    primaryKey: (_) => _.name,
    payload: Schema.Struct({
      name: Schema.String,
    }),
  })
  .add({
    tag: 'Hi',
    primaryKey: (_) => _.id.toString(),
    payload: Schema.Struct({
      id: Schema.Number,
      message: Schema.String,
    }),
  }) {}

// more ai related features
// - add more tools
// - task workflows ...
export class AgentEvents extends Events.make(AgentEventGroup, {
  handlers: (handlers) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const client = yield* ClientEvents

      yield* sql`
        CREATE TABLE IF NOT EXISTS hi_messages (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `

      return handlers
        .handle('SetName', ({ payload }) => {
          return Effect.gen(function* () {
            yield* Effect.log('set name from client', payload.name)
            // 将结果通过新的 Client 事件发送回去
            yield* client('Hi', {
              id: Math.round(Math.random() * 1000),
              message: `Hi ${payload.name}`,
            })
          }).pipe(Effect.orDie)
        })
        .handle('Hi', ({ payload }) =>
          Effect.gen(function* () {
            yield* Effect.log('agent received hi', payload.id, payload.message)
            yield* sql`
              INSERT INTO hi_messages (id, name) VALUES (${payload.id}, ${payload.message})
            `
          }).pipe(Effect.orDie),
        )
    }),
}) {}

export class ClientEvents extends Events.make(ClientEventGroup, {
  handlers: (handlers) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      yield* sql`
        CREATE TABLE IF NOT EXISTS hi_messages (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `

      return handlers
        .handle('SetName', ({ payload }) =>
          Effect.gen(function* () {
            // 应该什么都不做
            yield* Effect.log('client trigger set name', payload.name)
          }),
        )
        .handle('Hi', ({ payload }) =>
          Effect.gen(function* () {
            yield* Effect.log('client received hi', payload.id, payload.message)
            yield* sql`
              INSERT INTO hi_messages (id, name) VALUES (${payload.id}, ${payload.message})
            `
          }).pipe(Effect.orDie),
        )
    }),
}) {}
