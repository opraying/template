import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'

declare type i18nKey = string

export interface TranslationT {
  (
    key: i18nKey,
    options?: {
      language?: string
      namespace?: string
      keyPrefix?: string
    },
  ): string

  (
    key: Array<i18nKey>,
    options?: {
      language?: string
      namespace?: string
      keyPrefix?: string
    },
  ): Array<string>
}

export interface I18n {
  language: () => string
  languages: () => ReadonlyArray<string>
  resolveLanguage: () => string | undefined
  locale: () => string
  t: TranslationT
  changeLanguage: (language: string) => Effect.Effect<void>
}

export const I18n = Context.GenericTag<I18n>('@i18n')

const withI18n = <E, A>(effect: (i18n: I18n) => Effect.Effect<A, E>) =>
  pipe(
    Effect.context<never>(),
    Effect.map((ctx) => Context.get(ctx as Context.Context<I18n>, I18n)),
    Effect.flatMap(effect),
  )

export const language = withI18n((i18n) => Effect.sync(i18n.language))

export const languages = withI18n((i18n) => Effect.sync(i18n.languages))

export const resolveLanguage = withI18n((i18n) => Effect.sync(i18n.resolveLanguage))

export const locale = withI18n((i18n) => Effect.sync(i18n.locale))

export const t = (...args: Parameters<I18n['t']>) => withI18n((i18n) => Effect.succeed(i18n.t(...args)))

export const changeLanguage = (language: string) => withI18n((i18n) => i18n.changeLanguage(language))

export const getI18nKey = (arg: i18nKey) => {
  return arg
}
