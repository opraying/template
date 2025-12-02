import * as WorkerService from '@xstack/cloudflare/worker-service'
import { Emailer } from '@xstack/server/emailer'
import {
  EmailerConfig,
  type EmailMessage,
  EmailSendError,
  EmailSendPayload,
  type EmailTemplateMessage,
  EmailTemplateSendPayload,
} from '@xstack/server/emailer/schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpBody from '@effect/platform/HttpBody'

const EmailerHttpClientLive = WorkerService.make('infra-emailer', () => 'EMAILER')

/**
 * Forward the email sending task to the Worker Service
 */
export const EmailerFetchLive = Layer.effect(
  Emailer,
  Effect.gen(function* () {
    const useClient = HttpClient.HttpClient.pipe(
      Effect.map(HttpClient.filterStatusOk),
      Effect.provide(EmailerHttpClientLive),
    )

    const send = (message: EmailMessage) =>
      Effect.gen(function* () {
        const { provider, emailer, namespace } = yield* EmailerConfig.pipe(Effect.orDie)
        const apiKey = yield* provider.apiKey.pipe(Effect.orDie)
        const client = yield* useClient
        const emailFrom = yield* Option.orElse(Option.fromNullable(message.options.from), () => emailer.from)
        const encode = Schema.encode(Schema.parseJson(EmailSendPayload))
        const data = yield* pipe(
          encode({
            namespace,
            provider: {
              ...provider,
              apiKey,
            },
            message: {
              ...message,
              options: {
                ...message.options,
                from: emailFrom,
              },
            },
          }),
          Effect.catchTag(
            'ParseError',
            (cause) =>
              new EmailSendError({
                message: 'encode send message failed',
                cause,
              }),
          ),
          Effect.withSpan('Emailer.encodeSendPayload'),
        )

        yield* client
          .post('/send', { body: HttpBody.text(data) })
          .pipe(
            Effect.mapError(
              (error) => new EmailSendError({ message: `email send error ${error.message}`, cause: error }),
            ),
          )
      }).pipe(
        Effect.withSpan('Emailer.send'),
        Effect.catchTag('NoSuchElementException', (error) => new EmailSendError({ message: error.message })),
      )

    const sendTemplate = (template: string, message: EmailTemplateMessage) =>
      Effect.gen(function* () {
        const { provider, emailer, namespace } = yield* EmailerConfig.pipe(Effect.orDie)
        const apiKey = yield* provider.apiKey.pipe(Effect.orDie)
        const client = yield* useClient
        const emailFrom = yield* Option.orElse(Option.fromNullable(message.options.from), () => emailer.from)
        const encode = Schema.encode(Schema.parseJson(EmailTemplateSendPayload))
        const data = yield* pipe(
          encode({
            namespace,
            provider: {
              ...provider,
              apiKey,
            },
            template,
            message: {
              ...message,
              options: {
                ...message.options,
                from: emailFrom,
              },
            },
          }),
          Effect.catchTag(
            'ParseError',
            (cause) => new EmailSendError({ message: 'encode template message failed', cause }),
          ),
          Effect.withSpan('Emailer.encodeTemplatePayload'),
        )

        yield* client.post('/sendTemplate', { body: HttpBody.text(data) }).pipe(
          Effect.mapError(
            (error) =>
              new EmailSendError({
                message: `email template send error: ${error.message}`,
                cause: error.cause || error,
              }),
          ),
        )
      }).pipe(
        Effect.withSpan('Emailer.sendTemplate'),
        Effect.catchTag('NoSuchElementException', (error) => new EmailSendError({ message: error.message })),
      )

    return {
      send,
      sendTemplate,
    }
  }),
)
