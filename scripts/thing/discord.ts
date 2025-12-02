import { HttpBody, HttpClient } from '@effect/platform'
import { Config, Effect, Layer, String } from 'effect'
import { Notification, NotificationSendError, type SendFailedParams, type SendParams } from './notification'

const DiscordWebHookUrl = Config.string('DISCORD_DEPLOY_WEBHOOK')

export class DiscordNotification {
  static Live = Layer.effect(
    Notification,
    Effect.gen(function* () {
      const webHookUrl = yield* DiscordWebHookUrl

      const client = yield* HttpClient.HttpClient

      // avatar_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
      // avatar_url: "https://octodex.github.com/images/constructocat2.jpg",
      const avatarUrl = 'https://octodex.github.com/images/daftpunktocat-guy.gif'
      const username = 'XStack Deploy'

      const success = ({
        branch,
        branchUrls,
        environment,
        hash,
        logUrl,
        message,
        previewUrls,
        projectName,
        stage,
        nodeEnv,
      }: SendParams) => {
        const embeds = [
          {
            title: '✅ Deployment Succeeded',
            // "#2ecc71"
            color: 3066993,
            fields: [
              {
                inline: false,
                name: '**Project Name**',
                value: projectName,
              },
              {
                inline: true,
                name: '**Stage**',
                value: stage,
              },
              {
                inline: true,
                name: '**Environment**',
                value: environment,
              },
              {
                inline: true,
                name: '**Node Env**',
                value: nodeEnv,
              },
              {
                inline: false,
                name: '**Branch**',
                value: branch,
              },
              {
                inline: false,
                name: '**Message**',
                value: message,
              },
              {
                inline: false,
                name: '**Hash**',
                value: hash,
              },
              {
                inline: false,
                name: '**Deployment Log**',
                value: logUrl,
              },
            ],
          },
        ]

        if (previewUrls) {
          // @ts-ignore
          embeds[0].fields.push({
            inline: false,
            name: '**Preview URL**',
            value: previewUrls.join('\n'),
          })
        }
        if (branchUrls) {
          // @ts-ignore
          embeds[0].fields.push({
            inline: false,
            name: '**Branch URL**',
            value: branchUrls.join('\n'),
          })
        }

        return client
          .post(webHookUrl, {
            body: HttpBody.unsafeJson({
              avatar_url: avatarUrl,
              embeds,
              username,
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            Effect.asVoid,
            Effect.catchAll((error) => new NotificationSendError({ cause: error })),
          )
      }

      const failed = ({ branch, environment, error, hash, message, nodeEnv, projectName, stage }: SendFailedParams) => {
        const embeds = [
          {
            title: '❌ Deployment Failed',
            // #e74c3c
            color: 15158332,
            fields: [
              {
                inline: false,
                name: '**Project Name**',
                value: projectName,
              },
              {
                inline: true,
                name: '**Stage**',
                value: stage,
              },
              {
                inline: true,
                name: '**Environment**',
                value: environment,
              },
              {
                inline: true,
                name: '**Node Env**',
                value: nodeEnv,
              },
              {
                inline: false,
                name: '**Branch**',
                value: branch,
              },
              {
                inline: false,
                name: '**Message**',
                value: message,
              },
              {
                inline: false,
                name: '**Hash**',
                value: hash,
              },
              {
                inline: false,
                name: '**Error**',
                value: error,
              },
            ],
          },
        ]

        return client
          .post(webHookUrl, {
            body: HttpBody.unsafeJson({
              avatar_url: avatarUrl,
              embeds,
              username,
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            Effect.asVoid,
            Effect.catchAll((error) => new NotificationSendError({ cause: error })),
          )
      }

      return Notification.of({
        success,
        failed,
      })
    }),
  )

  static Local = Layer.effect(
    Notification,
    Effect.gen(function* () {
      const success = ({
        branch,
        branchUrls,
        environment,
        hash,
        logUrl,
        message,
        previewUrls,
        projectName,
        stage,
      }: SendParams) => {
        const msg = String.stripMargin(
          `|
           |Project Name:        ${projectName}
           |Hash:                ${hash}
           |Branch:              ${branch}
           |Message:             ${message}
           |Stage:               ${stage}
           |Environment:         ${environment}
           |Deployment Log URL:  ${logUrl}
           |Preview URL:         ${previewUrls.join('\n')}
           |Branch Preview URL:  ${branchUrls.join('\n')}`,
        )

        return Effect.logInfo(`Send discord notification${msg}`)
      }

      const failed = ({ branch, environment, error, hash, message, projectName, stage }: SendFailedParams) => {
        const msg = String.stripMargin(
          `|
           |Project Name:  ${projectName}
           |Hash:          ${hash}
           |Branch:        ${branch}
           |Message:       ${message}
           |Stage:         ${stage}
           |Environment:   ${environment}
           |Error:         ${error}`,
        )

        return Effect.logInfo(`Send discord notification${msg}`)
      }

      return Notification.of({
        success,
        failed,
      })
    }),
  )

  static Default = Layer.suspend(() => {
    return process.env.CI && process.env.GITHUB_REPO ? DiscordNotification.Live : DiscordNotification.Local
  })
}
