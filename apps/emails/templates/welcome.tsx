import { defaultProps, make } from '@xstack/emails/templates/welcome'
import * as emailConfig from '../config'

export const previewProps = defaultProps

export const Template = make({
  company: emailConfig.config.company,
  theme: emailConfig.theme,
})
