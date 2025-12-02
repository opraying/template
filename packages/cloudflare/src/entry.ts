import type { ExportedHandler, Response } from '@cloudflare/workers-types'
import { CloudflareEmailHandle } from '@xstack/cloudflare/entry/email'
import { CloudflareFetchHandle } from '@xstack/cloudflare/entry/fetch'
import { CloudflareQueueHandle } from '@xstack/cloudflare/entry/queue'
import { CloudflareScheduledHandle } from '@xstack/cloudflare/entry/scheduled'
import type * as Layer from 'effect/Layer'

export const make = <Env extends Record<string, unknown>>(handles: {
  fetch?: Layer.Layer<CloudflareFetchHandle, never, never> | undefined
  queue?: Layer.Layer<CloudflareQueueHandle, never, never>
  scheduled?: Layer.Layer<CloudflareScheduledHandle, never, never>
  email?: Layer.Layer<CloudflareEmailHandle, never, never>
}) => {
  const handlers: ExportedHandler<Env, unknown, unknown> = {}

  if (handles.fetch) {
    const layer = handles.fetch
    handlers.fetch = (request, env, ctx) => {
      return CloudflareFetchHandle.run(
        { request: request as any, env, context: ctx },
        layer,
      ) as unknown as Promise<Response>
    }
  }

  if (handles.queue) {
    const layer = handles.queue
    handlers.queue = (batch, env, ctx) => {
      return CloudflareQueueHandle.run(batch, env, ctx, layer)
    }
  }

  if (handles.scheduled) {
    const layer = handles.scheduled
    handlers.scheduled = (controller, env, ctx) => {
      return CloudflareScheduledHandle.run(controller, env, ctx, layer)
    }
  }

  if (handles.email) {
    const layer = handles.email
    handlers.email = (message, env, ctx) => {
      return CloudflareEmailHandle.run(message, env, ctx, layer)
    }
  }

  return handlers
}

export * from '@xstack/cloudflare/entry/email'
export * from '@xstack/cloudflare/entry/fetch'
export * from '@xstack/cloudflare/entry/queue'
export * from '@xstack/cloudflare/entry/scheduled'
