import { alphabet, generateRandomString } from '@xstack/user-kit/random'
import type {
  AccountId,
  Email,
  EmailVerificationAction,
  OAuthProviderLiteral,
  ProviderID,
  UserId,
} from '@xstack/user-kit/schema'
import { Account, EmailVerificationCode, TABLES, User } from '@xstack/user-kit/tables'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'

export class UserRepo extends Effect.Service<UserRepo>()('@userkit:user-repo', {
  effect: Effect.gen(function* () {
    const repo = yield* User.repo
    const sql = repo.sql

    const findById = (id: UserId) =>
      repo
        .select(sql<typeof User.select.Encoded>`SELECT * FROM ${sql(User.table)} WHERE id = ${id}`)
        .single.pipe(Effect.orDie)

    const findByEmail = (email: Email) =>
      repo.select(sql<typeof User.select.Encoded>`SELECT * FROM ${sql(User.table)} WHERE email = ${email}`).single

    const insert = (data: Parameters<typeof User.insert.make>[0]) =>
      repo.insert((input) => {
        return sql<typeof User.select.Encoded>`INSERT INTO ${sql(User.table)} ${sql.insert(input)} returning *`
      }, User.insert.make(data))
    // .pipe(Effect.orDie)

    const update = (data: Parameters<typeof User.update.make>[0]) =>
      repo
        .update(
          (input) =>
            sql<
              typeof User.select.Encoded
            >`UPDATE ${sql(User.table)} SET ${sql.update(input)} WHERE id = ${input.id} returning *`,
          User.update.make(data),
        )
        .pipe(Effect.orDie)

    const deleteById = (id: UserId) => sql`DELETE FROM ${sql(User.table)} WHERE id = ${id}`.pipe(Effect.orDie)

    return {
      findById,
      findByEmail,
      insert,
      update,
      deleteById,
    } as const
  }),
  dependencies: [],
}) {}

export class AccountRepo extends Effect.Service<AccountRepo>()('@userkit:account-repo', {
  effect: Effect.gen(function* () {
    const repo = yield* Account.repo
    const sql = repo.sql

    /**
     * find account by id
     * @param accountId
     * @returns
     */
    const findById = (accountId: AccountId) =>
      repo.select(sql<typeof Account.select.Encoded>`SELECT * FROM ${sql(TABLES.account)} WHERE id = ${accountId}`)
        .single

    /**
     * find account by email
     */
    const findByEmail = (email: Email) =>
      repo.select(
        sql<typeof Account.select.Encoded>`
          SELECT * FROM ${sql(Account.table)} WHERE email = ${email} LIMIT 1
        `,
      ).single

    /**
     * find account by userID
     */
    const findByUserId = (id: UserId) =>
      repo.select(sql<typeof Account.select.Encoded>`SELECT * FROM ${sql(TABLES.account)} WHERE user_id = ${id}`).single

    const findAccountsByUserId = (id: UserId) =>
      repo.select(sql<typeof Account.select.Encoded>`SELECT * FROM ${sql(TABLES.account)} WHERE user_id = ${id}`)

    const insert = (data: Parameters<typeof Account.insert.make>[0]) =>
      repo.insert(
        (input) => sql<typeof Account.insert.Encoded>`INSERT INTO ${sql(TABLES.account)} ${sql.insert(input)}`,
        Account.insert.make(data),
      )

    const updateById = (data: Parameters<typeof Account.update.make>[0]) =>
      repo.update(
        (input) =>
          sql<
            typeof Account.select.Encoded
          >`UPDATE ${sql(TABLES.account)} SET ${sql.update(input)} WHERE id = ${input.id} returning *`,
        Account.update.make(data),
      )

    const deleteById = (accountId: AccountId) => sql`DELETE FROM ${sql(TABLES.account)} WHERE id = ${accountId}`

    const findByUserIdAndProviderId = (userId: UserId, providerId: OAuthProviderLiteral) =>
      repo.select(
        sql<typeof Account.select.Encoded>`
          SELECT * FROM ${sql(TABLES.account)}
          WHERE user_id = ${userId} AND provider_id = ${providerId}
        `,
      ).single

    // 通过用户 ID 和提供商 ID 获取账户
    const findByUserIdAndProvider = ({ userId, providerId }: { userId: UserId; providerId: ProviderID }) =>
      repo.select(
        sql<typeof Account.select.Encoded>`
          SELECT * FROM ${sql(Account.table)} WHERE user_id = ${userId} AND provider_id = ${providerId} LIMIT 1
        `,
      ).single

    const findExpiringTokens = (thresholdMinutes = 10) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now
        const threshold = DateTime.add(now, { minutes: thresholdMinutes })

        return yield* repo.select(
          sql<typeof Account.select.Encoded>`
            SELECT * FROM ${sql(TABLES.account)}
            WHERE access_token_expires_at IS NOT NULL
            AND access_token_expires_at <= ${DateTime.toDate(threshold).toISOString()}
            AND refresh_token IS NOT NULL
          `,
        )
      })

    // /**
    //  * 执行带有令牌的API请求
    //  */
    // const withAccessToken = <A, E, R>(
    //   { userId, providerId }: { userId: UserId; providerId: OAuthProviderLiteral },
    //   effect: (token: string) => Effect.Effect<A, E, R>,
    // ) =>
    //   Effect.gen(function* () {
    //     const token = yield* getAccessToken({ userId, providerId })
    //     return yield* effect(token)
    //   }).pipe(Effect.withSpan("accounts.withAccessToken"))

    // /**
    //  * 获取用户的有效访问令牌
    //  */
    // const getAccessToken = ({ userId, providerId }: { userId: UserId; providerId: OAuthProviderLiteral }) =>
    //   Effect.gen(function* () {
    //     const account = yield* accountRrepo.findById({ userId, providerId })

    //     if (Option.isNone(account)) {
    //       return yield* Effect.fail(new Error("Account not found"))
    //     }

    //     const now = yield* DateTime.now

    //     // 检查令牌是否过期
    //     if (
    //       account.value.accessTokenExpiresAt &&
    //       DateTime.lessThan(DateTime.parse(account.value.accessTokenExpiresAt), now)
    //     ) {
    //       // 令牌过期，需要刷新
    //       return yield* refreshAccessToken({ accountId: account.value.id })
    //     }

    //     return account.value.accessToken
    //   }).pipe(Effect.withSpan("accounts.getAccessToken"))

    // /**
    //  * 刷新访问令牌
    //  */
    // const refreshAccessToken = ({ accountId }: { accountId: AccountId }) =>
    //   Effect.gen(function* () {
    //     const account = yield* accountRrepo.findById(accountId)

    //     if (Option.isNone(account) || !account.value.refreshToken) {
    //       return yield* Effect.fail(new Error("Cannot refresh token: account or refresh token not found"))
    //     }

    //     // 根据提供商选择不同的刷新逻辑
    //     const refreshResponse = yield* Match.value(account.value.providerId as OAuthProviderLiteral).pipe(
    //       Match.when("Github", () => refreshGithubToken(account.value.refreshToken!)),
    //       Match.when("Google", () => refreshGoogleToken(account.value.refreshToken!)),
    //       Match.exhaustive,
    //     )

    //     // 更新账户记录
    //     const updatedAccount = yield* accountRrepo.updateById({
    //       id: accountId,
    //       accessToken: refreshResponse.accessToken,
    //       accessTokenExpiresAt: refreshResponse.expiresAt,
    //       refreshToken: refreshResponse.refreshToken || account.value.refreshToken,
    //       scope: refreshResponse.scope || account.value.scope,
    //     })

    //     return updatedAccount.accessToken
    //   }).pipe(Effect.withSpan("accounts.refreshAccessToken"))

    return {
      findById,
      findByEmail,
      findByUserId,
      findAccountsByUserId,
      updateById,
      deleteById,
      insert,

      findByUserIdAndProviderId,
      findByUserIdAndProvider,

      findExpiringTokens,
      // getAccessToken,
      // refreshAccessToken,
      // withAccessToken,
    }
  }),
  dependencies: [],
}) {}

