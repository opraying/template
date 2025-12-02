import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpBody from '@effect/platform/HttpBody'
import * as HttpClient from '@effect/platform/HttpClient'
import * as Config from 'effect/Config'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'

const DiscordConfig = Config.all({
  WEBHOOK: Config.string('DISCORD_NOTIFY_WEBHOOK').pipe(Config.option),
  AVATAR_URL: Config.string('DISCORD_WEBHOOK_AVATAR_URL').pipe(Config.orElse(() => Config.succeed(''))),
  NODE_ENV: Config.string('NODE_ENV').pipe(Config.orElse(() => Config.succeed('production'))),
  STAGE: Config.string('STAGE').pipe(Config.orElse(() => Config.succeed('production'))),
})

export class NotificationSendError extends Data.TaggedError('NotificationSendError')<{
  readonly cause?: Error | undefined
}> {}

interface SuccessParams {
  webhook?: string | undefined
  username: string
  avatarUrl?: string | undefined
  title: string
  message: string
}

interface FailedParams {
  webhook?: string | undefined
  username: string
  avatarUrl?: string | undefined
  title: string
  error: string
  cause?: string | undefined
}

type EmbedField = {
  name: string
  value: string
  inline?: boolean | undefined
}

interface EmbedsParams {
  webhook?: string | undefined
  username: string
  avatarUrl?: string | undefined
  title: string
  color: number
  fields: EmbedField[]
}

const colors = {
  // "#2ecc71"
  green: 3066993,
  // "#e74c3c"
  red: 15158332,
  // "#f1c40f"
  yellow: 16777215,
  // "#3498db"
  blue: 2020870,
}

const make = Effect.gen(function* () {
  const { WEBHOOK, AVATAR_URL, STAGE, NODE_ENV } = yield* DiscordConfig

  const client = yield* HttpClient.HttpClient

  const success = ({ title, message, username, avatarUrl, webhook }: SuccessParams) => {
    const embeds = [
      {
        title: `✅ ${title}`,
        color: colors.green,
        fields: [
          {
            inline: false,
            name: '**Name**',
            value: username,
          },
          {
            inline: true,
            name: '**Stage**',
            value: STAGE,
          },
          {
            inline: true,
            name: '**Environment**',
            value: NODE_ENV,
          },
          {
            inline: false,
            name: '**Message**',
            value: message,
          },
        ],
      },
    ]

    return client
      .post(webhook || Option.getOrElse(WEBHOOK, () => ''), {
        headers: {
          'Content-Type': 'application/json',
        },
        body: HttpBody.unsafeJson({
          avatar_url: AVATAR_URL || avatarUrl,
          embeds,
          username,
        }),
      })
      .pipe(
        Effect.asVoid,
        Effect.catchAll((error) => new NotificationSendError({ cause: error })),
        Effect.withSpan('Discord.success'),
      )
  }

  const failed = ({ title, error, cause, username, avatarUrl, webhook }: FailedParams) => {
    const embeds = [
      {
        title: `❌ ${title}`,
        color: colors.red,
        fields: [
          {
            inline: false,
            name: '**Name**',
            value: username,
          },
          {
            inline: true,
            name: '**Stage**',
            value: STAGE,
          },
          {
            inline: true,
            name: '**Environment**',
            value: NODE_ENV,
          },
          {
            inline: false,
            name: '**Error**',
            value: error,
          },
          {
            inline: false,
            name: '**Cause**',
            value: cause,
          },
        ],
      },
    ]

    return client
      .post(webhook || Option.getOrElse(WEBHOOK, () => ''), {
        headers: {
          'Content-Type': 'application/json',
        },
        body: HttpBody.unsafeJson({
          avatar_url: AVATAR_URL || avatarUrl,
          embeds,
          username,
        }),
      })
      .pipe(
        Effect.asVoid,
        Effect.catchAll((error) => new NotificationSendError({ cause: error })),
        Effect.withSpan('Discord.failed'),
      )
  }

  const embers = ({ title, color, username, fields, avatarUrl, webhook }: EmbedsParams) => {
    const embeds = [
      {
        title,
        color,
        fields,
      },
    ]

    return client
      .post(webhook || Option.getOrElse(WEBHOOK, () => ''), {
        headers: {
          'Content-Type': 'application/json',
        },
        body: HttpBody.unsafeJson({
          avatar_url: AVATAR_URL || avatarUrl,
          embeds,
          username,
        }),
      })
      .pipe(
        Effect.asVoid,
        Effect.catchAll((error) => new NotificationSendError({ cause: error })),
        Effect.withSpan('Discord.embers'),
      )
  }

  return {
    success,
    failed,
    embers,
  } as const
})

const makeLocal = Effect.gen(function* () {
  const { STAGE, NODE_ENV } = yield* DiscordConfig.pipe(Effect.orDie)

  const success = ({ title, message, username }: SuccessParams) => {
    const msg = `
Name:                | ${username}
Title:               | ${title}
Message:             | ${message}
Stage:               | ${STAGE}
Environment:         | ${NODE_ENV}`

    return Effect.logInfo(`Send discord notification${msg}`).pipe(Effect.withSpan('Discord.success'))
  }

  const failed = ({ title, error, cause, username }: FailedParams) => {
    const msg = `
Name:                | ${username}
Title:               | ${title}
Error:               | ${error}
Cause:               | ${cause}`

    return Effect.logInfo(`Send discord notification${msg}`).pipe(Effect.withSpan('Discord.failed'))
  }

  const embers = ({ title, color, username, fields }: EmbedsParams) => {
    const msg = `
Name:                | ${username}
Title:               | ${title}
Color:               | ${color}
Fields:              | ${fields.map((field) => `${field.name}: ${field.value}`).join(',')}`

    return Effect.logInfo(`Send discord notification${msg}`).pipe(Effect.withSpan('Discord.embers'))
  }

  return {
    success,
    failed,
    embers,
  } as const
})

export class DiscordNotification extends Effect.Tag('@server:discord-notification')<
  DiscordNotification,
  Effect.Effect.Success<typeof make>
>() {
  static Live =
    // @ts-ignore
    process.env.NODE_ENV === 'production'
      ? Layer.effect(this, make).pipe(Layer.provide(FetchHttpClient.layer), Layer.orDie)
      : Layer.effect(DiscordNotification, makeLocal)

  static Colors = colors
}

export const DiscordEmpty = Layer.effect(DiscordNotification, makeLocal)
