import { describe, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as Paddle from '@xstack/purchase/payment/internal/paddle-sdk'

const TestPaddle = Paddle.PaddleSdk.Default.pipe(
  Layer.provide(
    Paddle.PaddleConfigFromRecord({
      apiToken: Redacted.make('c52cdaa9cf9fb54ee768991b85c26eba0259d90e10f4341a4c'),
      webhookToken: Redacted.make('pdl_ntfset_01jcabpgj9ft3pxhrhc04svt0b_HaFBjn6n3'),
      environment: 'sandbox',
    }),
  ),
)

it.layer(TestPaddle)('Paddle SDK', ({ effect }) => {
  describe.skip('products', () => {
    effect('list products', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.products.list()
        console.log(res)
      }),
    )

    effect('get product', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.products.get({ productId: 'pro_01je39ksv737pf9gqc17x26shg' })
        console.log(res)
      }),
    )
  })

  describe.skip('prices', () => {
    effect('list prices', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.prices.list()
        console.log(res)
      }),
    )

    effect('get price', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.prices.get({ priceId: 'pri_01je3ars7jpk9g35jk1h034rkx' })
        console.log(res)
      }),
    )
  })

  describe.skip('customers', () => {
    effect('list customers', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.customers.list()
        console.log(res)
      }),
    )

    effect.skip('get customer', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.customers.get({ customerId: 'ctm_01jc66tchc3fjz46j3nt081fas' })
        console.log(res)
      }),
    )

    effect.skip('create customer', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const userId = 'test__'
        const email = 'test@test.com'

        const res = yield* sdk.customers.create({ email, userId })
        console.log(res)
      }),
    )

    effect('update customer', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const email = 'test2@test.com'

        const res = yield* sdk.customers.update({ customerId: 'ctm_01jp7k30m8xfvsv10y4mq9gxnm', email })
        console.log(res)
      }),
    )
  })

  describe.skip('transactions', () => {
    effect('list transactions', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.transactions.list({ customerId: 'ctm_01jp7k30m8xfvsv10y4mq9gxnm' })
        console.log(res)
      }),
    )

    effect('get transaction', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.transactions.get({ transactionId: 'txn_01jgkdz3wztdj93nq84xaq73fy1' })
        console.log(res)
      }),
    )
  })

  describe.skip('subscriptions', () => {
    effect('list subscriptions', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.subscriptions.list({ customerId: 'ctm_01jp7k30m8xfvsv10y4mq9gxnm' })
        console.log(res)
      }),
    )

    effect('get subscription', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.subscriptions.get({ subscriptionId: 'sub_01jc66wby1xh91gz2azjebwa4a' })
        console.log(res)
      }),
    )

    effect('cancel subscription', () =>
      Effect.gen(function* () {
        const sdk = yield* Paddle.PaddleSdk

        const res = yield* sdk.subscriptions.cancel({ subscriptionId: 'sub_01jc66wby1xh91gz2azjebwa4a' })
        console.log(res)
      }),
    )
  })
})
