import * as Dialog from '@xstack/lib/components/dialog'
import { LoginForm } from '@xstack/user-kit/authentication/login'
import { Trans } from 'react-i18next'

export const LoginPortal = Dialog.dialog(
  ({ modal }) => <LoginForm titleVisible={false} portal onSuccess={modal.hideWhen()} />,
  {
    title: <Trans i18nKey="auth.login" />,
    footer: false,
  },
)
