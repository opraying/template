// @ts-ignore side effect import
import '@client/api-client'
import * as KeyValueStore from '@effect/platform/KeyValueStore'
import * as BrowserKeyValueStore from '@effect/platform-browser/BrowserKeyValueStore'
import * as ApiClient from '@xstack/app-kit/api/client'
import { BasicLive } from '@xstack/preset-web/browser'
import { useAtomRefresh, useAtomSet, useAtomValue, Atom } from '@xstack/atom-react'
import { appStatusUtils } from '@xstack/react-router/utils'
import { Navigate } from '@xstack/router'
import { Toaster } from '@xstack/toaster'
import type { MyHttpApi } from '@xstack/user-kit/api'
import { useAuthConfig } from '@xstack/user-kit/authentication/components/auth-provider'
import { AUTH_USER_NAME, SYNC_STORAGE_EVENT_NAME } from '@xstack/user-kit/constants'
import type { LoginError, VerifyError } from '@xstack/user-kit/errors'
import type { Auth, SessionUser as InternalUser } from '@xstack/user-kit/schema'
import * as Context from 'effect/Context'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import type * as ParseResult from 'effect/ParseResult'
import * as Schedule from 'effect/Schedule'
import * as Schema from 'effect/Schema'
import * as SchemaAST from 'effect/SchemaAST'

const useClient = ApiClient.client.getClient<typeof MyHttpApi>('default')

// @ts-ignore
export type PublicUser = any

export type { InternalUser }

export type OAuthOptions =
  | {
      portal: false
      url: string
    }
  | {
      portal: true
      onSuccess?: (() => void) | undefined
      onFailure?: ((cause?: unknown) => void) | undefined
      url: string
      width?: number
      height?: number
    }

export interface AuthSignOutButtonProps {
  /**
   * 是否刷新
   */
  reload?: boolean | undefined
  /**
   * 退出后的重定向地址
   */
  redirect?: string | undefined
  /**
   * 退出后的回调
   */
  redirectCallback?: (() => void) | undefined
  /**
   * 是否关闭 App Flag
   */
  clearAppDisable?: boolean | undefined
  /**
   * 是否退出后重定向
   */
  clearRedirect?: boolean
  /**
   * 是否保持 App Flag 开启状态
   */
  keepAppEnable?: boolean | undefined
}

const LOG_SPAN = '@user-kit/auth'

const UserFromJson = Schema.parseJson(Schema.make<PublicUser>(new SchemaAST.AnyKeyword()))

const encodeUser = Schema.encodeUnknown(UserFromJson)

const decodeUser = Schema.decodeUnknown(UserFromJson)

const notificationStorageChange = (newUser: PublicUser | undefined, oldUser?: PublicUser | undefined) =>
  Effect.sync(() =>
    dispatchEvent(
      new CustomEvent(SYNC_STORAGE_EVENT_NAME, {
        detail: {
          key: AUTH_USER_NAME,
          newValue: newUser,
          oldValue: oldUser,
          storageArea: localStorage,
        },
      }),
    ),
  ).pipe(
    Effect.zipRight(
      Effect.logTrace('storage change notification sent').pipe(Effect.annotateLogs({ newUser, oldUser })),
    ),
  )

const persistenceUser = Effect.fn(
  function* (user: PublicUser) {
    const kv = yield* KeyValueStore.KeyValueStore
    const value = yield* encodeUser(user)

    yield* kv.set(AUTH_USER_NAME, value)
    yield* notificationStorageChange(user)

    // @ts-ignore
    globalThis.__x_token_change?.(undefined)

    yield* Effect.logTrace('user data persisted to local storage')
  },
  Effect.orDie,
  Effect.withSpan('persistenceUser'),
)

const clearUser = Effect.fn(
  function* () {
    const kv = yield* KeyValueStore.KeyValueStore

    const oldUser = yield* kv.get(AUTH_USER_NAME).pipe(Effect.tap(kv.remove(AUTH_USER_NAME)))
    yield* notificationStorageChange(undefined, Option.getOrUndefined(oldUser))

    // @ts-ignore
    globalThis.__x_token_change?.()

    yield* Effect.logTrace('user data cleared from local storage')
  },
  Effect.orDie,
  Effect.withSpan('clearUser'),
)

