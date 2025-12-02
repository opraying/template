import * as Cloudflare from '@xstack/cloudflare/context'
import * as Layer from 'effect/Layer'
import * as Emailer from '@xstack/cloudflare/emailer-fetch'

export const CloudflareLive = Layer.provideMerge(
  Layer.mergeAll(Emailer.EmailerFetchLive, Layer.empty),
  Cloudflare.CloudflareLive,
)
