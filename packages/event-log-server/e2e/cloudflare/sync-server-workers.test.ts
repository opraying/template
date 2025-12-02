import { NodeContext } from '@effect/platform-node'
import * as W from '@xstack/preset-cloudflare/testing/workers'
import * as Test from '@xstack/server-testing/workers'
import { Effect, Layer } from 'effect'
import { basename, resolve } from 'node:path'

const TestLive = W.workers({
  persist: basename(import.meta.url),
  cwd: resolve(import.meta.dirname, '..', 'fixtures/sync-server'),
  tsconfig: resolve(import.meta.dirname, '../../', 'tsconfig.json'),
  env: {
    NAMESPACE: 'sync-server',
    NAME: 'test',
  },
  additionalWorkers: [
    { path: resolve(import.meta.dirname, '..', 'fixtures/sync-agent-client/wrangler.jsonc') },
    { path: resolve(import.meta.dirname, '..', 'fixtures/storage-proxy/wrangler.jsonc') },
  ],
}).pipe(Layer.provideMerge(NodeContext.layer))

Test.test(TestLive)('EventLogServer workers', (it) => {
  it.effect(
    'should pass',
    Effect.fn(function* () {
      const w = yield* W.Miniflare

      const res = yield* w.fetch('http://localhost/sync', {
        headers: {
          Upgrade: 'websocket',
        },
      })

      yield* Effect.log(res.status)
    }),
  )
})