export class VerificationCodeRepo extends Effect.Service<VerificationCodeRepo>()('@userkit:verification-codes-repo', {
  effect: Effect.gen(function* () {
    const repo = yield* EmailVerificationCode.repo
    const sql = repo.sql

    const findByCode = (code: string) =>
      repo.select(
        sql<
          typeof EmailVerificationCode.select.Encoded
        >`SELECT * FROM ${sql(TABLES.emailVerificationCodes)} WHERE code = ${code}`,
      ).single

    const findByToken = (token: string) =>
      repo.select(
        sql<
          typeof EmailVerificationCode.select.Encoded
        >`SELECT * FROM ${sql(TABLES.emailVerificationCodes)} WHERE token = ${token}`,
      ).single

    const insert = (data: Parameters<typeof EmailVerificationCode.insert.make>[0]) =>
      repo.insert.void((input) => {
        return sql`INSERT INTO ${sql(TABLES.emailVerificationCodes)} ${sql.insert(input)}`
      }, EmailVerificationCode.insert.make(data))

    const generate = ({ email, action }: { email: Email; action: EmailVerificationAction }) =>
      Effect.gen(function* () {
        const code = Redacted.make(generateRandomString(6, alphabet('0-9')))
        const token = Redacted.make(generateRandomString(26, alphabet('0-9', 'a-z', 'A-Z')))

        const expiresAt = yield* DateTime.now.pipe(Effect.map(DateTime.add({ hours: 6 })))

        yield* insert({ email: email, code, token, action, expiresAt })

        return {
          code,
          token,
        }
      })

    const deleteById = (id: string) => sql`DELETE FROM ${sql(TABLES.emailVerificationCodes)} WHERE id = ${id}`

    const invalidateAll = ({ email, action }: { email: string; action: string }) =>
      sql`DELETE FROM ${sql(TABLES.emailVerificationCodes)} WHERE email = ${email} AND action = ${action}`

    return {
      findByCode,
      findByToken,

      generate,

      deleteById,
      invalidateAll,
    } as const
  }),
  dependencies: [],
}) {}
