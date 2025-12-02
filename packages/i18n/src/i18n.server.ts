import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { getI18n } from 'react-i18next'
import { I18n, type TranslationT } from './i18n'
import { resolveLocaleFromLanguage } from './locale-utils'

export const I18nLive = Layer.effect(
  I18n,
  Effect.gen(function* () {
    const lazyI18n = () => {
      if (!getI18n()) {
        // @ts-ignore
        globalThis.initI18n()
      }

      // TODO: fix language is undefined
      return getI18n() as ReturnType<typeof getI18n>
    }

    return {
      language: () => lazyI18n().language ?? 'en',
      languages: () => lazyI18n().languages,
      resolveLanguage: () => lazyI18n().resolvedLanguage,
      locale: () => resolveLocaleFromLanguage(lazyI18n().language, ['en']),
      changeLanguage: (lng: string) => Effect.sync(() => lazyI18n().changeLanguage(lng)),
      t: ((key, options) => {
        const i18n = lazyI18n()

        const fixedT = i18n.getFixedT(
          (options?.language || i18n.language) as any,
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
