import type * as Cookies from '@effect/platform/Cookies'
import * as Duration from 'effect/Duration'

import type { CookieAttributes } from 'lucia'

export const toCookiesOptions = (
  cookie: CookieAttributes,
  options: Partial<CookieAttributes> = {},
): Cookies.Cookie['options'] => {
  return {
    domain: cookie.domain,
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    sameSite: cookie.sameSite,
    secure: cookie.secure,
    maxAge: Duration.seconds(cookie.maxAge ?? 0),
    ...options,
  }
}
