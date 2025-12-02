import { Button } from '@xstack/emails/components/button'
import { Footer } from '@xstack/emails/components/footer'
import { Header } from '@xstack/emails/components/header'
import { Heading } from '@xstack/emails/components/heading'
import { EmailLayout } from '@xstack/emails/components/layout'
import { Link, Text } from '@xstack/emails/components/text'
import type { ThemeColors } from '@xstack/emails/components/theme-context'
import type { CompanyInfo } from '@xstack/emails/components/types'
import { Head } from 'jsx-email'
import { SubscriptionNotificationTemplateSchema } from '../schema'
import { getDefaultProps } from '../template'

export type NotificationType = 'subscribe' | 'unsubscribe' | 'purchase' | 'refund'

export type SubscriptionNotificationTemplateProps = typeof SubscriptionNotificationTemplateSchema.Encoded

export const defaultProps = getDefaultProps(SubscriptionNotificationTemplateSchema)

const planStyles = {
  container: {
    border: '1px solid #e6ebf1',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  planName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  },
  price: {
    fontSize: '16px',
    color: '#525f7f',
  },
  priceBreakdown: {
    borderTop: '1px solid #e6ebf1',
    marginTop: '16px',
    paddingTop: '12px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#525f7f',
    marginBottom: '8px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #e6ebf1',
  },
  meta: {
    fontSize: '13px',
    color: '#8898aa',
    marginTop: '8px',
  },
  refundBadge: {
    backgroundColor: '#10b981',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    marginLeft: '8px',
  },
}

const getNotificationContent = (type: NotificationType, company: CompanyInfo) => {
  switch (type) {
    case 'subscribe':
      return {
        title: 'Welcome to Your New Subscription',
        message: `Thank you for subscribing to ${company.name}`,
      }
    case 'unsubscribe':
      return {
        title: 'Subscription Cancelled',
        message: `We're sorry to see you go. Your ${company.name} subscription has been cancelled`,
      }
    case 'purchase':
      return {
        title: 'Purchase Confirmation',
        message: `Thank you for your purchase from ${company.name}`,
      }
    case 'refund':
      return {
        title: 'Refund Processed',
        message: `Your refund for ${company.name} has been processed`,
      }
  }
}

export const make =
  ({ company, theme, type }: { company: CompanyInfo; theme?: Partial<ThemeColors>; type: NotificationType }) =>
  ({
    plan = defaultProps.plan,
    subtotal = defaultProps.subtotal,
    discount = defaultProps.discount,
    tax = defaultProps.tax,
    total = defaultProps.total,
    date = defaultProps.date,
    nextBillingDate = defaultProps.nextBillingDate,
    orderId = defaultProps.orderId,
    invoiceUrl = defaultProps.invoiceUrl,
    refund = defaultProps.refund,
  }: SubscriptionNotificationTemplateProps = defaultProps) => {
    const content = getNotificationContent(type, company)
    const isRefund = type === 'refund'

    return (
      <EmailLayout preview={content.title} theme={theme}>
        <Head />
        <Header logo={company.logo} />
        <Heading>{content.title}</Heading>
        <Text>{content.message}</Text>
        <div style={planStyles.container}>
          <div style={planStyles.header}>
            <span style={planStyles.planName}>
              {plan.name}
              {isRefund && <span style={planStyles.refundBadge}>Refunded</span>}
            </span>
            <span style={planStyles.price}>
              {plan.price}
              {plan.interval && `/${plan.interval}`}
            </span>
          </div>
          {
            <div style={planStyles.priceBreakdown}>
              {subtotal && (
                <div style={planStyles.priceRow}>
                  <span>Subtotal</span>
                  <span>{subtotal}</span>
                </div>
              )}
              {discount && (
                <div style={planStyles.priceRow}>
                  <span>{discount.description}</span>
                  <span>-{discount.amount}</span>
                </div>
              )}
              {tax && (
                <div style={planStyles.priceRow}>
                  <span>Tax ({tax.rate})</span>
                  <span>{tax.amount}</span>
                </div>
              )}
              <div style={planStyles.totalRow}>
                <span>Total</span>
                <span>{total}</span>
              </div>
            </div>
          }
          <div style={planStyles.meta}>
            {refund && (
              <div style={{ color: '#10b981', marginBottom: '8px' }}>
                Refund Amount: {refund.amount}
                {refund.reason && ` • ${refund.reason}`}
              </div>
            )}
            <div>
              {isRefund ? 'Refund' : 'Order'} Date: {date}
              {orderId && ` • Order #${orderId}`}
            </div>
          </div>
        </div>
        {type === 'subscribe' && <Text>Your next billing date will be {nextBillingDate}.</Text>}
        {invoiceUrl && (
          <Button href={invoiceUrl} height={40} width={260}>
            View {isRefund ? 'Refund' : 'Invoice'}
          </Button>
        )}
        <Text>
          View your purchase details in your <Link href={`${company.url}/account/orders`}>order history</Link>.
        </Text>
        <Footer
          companyName={company.name}
          companyUrl={company.url}
          companyAddress={company.address}
          links={company.links}
        >
          {company.description}
        </Footer>
      </EmailLayout>
    )
  }
