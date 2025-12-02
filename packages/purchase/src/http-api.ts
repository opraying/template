import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import { InvoiceNotFound, ProductNotFound, SubscriptionNotFound } from '@xstack/purchase/errors'
import {
  ProductQuery,
  ProductsQuery,
  ProjectProduct,
  ProjectSubscription,
  ProjectTransaction,
  SubscriptionCancelQuery,
  SubscriptionQuery,
  TransactionQuery,
  TransactionsParams,
  TransactionsQuery,
} from '@xstack/purchase/api/schema'
import { SubscriptionInfo } from '@xstack/purchase/schema'
import * as Schema from 'effect/Schema'

class ProductsApi extends HttpApiGroup.make('products')
  .add(HttpApiEndpoint.get('list', '/').setPath(ProductsQuery).addSuccess(Schema.Array(ProjectProduct)))
  .add(
    HttpApiEndpoint.get('get', '/:productId')
      .setPath(ProductQuery)
      .addSuccess(ProjectProduct)
      .addError(ProductNotFound),
  )
  .annotateContext(
    OpenApi.annotations({
      title: 'Products Api',
      description: 'Products Api',
    }),
  )
  .prefix('/:namespace/products') {}

class SubscriptionApi extends HttpApiGroup.make('subscriptions')
  .add(
    HttpApiEndpoint.get('info', '/')
      .setPath(SubscriptionQuery)
      .addSuccess(SubscriptionInfo)
      .addError(SubscriptionNotFound),
  )
  .add(
    HttpApiEndpoint.get('details', '/details')
      .setPath(SubscriptionQuery)
      .addSuccess(ProjectSubscription)
      .addError(SubscriptionNotFound),
  )
  .add(
    HttpApiEndpoint.post('cancel', '/cancel/:subscriptionId')
      .setPath(SubscriptionCancelQuery)
      .addSuccess(Schema.Void)
      .addError(SubscriptionNotFound),
  )
  .annotateContext(
    OpenApi.annotations({
      title: 'Subscriptions Api',
      description: 'Subscriptions Api',
    }),
  )
  .prefix('/:namespace/subscriptions/:customerId') {}

class TransactionsApi extends HttpApiGroup.make('transactions')
  .add(
    HttpApiEndpoint.get('list', '/')
      .setPath(TransactionsQuery)
      .setUrlParams(TransactionsParams)
      .addSuccess(Schema.Struct({ items: Schema.Array(ProjectTransaction), isLast: Schema.Boolean })),
  )
  .add(
    HttpApiEndpoint.get('invoiceGeneratePDF', '/invoice-generate-pdf/:transactionId')
      .setPath(TransactionQuery)
      .addSuccess(Schema.String)
      .addError(InvoiceNotFound),
  )
  .annotateContext(
    OpenApi.annotations({
      title: 'Transactions Api',
      description: 'Transactions Api',
    }),
  )
  .prefix('/:namespace/transactions/:customerId') {}

export class PurchaseApi extends HttpApi.make('purchase-api')
  .add(ProductsApi)
  .add(SubscriptionApi)
  .add(TransactionsApi)
  .annotateContext(
    OpenApi.annotations({
      title: 'Purchase Api',
      description: 'Purchase Api',
    }),
  ) {}

export class MyHttpApi extends HttpApi.make('api')
  .addHttpApi(PurchaseApi)
  .annotateContext(
    OpenApi.annotations({
      title: 'Payment Api',
      description: 'Payment Api',
    }),
  ) {}
