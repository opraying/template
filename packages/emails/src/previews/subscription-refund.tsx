import { renderPlaceholder } from '@xstack/emails/config'
import { placeholder } from '@xstack/emails/utils'
import { defaultProps, make, type SubscriptionNotificationTemplateProps } from '../templates/subscription-base'

export * from '../templates/subscription-base'

export const previewProps: SubscriptionNotificationTemplateProps = renderPlaceholder
  ? defaultProps
  : {
      customer: {
        name: 'Randy',
        email: 'randy@acme.com',
      },
      plan: {
        name: 'Pro Plan',
        price: '$99.99',
        interval: 'month',
      },
      subtotal: '$99.99',
      discount: {
        description: '10% off',
        amount: '$10.00',
      },
      tax: {
        rate: '8.25%',
        amount: '$8.25',
      },
      total: '$91.74',
      date: '2024-01-01',
      orderId: '123456',
      invoiceUrl: 'https://acme.com/invoice/123456',
    }

export const Template = make({
  company: placeholder.company,
  type: 'refund',
})
