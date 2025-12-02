import { Api } from '@client/api-client'
import { DBLive } from '@client/db'
import { CoreWorkerPool } from '@client/worker-pool'
import { make } from '@xstack/local-first/context'

export const { Live } = make({
  CoreWorkerLive: CoreWorkerPool.Live,
  DBLive,
  inputLayer: Api.Default,
})
