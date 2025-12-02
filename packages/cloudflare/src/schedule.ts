import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export const ScheduledEventSchema = Schema.Struct({
  cron: Schema.String,
  scheduledTime: Schema.DateFromNumber,
})
export interface ScheduledEvent extends Schema.Schema.Type<typeof ScheduledEventSchema> {
  noRetry: Effect.Effect<void>
}
export const ScheduledEvent = Context.GenericTag<ScheduledEvent>('@cloudflare:scheduled-event')
