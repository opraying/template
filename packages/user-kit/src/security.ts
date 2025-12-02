import * as HttpApiSecurity from '@effect/platform/HttpApiSecurity'

export const OAuthStateSecurity = HttpApiSecurity.apiKey({
  key: 'x-oauth-state',
  in: 'cookie',
})
export const OAuthCodeVerifierSecurity = HttpApiSecurity.apiKey({
  key: 'x-oauth-code-verifier',
  in: 'cookie',
})

export const SessionSecurity = HttpApiSecurity.apiKey({
  key: 'x-session',
  in: 'cookie',
})
