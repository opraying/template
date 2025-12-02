import 'i18next'
import type i18next from 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      // translation: typeof translation
    }
  }
}

// exclude  "translation:*" type
type ExcludeTrans<T> = T extends `translation:${infer U}` ? never : T

declare global {
  declare type i18nKey =
    | ExcludeTrans<
        Exclude<
          Exclude<Parameters<typeof i18next.t>[0], string | string[] | TemplateStringsArray>[number],
          TemplateStringsArray
        >
      >
    | (string & {})
}
