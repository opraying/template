import { Lucia, LuciaConfig } from '@xstack/server/lucia/make'
import type { OAuthProviderLiteral } from '@xstack/user-kit/schema'
import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import { TimeSpan } from 'lucia'

export interface AuthWebConfig {
  /**
   * The OAuth providers to use.
   */
  providers: OAuthProviderLiteral[]
  /**
   * Whether to allow users to login with email.
   */
  allowEmailLogin: boolean
  /**
   * Whether to allow users to sign up.
   */
  allowSignup: boolean
  /**
   * The redirect URL after login.
   */
  loginRedirect: string
  /**
   * The redirect URL after sign out.
   */
  signOutRedirect: string
  /**
   * The redirect URL after unauthorized access.
   */
  unauthorizedRedirect: string
}
export const AuthWebConfig = Context.GenericTag<AuthWebConfig>('@userkit:auth-config')

export const REDIRECT_URI = Config.nonEmptyString('DOMAIN').pipe(
  Config.map((domain) => `${domain}/api/oauth/{provider}/callback`),
)

export const OAUTH_CONFIG = Config.all({
  /**
   * The redirect URI for OAuth providers.
   */
  redirectURI: REDIRECT_URI,
  /**
   * The OAuth providers to use.
   */
  providers: Config.all({
    Github: Config.all({
      clientId: Config.string('CLIENT_ID'),
      clientSecret: Config.redacted('CLIENT_SECRET'),
    }).pipe(Config.nested('GITHUB'), Config.option),

    Google: Config.all({
      clientId: Config.string('CLIENT_ID'),
      clientSecret: Config.redacted('CLIENT_SECRET'),
    }).pipe(Config.nested('GOOGLE'), Config.option),
  }),
}).pipe(Config.nested('OAUTH'))
export type OAuthConfig = Config.Config.Success<typeof OAUTH_CONFIG>

export const AuthConfigFromConfig = (
  config: AuthWebConfig,
  lucia: Omit<LuciaConfig, 'sessionExpiresIn' | 'sessionCookie'>,
) =>
  Lucia.Default.pipe(
    Layer.provide(
      Layer.succeed(LuciaConfig, {
        sessionExpiresIn: new TimeSpan(180, 'd'),
        sessionCookie: {
          name: 'x-session',
          expires: true,
          attributes: {
            sameSite: 'strict',
            secure: true,
            path: '/',
          },
        },
        ...lucia,
      }),
    ),
    Layer.provideMerge(Layer.succeed(AuthWebConfig, config)),
  )
