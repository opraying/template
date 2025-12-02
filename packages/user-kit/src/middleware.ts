import * as HttpApiMiddleware from '@effect/platform/HttpApiMiddleware'
import { Unauthorized } from '@xstack/user-kit/errors'
import type { SessionId, SessionUser } from '@xstack/user-kit/schema'
import { SessionSecurity } from '@xstack/user-kit/security'
import * as Context from 'effect/Context'

export interface CurrentAuthSession {
  user: typeof SessionUser.Type
  sessionId: SessionId
}
export const CurrentAuthSession = Context.GenericTag<CurrentAuthSession>('@userkit:current-auth-session')

export class SessionSecurityMiddleware extends HttpApiMiddleware.Tag<SessionSecurityMiddleware>()(
  'SessionSecurityMiddleware',
  {
    provides: CurrentAuthSession,
    failure: Unauthorized,
    security: {
      cookie: SessionSecurity,
    },
  },
) {}