const getInitialUser = pipe(
  KeyValueStore.KeyValueStore,
  Effect.bindTo('kv'),
  Effect.bind('user', ({ kv }) => kv.get(AUTH_USER_NAME)),
  Effect.flatMap(
    ({ user }) => decodeUser(Option.getOrUndefined(user)) as Effect.Effect<InternalUser, ParseResult.ParseError>,
  ),
  Effect.optionFromOptional,
  Effect.orElseSucceed(() => Option.none<InternalUser>()),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
  Effect.withSpan('getInitialUser'),
)

const initialUser = Effect.runSync(getInitialUser)

export const authSession = Atom.make({ user: initialUser }).pipe(Atom.keepAlive)

const runtime = Atom.runtime(Layer.mergeAll(BasicLive, BrowserKeyValueStore.layerLocalStorage))

const AtomContext = Context.GenericTag<Atom.FnContext>('@userkit:atom-context')

const loadAuthSessionAtom = runtime.atom((ctx) =>
  Effect.gen(function* () {
    yield* Effect.logTrace('starting auth session load')

    const remoteUser = useClient.pipe(
      Effect.flatMap((client) => client.session.getSession()),
      Effect.tap(Effect.logTrace('remote user data fetched successfully')),
      Effect.tap((user) => ctx.set(authSession, { user: Option.some(user) })),
      Effect.tap((user) => persistenceUser(user as any)),
      Effect.catchTags({
        '@userkit:unauthorized': () =>
          pipe(
            Effect.logTrace('unauthorized access detected, clearing session'),
            Effect.tap(ctx.set(authSession, { user: Option.none() })),
            Effect.tap(clearUser),
            Effect.as(null),
          ),
      }),
      Effect.catchAllCause((cause) => Effect.logError('auth session load failed', cause)),
    )

    yield* Effect.logTrace('loaded initial user state').pipe(
      Effect.annotateLogs({ hasUser: Option.isSome(initialUser) }),
    )

    const user = yield* initialUser.pipe(
      Effect.tap(
        Effect.logTrace('initiating remote user sync in background').pipe(Effect.tap(Effect.forkScoped(remoteUser))),
      ),
      Effect.orElse(() =>
        Effect.logTrace('no initial user found, fetching from remote').pipe(Effect.zipRight(remoteUser)),
      ),
      Effect.map(Option.fromNullable),
    )

    yield* Effect.logTrace('auth session load completed').pipe(Effect.annotateLogs({ user }))

    return user
  }).pipe(Effect.uninterruptible, Effect.withLogSpan(LOG_SPAN), Effect.withSpan('loadAuthSessionAtom')),
)

const refreshUserSession = Effect.gen(function* () {
  const ctx = yield* AtomContext
  const toast = yield* Toaster

  yield* Effect.logTrace('initiating auth session refresh')

  yield* useClient.pipe(
    Effect.flatMap((client) => client.session.getSession()),
    Effect.tap((user) => ctx.set(authSession, { user: Option.some(user) })),
    Effect.tap((user) => persistenceUser(user as any)),
    Effect.catchTags({
      '@userkit:unauthorized': () =>
        pipe(
          Effect.sync(() => ctx.set(authSession, { user: Option.none() })),
          Effect.tap(clearUser),
          Effect.tap(Effect.logTrace('auth session cleared')),
        ),
    }),
    Effect.tap(Effect.logTrace('auth session refreshed successfully')),
    Effect.tapErrorCause((cause) => Effect.logError('auth session refresh failed', cause)),
    Effect.catchAll((error) => toast.error(error.message)),
  )
})

const refreshAuthSessionAtom = runtime.atom((ctx) =>
  pipe(
    refreshUserSession,
    Effect.provideService(AtomContext, ctx),
    Effect.withLogSpan(LOG_SPAN),
    Effect.withSpan('refreshAuthSessionAtom'),
  ),
)

// ----- Internal -----

/**
 * Init Auth Session
 */
export const useAuthInit = () => useAtomValue(loadAuthSessionAtom)

/**
 *  Refresh Auth session
 */
export const useAuthRefresh = () => useAtomRefresh(refreshAuthSessionAtom)

// ---- Public Hooks ----

export const useAuthSession = () =>
  useAtomValue(
    authSession as unknown as Atom.Writable<{ user: Option.Option<PublicUser> }, { user: Option.Option<PublicUser> }>,
  )

