import { plans } from '@client/scheduler-plans'
import { Live as WorkerLive } from '@client/worker-context'
import { run } from '@xstack/local-first/worker'

run({ layer: WorkerLive, plans })
