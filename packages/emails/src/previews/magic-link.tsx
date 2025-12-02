import { renderPlaceholder } from '@xstack/emails/config'
import { placeholder } from '@xstack/emails/utils'
import { defaultProps, type MagicLinkTemplateProps, make } from '../templates/magic-link'

export * from '../templates/magic-link'

export const previewProps: MagicLinkTemplateProps = renderPlaceholder
  ? defaultProps
  : {
      loginCode: 'AX2F-5XF9',
      hint: 'You can set a permanent password in Settings & members → My account.',
    }

export const Template = make({
  company: placeholder.company,
})