export const useUserEnsure = () =>
  useAtomValue(authSession.pipe(Atom.map((_) => Option.getOrUndefined(_.user) as PublicUser)))

export const useUser = () => useAtomValue(authSession.pipe(Atom.map((_) => _.user as Option.Option<PublicUser>)))

const signOutSubmit = runtime.fn((options: AuthSignOutButtonProps, ctx) =>
  Effect.gen(function* () {
    const redirect = options.redirect ?? '/login'
    const clearRedirect = options.clearRedirect ?? true
    const reload = options.reload ?? false
    const clearAppDisable = options.clearAppDisable ?? true
    const keepAppEnable = options.keepAppEnable ?? false
    const toast = yield* Toaster
    const navigate = yield* Navigate

    yield* Effect.annotateLogsScoped({ ...options })
    yield* Effect.logTrace('initiating sign out process')

    const client = yield* useClient

    yield* client.auth.signOut().pipe(
      Effect.catchTags({
        // 如果用户未登录，则忽略错误
        '@userkit:unauthorized': () => Effect.void,
      }),
      Effect.tapErrorCause((cause) => Effect.logError('sign out failed', cause)),
      Effect.tapError((error) => toast.error(error.message)),
    )

    // clear marketing user
    yield* clearUser()

    yield* Effect.logTrace('sign out request completed')

    if (clearAppDisable) {
      appStatusUtils.disableApp()
      yield* Effect.logTrace('application disabled after sign out')

      if (clearRedirect) {
        yield* navigate.replace('/')
      }
    }

    if (keepAppEnable) {
      appStatusUtils.enableApp()
      yield* Effect.logTrace('application re-enabled as requested')
    }

    yield* Effect.sleep('150 millis').pipe(
      Effect.tap(clearUser()),
      Effect.tap(ctx.set(authSession, { user: Option.none() })),
      Effect.tap(Effect.logTrace('auth session cleared')),
      Effect.ignore,
      Effect.fork,
    )

    if (reload) {
      yield* Effect.logTrace('redirecting to login page after sign out')
      window.location.href = redirect
      return
    }

    // options.redirectCallback?.()
  }).pipe(Effect.uninterruptible, Effect.withLogSpan(LOG_SPAN), Effect.withSpan('signOutSubmit')),
)

export const useAuthSignOutButton = () => {
  const authConfig = useAuthConfig()
  const signOut = useAtomSet(signOutSubmit, { mode: 'promise' })

  return (options: AuthSignOutButtonProps = {}) =>
    signOut({
      ...options,
      redirect: options.redirect ?? authConfig.signOutRedirect,
    })
}

const LoginFlowStep = Atom.make<1 | 2>(1)

const LoginFlowEmail = Atom.make('')

export const useLoginFlowStep = () => useAtomValue(LoginFlowStep)

export const useLoginFlowEmail = () => useAtomValue(LoginFlowEmail)

const loginSubmit = runtime.fn(
  (
    {
      data,
      onSuccess,
      onError,
    }: {
      data: Auth.LoginForm
      onSuccess?: () => void
      onError?: (error: LoginError) => void
    },
    ctx,
  ) =>
    Effect.gen(function* () {
      const toast = yield* Toaster

      yield* Effect.annotateLogsScoped({ email: data.email })
      yield* Effect.logTrace('processing login attempt')

      const client = yield* useClient

      // TODO: fix type
      yield* client.auth.login({ payload: data as any }).pipe(
        Effect.tap(Effect.logTrace('login authentication successful')),
        Effect.tapErrorCause((cause) => Effect.logError('login authentication failed', cause)),
        Effect.tapError((error) => {
          /**
           * 将 login error 交给应用 onError 处理
           */
          if (error._tag === '@userkit:login-error') return Effect.ignore(Effect.try(() => onError?.(error)))

          return toast.error(error.message)
        }),
        Effect.orDie,
      )

      ctx.set(LoginFlowStep, 2)
      ctx.set(LoginFlowEmail, data.email)

      yield* Effect.logTrace('advancing to verification step 2')

      yield* Effect.ignore(Effect.try(() => onSuccess?.()))
    }).pipe(Effect.uninterruptible, Effect.withLogSpan(LOG_SPAN), Effect.withSpan('loginSubmit')),
)

export const useLoginSubmit = () => useAtomSet(loginSubmit, { mode: 'promise' })

