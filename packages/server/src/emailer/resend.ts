import { EmailerProvider, type ResendError } from '@xstack/server/emailer/provider'
import {
  type EmailProviderSendOptions,
  EmailSendError,
  encodeEmailSendOptions,
  ProviderEnvConfig,
} from '@xstack/server/emailer/schema'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'

const isErrorResponse = (res: any): res is ResendError => {
  if (res.id) {
    return false
  }

  return res?.statusCode && res.statusCode !== 200
}

interface ResendOptions {
  from: string
  to: string | ReadonlyArray<string> | undefined
  subject: string
  bcc?: string | ReadonlyArray<string> | undefined
  cc?: string | ReadonlyArray<string> | undefined
  reply_to?: string | ReadonlyArray<string> | undefined
  scheduled_at?: string | undefined
  html?: string
  text?: string
}

interface ResendResult {
  id?: string | undefined
}

export const ResendLive = Layer.effect(
  EmailerProvider,
  Effect.gen(function* () {
    const config = yield* ProviderEnvConfig

    const send = (body: ResendOptions) =>
      Effect.tryPromise({
        try: (signal) =>
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${Redacted.value(config.apiKey)}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })
            .then((res) => res.json())
            .then((res) => {
              const result = res as ResendResult | ResendError

              if (isErrorResponse(result)) {
                const error = new Error(result.message)
                error.name = result.name

                return Promise.reject(error)
              }

              return result.id
            }),
        catch: (error: any) =>
          new EmailSendError({
            message: `Resend send email failed: ${error.message || ''}`,
            cause: error,
          }),
      })

    const text = (options: EmailProviderSendOptions, content: string) =>
      encodeEmailSendOptions(options).pipe(
        Effect.flatMap((result) =>
          send({
            from: result.from,
            subject: result.subject,
            to: result.to,
            bcc: result.to,
            cc: result.cc,
            scheduled_at: result.scheduledAt,
            text: content,
          }),
        ),
        Effect.asVoid,
        Effect.catchTag(
          'ParseError',
          (error) => new EmailSendError({ message: 'send email parse error', cause: error }),
        ),
        Effect.withSpan('Emailer.send-text'),
      )

    const html = (options: EmailProviderSendOptions, content: string) =>
      encodeEmailSendOptions(options).pipe(
        Effect.flatMap((result) =>
          send({
            from: result.from,
            subject: result.subject,
            to: result.to,
            bcc: result.bcc,
            cc: result.cc,
            scheduled_at: result.scheduledAt,
            html: content,
          }),
        ),
        Effect.asVoid,
        Effect.catchTag(
          'ParseError',
          (error) => new EmailSendError({ message: 'send email parse error', cause: error }),
        ),
        Effect.withSpan('Emailer.send-html'),
      )

    return {
      text,
      html,
    }
  }),
)
