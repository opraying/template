import { make, type WorkerMessage } from '@xstack/local-first/worker'
// oxlint-disable
import Worker from './worker-runner.ts?worker'

export class CoreWorkerPool extends make<WorkerMessage>((name) => new Worker({ name })) {}
