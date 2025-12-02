import type { EmailMessage, EmailSendError, EmailTemplateMessage } from '@xstack/server/emailer/schema'
import * as Effect from 'effect/Effect'

export class Emailer extends Effect.Tag('@server:emailer')<
  Emailer,
  {
    /**
     * Send text or html messages
     */
    readonly send: (message: EmailMessage) => Effect.Effect<void, EmailSendError>
    /**
     * Send template message
     */
    readonly sendTemplate: (template: string, message: EmailTemplateMessage) => Effect.Effect<void, EmailSendError>
  }
>() {}
