import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import { assert, describe, expect, it, vitest } from '@effect/vitest'
import {
  CloudflareEmailHandle,
  CloudflareFetchHandle,
  CloudflareQueueHandle,
  CloudflareScheduledHandle,
  make,
} from '@xstack/cloudflare/entry'
import { Effect, Layer, Logger, LogLevel, Schema } from 'effect'

class SimpleApi extends HttpApiGroup.make('simple').add(
  HttpApiEndpoint.get('simple', '/').addSuccess(Schema.Struct({ message: Schema.String })),
) {}

class TestApi extends HttpApi.make('TestApi').add(SimpleApi) {}

const SimpleApiLive = HttpApiBuilder.group(TestApi, 'simple', (handles) =>
  handles.handle('simple', () =>
    Effect.gen(function* () {
      return {
        message: 'OK',
      }
    }),
  ),
)

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
}

const logLevel = LogLevel.None

describe('CloudflareFetchHandle', () => {
  it('should fetch data from Cloudflare', async () => {
    const Live = HttpApiBuilder.api(TestApi).pipe(
      Layer.provide(SimpleApiLive),
      Layer.provide(Logger.minimumLogLevel(logLevel)),
    )

    const FetchLive = CloudflareFetchHandle.make(Live)

    const handlers = make({ fetch: FetchLive })
    assert(handlers.fetch)

    const res = await handlers.fetch(new Request('https://example.com') as any, {}, mockCtx)
    const json = await res.json()

    expect(json).toEqual({ message: 'OK' })
  })
})

describe('CloudflareQueueHandle', () => {
  it('should queue from Cloudflare', async () => {
    const QueueLive = CloudflareQueueHandle.make(
      Logger.minimumLogLevel(logLevel),
      Effect.fn(function* (event) {
        yield* Effect.logTrace('received queue event')

        yield* event.process<string>(
          Effect.fn(function* (message) {
            yield* Effect.logTrace('processing message', message.id)
          }),
        )
      }),
    )

    const handlers = make({ queue: QueueLive })
    assert(handlers.queue)

    const t1 = vitest.fn()
    const t2 = vitest.fn()

    await handlers.queue(
      {
        messages: [
          {
            id: '1',
            timestamp: new Date(),
            body: 'hi',
            attempts: 0,
            retry: () => {},
            ack: t1,
          },
          {
            id: '2',
            timestamp: new Date(),
            body: 'ray',
            attempts: 1,
            retry: () => {},
            ack: t2,
          },
        ],
        queue: 'test-queue',
        ackAll: () => console.log('ackAll'),
        retryAll: () => console.log('retryAll'),
      },
      {},
      mockCtx,
    )

    expect(t1).toHaveBeenCalled()
    expect(t2).toHaveBeenCalled()
  })
})

describe('CloudflareEmailHandle', () => {
  it('should email message from Cloudflare', async () => {
    const EmailLive = CloudflareEmailHandle.make(
      Logger.minimumLogLevel(logLevel),
      Effect.fn(function* (event) {
        yield* Effect.logTrace('received email event')

        yield* event.forward('test@gmail.com')
      }),
    )

    const handlers = make({ email: EmailLive })
    assert(handlers.email)

    const forward = vitest.fn(() => Promise.resolve())
    const reply = vitest.fn()
    const reject = vitest.fn()

    const raw = new TextEncoder().encode('hello world')
    const rawStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(raw)
        controller.close()
      },
    })

    await handlers.email(
      {
        from: 'test@example.com',
        to: 'test@example.com',
        forward,
        reply,
        setReject: reject,
        headers: new Headers() as any,
        raw: rawStream as any,
        rawSize: raw.length,
      },
      {},
      mockCtx,
    )

    expect(forward).toHaveBeenCalledWith('test@gmail.com')
  })
})

describe('CloudflareScheduledHandle', () => {
  it('should scheduled message from Cloudflare', async () => {
    const ScheduledLive = CloudflareScheduledHandle.make(
      Logger.minimumLogLevel(logLevel),
      Effect.fn(function* (event) {
        yield* Effect.logTrace('received scheduled event')
        expect(event.cron).toBe('0 0 * * *')
        expect(event.scheduledTime).toBeInstanceOf(Date)
      }),
    )

    const handlers = make({ scheduled: ScheduledLive })
    assert(handlers.scheduled)

    await handlers.scheduled(
      {
        cron: '0 0 * * *',
        noRetry: () => Promise.resolve(),
        scheduledTime: Date.now(),
      },
      {},
      mockCtx,
    )
  })
})
