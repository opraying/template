import { SqlClient } from '@effect/sql/SqlClient'
import { type Controller, SQLiteAdapter } from '@xstack/server/lucia/sqlite-adapter'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import type {
  RegisteredDatabaseSessionAttributes,
  RegisteredDatabaseUserAttributes,
  Session,
  SessionCookieOptions,
  User,
  UserId,
} from 'lucia'
import { Lucia as Lucia_, TimeSpan } from 'lucia'

interface TableNames {
  user: string
  session: string
}

export type ValidateSession = {
  user: User
  session: Session
}
type LuciaOptions = ConstructorParameters<typeof Lucia_>[1]

export interface LuciaConfig {
  tables: TableNames
  sessionExpiresIn?: TimeSpan
  sessionCookie?: SessionCookieOptions
  getSessionAttributes?: (databaseSessionAttributes: RegisteredDatabaseSessionAttributes) => {}
  getUserAttributes?: (databaseUserAttributes: RegisteredDatabaseUserAttributes) => {}
}

export const LuciaConfig = Context.GenericTag<LuciaConfig>('@server:lucia-config')

const make = Effect.gen(function* () {
  const { tables, sessionCookie, getUserAttributes, getSessionAttributes, sessionExpiresIn } = yield* LuciaConfig

  const sqlClient = yield* SqlClient

  const ctl: Controller = {
    execute: (sql, args) => Effect.runPromise(Effect.asVoid(sqlClient.unsafe(sql, args).withoutTransform)),
    get: (sql, args) =>
      Effect.runPromise(Effect.map(sqlClient.unsafe(sql, args).withoutTransform, (_) => (_ ? _[0] : null) as any)),
    getAll: (sql, args) => Effect.runPromise(sqlClient.unsafe(sql, args).withoutTransform) as Promise<any[]>,
  }

  const adapter = new SQLiteAdapter(ctl, {
    user: tables.user,
    session: tables.session,
  })

  const luciaOptions: LuciaOptions = {}
  if (sessionCookie) {
    luciaOptions.sessionCookie = sessionCookie
  }
  if (getUserAttributes) {
    luciaOptions.getUserAttributes = getUserAttributes
  }
  if (getSessionAttributes) {
    luciaOptions.getSessionAttributes = getSessionAttributes
  }
  if (sessionExpiresIn) {
    luciaOptions.sessionExpiresIn = sessionExpiresIn
  } else {
    luciaOptions.sessionExpiresIn = new TimeSpan(30, 'd')
  }

  const lucia = new Lucia_(adapter, luciaOptions)

  const getValidateSessionOption = Option.liftPredicate<
    Awaited<ReturnType<typeof lucia.validateSession>>,
    ValidateSession
  >((n) => n.user !== null && n.session !== null)

  const getUserSessions = (userId: UserId) => Effect.promise(() => lucia.getUserSessions(userId))

  const validateSession = (sessionId: string) =>
    Effect.promise(() => lucia.validateSession(sessionId)).pipe(Effect.map(getValidateSessionOption))

  const createSession = (
    userId: UserId,
    attributes: RegisteredDatabaseSessionAttributes = {},
    options?: {
      sessionId?: string
    },
  ) => Effect.promise(() => lucia.createSession(userId, attributes, options))

  const invalidateSession = (sessionId: string) => Effect.promise(() => lucia.invalidateSession(sessionId))

  const invalidateUserSessions = (userId: UserId) => Effect.promise(() => lucia.invalidateUserSessions(userId))

  const deleteExpiredSessions = Effect.promise(() => lucia.deleteExpiredSessions())

  const readSessionCookie = (cookieHeader: string) =>
    Effect.sync(() => Option.fromNullable(lucia.readSessionCookie(cookieHeader)))

  const readBearerToken = (authorizationHeader: string) =>
    Effect.sync(() => Option.fromNullable(lucia.readBearerToken(authorizationHeader)))

  const createSessionCookie = (sessionId: string) => Effect.sync(() => lucia.createSessionCookie(sessionId))

  const createBlankSessionCookie = Effect.sync(() => lucia.createBlankSessionCookie())

  return {
    getUserSessions,
    validateSession,
    createSession,
    invalidateSession,
    invalidateUserSessions,
    deleteExpiredSessions,
    readSessionCookie,
    readBearerToken,
    createSessionCookie,
    createBlankSessionCookie,
  }
})

export class Lucia extends Context.Tag('@server:lucia')<Lucia, Effect.Effect.Success<typeof make>>() {
  static Default = Layer.effect(this, make)
}
