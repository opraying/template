import { defaultProps, make } from '@xstack/emails/templates/subscription-base'
import * as emailConfig from '../config'

export const previewProps = defaultProps

export const Template = make({
  company: emailConfig.config.company,
  theme: emailConfig.theme,
  type: 'refund',
})
