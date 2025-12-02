import { defaultProps, make } from '@xstack/emails/templates/magic-link'
import * as emailConfig from '../config'

export const previewProps = defaultProps

export const Template = make({
  company: emailConfig.config.company,
  theme: emailConfig.theme,
})
