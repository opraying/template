import type { i18n } from 'i18next'
import type { ReactNode } from 'react'
import { getI18n, I18nextProvider } from 'react-i18next'

export const I18nServerWrapper = ({ children }: { children: ReactNode }) => {
  // @ts-ignore
  const i18n: i18n = getI18n() || globalThis._i18nInstance

  if (!i18n) {
    throw new Error('i18n not found')
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
