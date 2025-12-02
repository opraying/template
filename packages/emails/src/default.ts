import {
  MagicLinkTemplateSchema,
  SubscriptionNotificationTemplateSchema,
  WelcomeTemplateSchema,
} from '@xstack/emails/schema'
import { EmailTemplates } from '@xstack/emails/template'

export const DefaultEmailTemplates = new EmailTemplates({
  'magic-link': MagicLinkTemplateSchema,
  'subscription-purchase': SubscriptionNotificationTemplateSchema,
  'subscription-subscribe': SubscriptionNotificationTemplateSchema,
  'subscription-unsubscribe': SubscriptionNotificationTemplateSchema,
  'subscription-refund': SubscriptionNotificationTemplateSchema,
  welcome: WelcomeTemplateSchema,
})
