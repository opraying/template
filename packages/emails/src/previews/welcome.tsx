import { renderPlaceholder } from '@xstack/emails/config'
import { placeholder } from '@xstack/emails/utils'
import { defaultProps, make, type WelcomeTemplateProps } from '../templates/welcome'

export * from '../templates/welcome'

export const previewProps: WelcomeTemplateProps = renderPlaceholder
  ? defaultProps
  : {
      message: 'Hello, world!',
    }

export const Template = make({
  company: placeholder.company,
})
