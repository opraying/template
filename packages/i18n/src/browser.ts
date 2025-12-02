import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { getI18n } from 'react-i18next'
import { I18n, type TranslationT } from './i18n'
import { resolveLocaleFromLanguage } from './locale-utils'

export const I18nLive = Layer.effect(
  I18n,
  Effect.sync(() => {
    return {
      changeLanguage: (language: string) => Effect.sync(() => getI18n().changeLanguage(language)),
      language: () => getI18n().language,
      languages: () => getI18n().languages,
      resolveLanguage: () => getI18n().resolvedLanguage,
      locale: () => resolveLocaleFromLanguage(getI18n().language),
      t: ((key, options) => {
        const fixedT = getI18n().getFixedT(
          (options?.language || getI18n().language) as any,
          (options?.namespace || 'translation') as any,
          options?.keyPrefix,
        ) as any

        if (typeof key === 'string') {
          return fixedT(key)
        }

        return key.map((k) => fixedT(k))
      }) as TranslationT,
    } as I18n
  }),
)
