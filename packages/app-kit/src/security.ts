import * as HttpApiSecurity from '@effect/platform/HttpApiSecurity'
import { key } from '@xstack/react-router/utils'

/**
 *  flag: 0 | 1
 */
export const AppFlagSecurity = HttpApiSecurity.apiKey({
  key,
  in: 'cookie',
})
