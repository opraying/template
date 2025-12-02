import { Emailer } from '@xstack/server/emailer'
import { LocalLive } from '@xstack/server/emailer/local'
import { EmailerMultiProvider } from '@xstack/server/emailer/provider'
import { ResendLive } from '@xstack/server/emailer/resend'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const EmailerNodeLive = Layer.effect(
  Emailer,
  Effect.gen(function* () {
    const send = () => Effect.dieMessage('emailer send not implemented')

    const sendTemplate = () => Effect.dieMessage('email send template not implemented')

    return {
      send,
      sendTemplate,
    }
  }),
).pipe(
  Layer.provide(
    EmailerMultiProvider.make({
      local: LocalLive,
      resend: ResendLive,
    }),
  ),
)
