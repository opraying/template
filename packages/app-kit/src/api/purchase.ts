import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import { InvoiceNotFound, SubscriptionCancelError, SubscriptionNotFound } from '@xstack/purchase/errors'
import { PaymentEnvironmentTag, PaymentProviderTag } from '@xstack/purchase/payment'
import { TransactionId } from '@xstack/purchase/schema'
import { AppPlan, AppSubscription, AppTransaction, SubscriptionQuery } from '@xstack/app-kit/schema'
import * as Ratelimit from '@xstack/server/ratelimit'
import { SessionSecurityMiddleware } from '@xstack/user-kit/middleware'
import * as Schema from 'effect/Schema'

class PlanApi extends HttpApiGroup.make('plans')
  .add(
    HttpApiEndpoint.get('list', '/')
      .addSuccess(
        Schema.Struct({
          namespace: Schema.String,
          plans: Schema.Array(AppPlan),
          system: Schema.Struct({
            provider: PaymentProviderTag,
            providerId: Schema.String,
            environment: PaymentEnvironmentTag,
          }),
        }),
      )
      .annotateContext(
        OpenApi.annotations({
          title: 'List plans',
          description: 'List plans',
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get('list2', '/list')
      .addSuccess(
        Schema.Struct({
          namespace: Schema.String,
          plans: Schema.Array(AppPlan),
          system: Schema.Struct({
            provider: PaymentProviderTag,
            providerId: Schema.String,
            environment: PaymentEnvironmentTag,
          }),
        }),
      )
      .annotateContext(
        OpenApi.annotations({
          title: 'List plans',
          description: 'List plans',
        }),
      ),
  )
  .middleware(Ratelimit.Middleware)
  .prefix('/plans')
  .annotateContext(
    OpenApi.annotations({
      title: 'Plans API',
      description: 'Plans API',
    }),
  ) {}

class SubscriptionApi extends HttpApiGroup.make('subscriptions')
  .add(
    HttpApiEndpoint.get('get', '/')
      .addSuccess(AppSubscription)
      .addError(SubscriptionNotFound)
      .annotateContext(
        OpenApi.annotations({
          title: 'Get current subscription',
          description: 'Get current subscription',
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post('cancel', '/cancel')
      .addSuccess(Schema.Void)
      .addError(SubscriptionNotFound)
      .addError(SubscriptionCancelError)
      .annotateContext(
        OpenApi.annotations({
          title: 'Cancel current subscription',
          description: 'Cancel current subscription',
        }),
      ),
  )
  .middleware(Ratelimit.Middleware)
  .middleware(SessionSecurityMiddleware)
  .prefix('/subscription')
  .annotateContext(
    OpenApi.annotations({
      title: 'Subscriptions API',
      description: 'Subscriptions',
    }),
  ) {}

class TransactionApi extends HttpApiGroup.make('transactions')
  .add(
    HttpApiEndpoint.get('list', '/')
      .setUrlParams(SubscriptionQuery)
      .addSuccess(Schema.Struct({ items: Schema.Array(AppTransaction), isLast: Schema.Boolean }))
      .annotateContext(
        OpenApi.annotations({
          title: 'List transactions',
          description: 'List all transactions for the current user',
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get('invoicePDF', '/invoice-pdf/:transactionId')
      .setPath(Schema.Struct({ transactionId: TransactionId }))
      .addError(InvoiceNotFound)
      .addSuccess(Schema.Void)
      .annotateContext(
        OpenApi.annotations({
          title: 'Get invoice PDF',
          description: 'Get invoice PDF for the transaction',
        }),
      ),
  )
  .middleware(Ratelimit.Middleware)
  .middleware(SessionSecurityMiddleware)
  .prefix('/transactions')
  .annotateContext(
    OpenApi.annotations({
      title: 'Transactions API',
      description: 'API for managing transactions',
    }),
  ) {}

export class PurchaseHttpApi extends HttpApi.make('api')
  .add(PlanApi)
  .add(SubscriptionApi)
  .add(TransactionApi)
  .prefix('/api/purchase')
  .annotateContext(
    OpenApi.annotations({
      title: 'Purchase API',
      description: 'Purchase',
    }),
  ) {}
