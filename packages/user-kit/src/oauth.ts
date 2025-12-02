import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpClient from '@effect/platform/HttpClient'
import { S3 } from '@xstack/server/s3'
import { OAuthAppError, OAuthInternalError } from '@xstack/user-kit/errors'
import { OAuthProvider, type OAuthStateOptions, type OAuthUserResult } from '@xstack/user-kit/oauth/provider'
import { AccountRepo, UserRepo } from '@xstack/user-kit/repo'
import type { OAuthProviderLiteral } from '@xstack/user-kit/schema'
import { OAuthCodeVerifierSecurity, OAuthStateSecurity } from '@xstack/user-kit/security'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Struct from 'effect/Struct'

const downloadAvatar = (avatarUrl: string, meta: Record<string, string>) => {
  const hash = crypto.randomUUID()
  const filename = `avatars-${hash}.jpeg`

  return HttpClient.get(avatarUrl).pipe(
    Effect.flatMap((_) => _.arrayBuffer),
    Effect.provide(FetchHttpClient.layer),
    Effect.flatMap((buffer) =>
      Effect.flatMap(S3, (s3) =>
        s3.put(filename, buffer, {
          httpMetadata: { contentType: 'image/jpeg' },
          customMetadata: meta,
        }),
      ),
    ),
    Effect.as(filename),
    Effect.orElseSucceed(() => ''),
  )
}

export class OAuth extends Effect.Service<OAuth>()('@userkit:oauth', {
  accessors: true,
  effect: Effect.gen(function* () {
    const userRepo = yield* UserRepo
    const accountRepo = yield* AccountRepo

    const accountCheck = Effect.fn(function* (provider: OAuthProviderLiteral, result: OAuthUserResult) {
      const { email } = result

      if (Option.isNone(email)) {
        return yield* new OAuthInternalError({ message: 'OAuth account missing email' })
      }

      const user = yield* userRepo.findByEmail(email.value)

      // 检查用户是否存在
      const ensureUser = yield* Option.match(user, {
        // 如果用户不存在，创建新用户并关联账户
        onNone: Effect.fn(function* () {
          // 下载头像
          const fetchAvatar = result.avatarUrl.pipe(
            Option.map((_) => downloadAvatar(_, { email: email.value })),
            Option.getOrElse(() => Effect.succeed('')),
          )

          const user = yield* pipe(
            fetchAvatar,
            Effect.flatMap((avatar) =>
              userRepo.insert({
                email: email.value,
                emailVerified: true,
                username: Option.getOrElse(result.username, () => email.value.split('@')[0]),
                avatar,
              }),
            ),
          )

          return user
        }),
        onSome: Effect.fn(function* (user) {
          if (!user.avatar) {
            const userUpdated = yield* result.avatarUrl.pipe(
              Effect.transposeMapOption((_) =>
                pipe(
                  downloadAvatar(_, { email: email.value }),
                  Effect.flatMap((avatar) =>
                    userRepo.update({
                      ...Struct.omit(user, 'updatedAt'),
                      avatar,
                    }),
                  ),
                ),
              ),
              Effect.map(Option.getOrElse(() => user)),
            )

            return userUpdated
          }

          return user
        }),
      })

      const account = yield* accountRepo.findByUserIdAndProvider({
        userId: ensureUser.id,
        providerId: provider,
      })

      yield* Option.match(account, {
        onNone: Effect.fn(function* () {
          // 创建关联账户
          yield* accountRepo.insert({
            userId: ensureUser.id,
            providerId: provider,
            accountId: result.uniqueId,
            raw: result.raw,
          })
        }),
        onSome: Effect.fn(function* (account) {
          // 更新账号信息
          yield* accountRepo.updateById({
            id: account.id,
            userId: ensureUser.id,
            providerId: provider,
            accountId: result.uniqueId,
            raw: result.raw,
          })
        }),
      })

      yield* Effect.annotateCurrentSpan({ userId: ensureUser.id, email: ensureUser.email })
      yield* Effect.logDebug('oauth ensure user completed')

      return { user: ensureUser, account }
    }, Effect.withSpan('oauth.accountCheck'))

    return {
      /**
       * 获取授权URL
       */
      getAuthorizationUrl: (options: OAuthStateOptions) =>
        Effect.flatMap(OAuthProvider, (oauthProvider) => oauthProvider.getAuthorizationUrl(options)),

      /**
       * OAuth 回调处理
       */
      callback: (
        provider: any,
        cookiesPayload: { state: string; codeVerifier: Option.Option<string> },
        payload: { callbackState: string; state: string; code: string },
      ) =>
        Effect.if(cookiesPayload.state === payload.callbackState, {
          onFalse: () => new OAuthAppError({ message: 'Invalid state', reason: 'invalid-state' }),
          onTrue: () =>
            Effect.flatMap(OAuthProvider, (oauthProvider) =>
              oauthProvider
                .callback({
                  code: payload.code,
                  state: payload.state,
                  codeVerifier: cookiesPayload.codeVerifier,
                })
                .pipe(Effect.flatMap((result) => accountCheck(provider, result))),
            ),
        }).pipe(Effect.withSpan('oauth.callback')),
    }
  }),
  dependencies: [UserRepo.Default, AccountRepo.Default],
}) {}

export const oauthStateSecurityDecode = HttpApiBuilder.securityDecode(OAuthStateSecurity)
export const oauthCodeVerifierSecurityDecode = HttpApiBuilder.securityDecode(OAuthCodeVerifierSecurity)
