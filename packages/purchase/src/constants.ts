import type { CustomerId } from '@xstack/purchase/schema'
import * as Schema from 'effect/Schema'

export const AppNamespace = Schema.String
export type AppNamespace = typeof AppNamespace.Type

export const KV_PRODUCTS_KEY = '__products'
export const getProductsCacheKey = (namespace: string) => `${KV_PRODUCTS_KEY}::${namespace}`

export const KV_CUSTOMER_KEY = '__customer'
export const getCustomerCacheKey = (customerId: CustomerId) => `${KV_CUSTOMER_KEY}::${customerId}`

export const KV_SUBSCRIPTION_KEY = '__subscription'
export const getSubscriptionCacheKey = (namespace: string, customerId: CustomerId) =>
  `${KV_SUBSCRIPTION_KEY}::${namespace}::${customerId}`

export const KV_TRANSACTIONS_KEY = '__transactions'
export const getTransactionsCacheKey = (namespace: string, customerId: CustomerId) =>
  `${KV_TRANSACTIONS_KEY}::${namespace}::${customerId}`