const verifyEmailCodeSubmit = runtime.fn(
  (
    {
      data,
      portal = false,
      onSuccess,
      onError,
    }: {
      data: Auth.EmailVerificationCode
      portal?: boolean
      onSuccess?: () => void
      onError?: (error: VerifyError) => void
    },
    ctx,
  ) =>
    Effect.gen(function* () {
      const toast = yield* Toaster

      yield* Effect.annotateLogsScoped({ portal })

      yield* Effect.logTrace('Email verification started')

      const client = yield* useClient

      yield* client.auth.verifyEmailCode({ payload: data }).pipe(
        Effect.tap(Effect.logTrace('Email verification successful')),
        Effect.tapErrorCause((cause) => Effect.logError('Email verification failed', cause)),
        Effect.tapError((error) => {
          /**
           * 将 verify error 交给应用 onError 处理
           */
          if (error._tag === '@userkit:verify-error') return Effect.ignore(Effect.try(() => onError?.(error)))

          return toast.error(error.message)
        }),
        Effect.orDie,
      )

      appStatusUtils.enableApp()

      if (!portal) {
        yield* Effect.logTrace('Verification completed')
        yield* Effect.ignore(Effect.try(() => onSuccess?.()))
        return
      }

      yield* Effect.logTrace('Refreshing auth session')

      yield* pipe(
        refreshUserSession,
        Effect.provideService(AtomContext, ctx),
        Effect.tapBoth({
          onSuccess: () => Effect.logTrace('Auth session refreshed'),
          onFailure: (cause) => Effect.logError('Failed to refresh auth session', cause),
        }),
        Effect.ignore,
      )
    }).pipe(Effect.uninterruptible, Effect.withLogSpan(LOG_SPAN), Effect.withSpan('verifyEmailCodeSubmit')),
)

export const useVerifyEmailCodeSubmit = () => useAtomSet(verifyEmailCodeSubmit, { mode: 'promise' })

const handleOAuthOpenerAtom = runtime.fn((options: OAuthOptions, ctx) =>
  Effect.gen(function* () {
    const { url, portal } = options

    yield* Effect.annotateLogsScoped(options)
    yield* Effect.logTrace('start oauth flow')

    if (!portal) {
      yield* Effect.logTrace('redirect to oauth url')
      window.location.href = url
      return
    }

    const { width = 600, height = 600 } = options

    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',')

    const popup = window.open(url, '_blank', features)

    if (!popup) {
      return yield* Effect.dieMessage('failed to open popup')
    }

    yield* Effect.logTrace('open popup').pipe(
      Effect.annotateLogs({
        features,
      }),
    )
    yield* Effect.ignore(Effect.try(() => popup.focus()))

    const popupClosed = yield* Deferred.make()

    yield* Effect.addFinalizer(() => Effect.logTrace('oauth flow scope closed'))

    yield* Deferred.await(popupClosed).pipe(
      Effect.tap(Effect.logTrace('refresh auth session')),
      Effect.tap(
        pipe(
          refreshUserSession,
          Effect.provideService(AtomContext, ctx),
          Effect.tapBoth({
            onSuccess: () => {
              options.onSuccess?.()
              return Effect.logTrace('auth session refreshed')
            },
            onFailure: (cause) => {
              options.onFailure?.(cause)
              return Effect.logError('failed to refresh auth session', cause)
            },
          }),
          Effect.ignore,
        ),
      ),
      Effect.forkScoped,
    )

    const popupStatusCheck = Effect.suspend(() => {
      if (popup.closed) {
        return Effect.logTrace('popup closed').pipe(Effect.zipRight(Deferred.succeed(popupClosed, undefined)))
      }

      return Effect.logTrace('popup not closed')
    })

    const schedule = Schedule.spaced('1 seconds').pipe(Schedule.upTo('5 minutes'))

    yield* popupStatusCheck.pipe(
      Effect.repeat({ schedule, until: () => popup.closed }),
      Effect.tap(Effect.try(() => popup.close()).pipe(Effect.ignore)),
      Effect.forkScoped,
    )
  }).pipe(Effect.uninterruptible, Effect.withLogSpan(LOG_SPAN), Effect.withSpan('handleOAuthOpener')),
)

export const useOAuthOpener = () => useAtomSet(handleOAuthOpenerAtom)
