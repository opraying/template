import { useGlobalConfig } from '@xstack/react-router/global/config'
import { useTranslation } from 'react-i18next'
import { useMatches } from 'react-router'

export interface PreloadTranslationsProps {
  loadPath: string
}

/**
 * Preload the translations files for the current language and the namespaces
 * required by the routes.
 *
 * It receives a single `loadPath` prop with the path to the translation files.
 *
 * @example
 * <PreloadTranslations loadPath="/locales/{{lng}}/{{ns}}.json" />
 *
 */
export function PreloadTranslations({ loadPath }: PreloadTranslationsProps) {
  const { i18n } = useTranslation()

  const namespaces = [
    'translation',
    ...new Set(
      useMatches()
        .filter((route) => (route.handle as { i18n?: string | string[] })?.i18n !== undefined)
        .flatMap((route) => (route.handle as { i18n: string | string[] }).i18n),
    ),
  ]

  const lang = i18n.language

  return (
    <>
      {namespaces.map((namespace) => {
        return (
          <link
            key={namespace}
            rel="preload"
            as="fetch"
            href={loadPath.replace('{{lng}}', lang).replace('{{ns}}', namespace)}
          />
        )
      })}
    </>
  )
}

export const useLanguageOptions = () => {
  const ctx = useGlobalConfig()

  return ctx.languages
}

// @ts-ignore
export const getI18nKey = (arg: i18nKey) => {
  return arg
}
