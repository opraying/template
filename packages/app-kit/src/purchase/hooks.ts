import * as Paddle from '@paddle/paddle-js'
import * as ApiClient from '@xstack/app-kit/api/client'
import type { PurchaseHttpApi } from '@xstack/app-kit/api/purchase'
import type { AppSubscription, CustomerCustomData } from '@xstack/app-kit/schema'
import { BasicLive } from '@xstack/preset-web/browser'
import {
  useAtomRefresh,
  useAtomSet,
  useAtomSuspense,
  useAtomValue,
  makeCachingPaginationAtom,
  Atom,
} from '@xstack/atom-react'
import * as Chunk from 'effect/Chunk'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Stream from 'effect/Stream'
import { I18n } from '@xstack/i18n/i18n'
import { useEffect } from 'react'
import { Appearance } from '@xstack/lib/appearance'

const useClient = ApiClient.client.getClient<typeof PurchaseHttpApi>('default')

const runtime = Atom.runtime(BasicLive)

const LOG_SPAN = '@app-it/purchase'

const plansAtom = runtime
  .atom(() =>
    Effect.gen(function* () {
      const client = yield* useClient

      const results = yield* client.plans.list2()

      return results
    }).pipe(Effect.withLogSpan(LOG_SPAN), Effect.withSpan('getPlans')),
  )
  .pipe(Atom.keepAlive)

const subscriptionAtom = runtime
  .atom(() =>
    Effect.gen(function* () {
      const client = yield* useClient

      const subscription = yield* client.subscriptions.get()

      return Option.some(subscription)
    }).pipe(
      Effect.orElseSucceed(() => Option.none<AppSubscription>()),
      Effect.withLogSpan(LOG_SPAN),
      Effect.withSpan('getSubscription'),
    ),
  )
  .pipe(Atom.keepAlive)

const refreshSubscriptionAtom = runtime.fn((_: void, ctx) =>
  Effect.gen(function* () {
    // const client = yield* useClient
    // yield* client.subscriptions.sync()

    ctx.refresh(subscriptionAtom)
    ctx.refresh(plansAtom)
  }).pipe(Effect.withLogSpan(LOG_SPAN), Effect.withSpan('refreshSubscription')),
)

const transactionsStream = ({ perPage }: { perPage: number }) =>
  Stream.paginateChunkEffect(0, (pageNumber) =>
    Effect.flatMap(useClient, (client) => client.transactions.list({ urlParams: { page: pageNumber, perPage } })).pipe(
      Effect.map((results) => [
        Chunk.fromIterable(results.items),
        Option.some(pageNumber + 1).pipe(Option.filter(() => !results.isLast)),
      ]),
    ),
  )

const transactionsAtom = makeCachingPaginationAtom({ perPage: 5 }, transactionsStream)

const paymentInstance = Atom.make(Option.none<Paddle.Paddle>()).pipe(Atom.keepAlive)

const paymentLoadState = Atom.make<'none' | 'loading' | 'loaded'>('none')

const paymentInit = runtime.fn(
  (
    config: {
      providerId: string
      environment: 'sandbox' | 'production'
      onError?: ((error: Error) => void) | undefined
      onSuccess?: (() => void | Promise<void>) | undefined
    },
    ctx,
  ) =>
    Effect.gen(function* () {
      const init = Effect.promise(() =>
        Paddle.initializePaddle({
          token: config.providerId,
          environment: config.environment,
          debug: config.environment === 'sandbox',
          eventCallback(event) {
            if (!event.name) return

            switch (event.name) {
              case Paddle.CheckoutEventNames.CHECKOUT_LOADED:
                ctx.set(paymentLoadState, 'loaded')
                console.debug('paddle sdk ready')
                break
              case Paddle.CheckoutEventNames.CHECKOUT_CLOSED:
                ctx.set(paymentLoadState, 'none')
                break
              case Paddle.CheckoutEventNames.CHECKOUT_COMPLETED:
                console.log('checkout completed')
                config.onSuccess?.()
                break
              case Paddle.CheckoutEventNames.CHECKOUT_FAILED:
                console.log('check out failed')
                config.onError?.(new Error('Checkout failed'))
                break
              default:
                console.log('paddle callback event', event)
            }
          },
        }),
      ).pipe(
        Effect.tap((_) => ctx.set(paymentInstance, Option.fromNullable(_))),
        Effect.tap(Effect.logTrace('paddle initialized')),
      )

      yield* init
    }).pipe(Effect.withLogSpan(LOG_SPAN), Effect.withSpan('initPayment')),
)

const paymentCheckout = runtime.fn(
  (
    config: {
      namespace: string
      environment: 'sandbox' | 'production'
      provider: string
      providerId: string
      priceId: string
      userId: string
      email: string
    },
    ctx,
  ) =>
    Effect.gen(function* () {
      const paddle = yield* ctx.some(paymentInstance)
      const { locale } = yield* I18n
      const { resolvedAppearance } = yield* Appearance

      ctx.set(paymentLoadState, 'loading')

      yield* Effect.sync(() =>
        paddle.Checkout.open({
          items: [{ priceId: config.priceId, quantity: 1 }],
          customData: {
            namespace: config.namespace,
            userId: config.userId,
          } satisfies CustomerCustomData,
          customer: {
            email: config.email,
          },
          settings: {
            displayMode: 'inline',
            frameTarget: 'checkout-container',
            frameInitialHeight: 940,
            frameStyle: 'width: 100%; min-height: 940px;',
            allowLogout: false,
            variant: 'one-page',
            theme: resolvedAppearance(),
            locale: locale(),
          },
        }),
      )
    }).pipe(Effect.withLogSpan(LOG_SPAN), Effect.withSpan('checkout')),
)

export const usePaymentInit = (config: {
  providerId: string
  environment: 'sandbox' | 'production'
  onError?: ((error: Error) => void) | undefined
  onSuccess?: (() => void | Promise<void>) | undefined
}) => useAtomSet(paymentInit)(config)

export const usePaymentLoadState = () => useAtomValue(paymentLoadState)

export const usePaymentCheckout = (config: {
  namespace: string
  environment: 'sandbox' | 'production'
  provider: string
  providerId: string
  priceId: string
  userId: string
  email: string
}) => {
  const init = useAtomSet(paymentCheckout)

  useEffect(() => {
    init({
      namespace: config.namespace,
      environment: config.environment,
      provider: config.provider,
      providerId: config.providerId,
      priceId: config.priceId,
      email: config.email,
      userId: config.userId,
    })
  }, [
    config.environment,
    config.provider,
    config.providerId,
    config.priceId,
    config.userId,
    config.email,
    config.namespace,
    init,
  ])
}

export const usePlans = () => useAtomSuspense(plansAtom)

export const usePlansRefresh = () => useAtomRefresh(plansAtom)

export const useSubscription = () => useAtomSuspense(subscriptionAtom)

export const useSubscriptionRefresh = () => useAtomSet(refreshSubscriptionAtom, { mode: 'promise' })

export const useTransactions = () => transactionsAtom.use()
