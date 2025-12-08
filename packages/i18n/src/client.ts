// @ts-ignore
import { pick } from 'accept-language-parser'
import i18n, { type BackendModule, type InitOptions, type LanguageDetectorModule } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { findCookieByName } from './utils'

interface CookieOptions {
  name: string
}

export interface LanguageDetectorOption {
  /**
   * Define the list of supported languages, this is used to determine if one of
   * the languages requested by the user is supported by the application.
   * This should be be same as the supportedLngs in the i18next options.
   */
  supportedLanguages: string[]
  /**
   * Define the fallback language that it's going to be used in the case user
   * expected language is not supported.
   * This should be be same as the fallbackLng in the i18next options.
   */
  fallbackLanguage: string
  /**
   * If you want to use a cookie to store the user preferred language, you can
   * pass the Cookie object here.
   */
  cookie?: CookieOptions
  /**
   * If you want to use search parameters for language detection and want to
   * change the default key used to for the parameter name,
   * you can pass the key here.
   * @default "lng"
   */
  searchParamKey?: string
  /**
   * The order the library will use to detect the user preferred language.
   * By default the order is
   * - searchParams
   * - cookie
   * - session
   * - header
   * And finally the fallback language.
   */
  order?: Array<'searchParams' | 'cookie' | 'html-tag'> | undefined
}

export class LanguageDetector {
  private options: LanguageDetectorOption
  constructor(options: LanguageDetectorOption) {
    this.options = options
    this.isCookieOnly(options)
  }

  private isCookieOnly(options: LanguageDetectorOption) {
    if (options.order?.length === 1 && options.order[0] === 'cookie' && !options.cookie) {
      throw new Error('You need a cookie if you want to only get the locale from the cookie')
    }
  }

  public detect(): string {
    const order = this.options.order ?? ['searchParams', 'cookie', 'html-tag']

    for (const method of order) {
      let locale: string | null = null

      if (method === 'searchParams') {
        locale = this.fromSearchParams()
      }

      if (method === 'cookie') {
        locale = this.fromCookie()
      }

      if (method === 'html-tag') {
        locale = this.fromHtmlTag()
      }

      if (locale) return locale
    }

    return this.options.fallbackLanguage
  }

  private fromSearchParams(): string | null {
    const searchParams = new URLSearchParams(window.location.search)

    if (!searchParams.has(this.options.searchParamKey ?? 'lng')) {
      return null
    }
    return this.fromSupported(searchParams.get(this.options.searchParamKey ?? 'lng'))
  }

  private fromCookie(): string | null {
    const cookieOptions = this.options.cookie || { name: 'x-lng' }
    const cookieStr = document.cookie || ''

    const lng = findCookieByName(cookieOptions.name, cookieStr)
    if (!lng) return null

    return this.fromSupported(lng)
  }

  private fromHtmlTag(): string | null {
    const locales = document.documentElement.lang

    return this.fromSupported(locales)
  }

  private fromSupported(language: string | null) {
    return (
      pick(this.options.supportedLanguages, language ?? this.options.fallbackLanguage, {
        loose: false,
      }) ||
      pick(this.options.supportedLanguages, language ?? this.options.fallbackLanguage, {
        loose: true,
      })
    )
  }
}

const resourcesToBackend = (load: (lng: string, ns: string, callback?: any) => Promise<Record<string, string>>) =>
  ({
    type: 'backend',
    init() {},
    read(language: string, namespace: string, callback: any) {
      if (typeof load === 'function') {
        // in case someone wants to customize the loading...
        if (load.length < 3) {
          // no callback
          try {
            const r = load(language, namespace)
            if (r && typeof r.then === 'function') {
              // promise
              r.then((data: any) => callback(null, data?.default || data)).catch(callback)
            } else {
              // sync
              callback(null, r)
            }
          } catch (err) {
            callback(err)
          }
          return
        }

        // normal with callback
        load(language, namespace, callback)
        return
      }

      callback(null, load?.[language]?.[namespace])
    },
  }) satisfies BackendModule

export const initI18n = ({
  initOptions,
  load,
  order,
}: {
  initOptions: InitOptions
  load: (lng: string, ns: string) => Promise<Record<string, string>>
  order?: Array<'searchParams' | 'cookie' | 'html-tag'>
}) => {
  const cookieKey = 'x-lng'

  const detector = new LanguageDetector({
    supportedLanguages: (initOptions.supportedLngs || []) as string[],
    fallbackLanguage: (initOptions.fallbackLng || []) as string,
    order: order,
  })

  const MyDetector = {
    type: 'languageDetector',
    detect: () => detector.detect(),
    cacheUserLanguage: (lng) => {
      document.cookie = `${cookieKey}=${lng}; Max-Age=31536000; Path=/; SameSite=Strict`
      document.documentElement.lang = lng
    },
  } satisfies LanguageDetectorModule

  const ins = i18n.use(MyDetector).use(initReactI18next).use(resourcesToBackend(load))

  ins.on('failedLoading', (_lng, _ns, msg) => console.error(msg))

  return ins.init(initOptions)
}
