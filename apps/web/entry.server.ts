import { headers } from '@shared/config.server'

// #if DEV
//@ts-ignore
import * as server from '@xstack/react-router/entry/server'
// #else
//@ts-ignore
import * as server from '@xstack/react-router/entry/worker'
// #endif

export default server.make({ headers })

export const handleError = server.handleError
