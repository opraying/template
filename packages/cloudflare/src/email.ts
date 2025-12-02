import type { EmailMessage } from '@cloudflare/workers-types'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'

export interface EmailEvent {
  readonly raw: ReadableStream<Uint8Array>
  readonly headers: Headers
  readonly rawSize: number
  setReject: (reason: string) => Effect.Effect<void>
  forward: (rcptTo: string, headers?: Headers) => Effect.Effect<void>
  reply: (message: EmailMessage) => Effect.Effect<void>
}
export const EmailEvent = Context.GenericTag<EmailEvent>('@cloudflare:email-message')
