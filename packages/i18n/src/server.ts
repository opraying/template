// @ts-ignore
import { pick } from 'accept-language-parser'
import { type BackendModule, createInstance, type i18n as I18nInstance, type InitOptions } from 'i18next'
import { parseAcceptLanguage } from 'intl-parse-accept-language'
import { setDefaults, setI18n } from 'react-i18next'
import { findCookieByName } from './utils'

export type Locales = string | string[] | undefined

export interface Cookie {
  /**
   * The name of the cookie, used in the `Cookie` and `Set-Cookie` headers.
   */
  readonly name: string
  /**
   * True if this cookie uses one or more secrets for verification.
   */
  readonly isSigned: boolean
  /**
   * The Date this cookie expires.
   *
   * Note: This is calculated at access time using `maxAge` when no `expires`
   * option is provided to `createCookie()`.
   */
  readonly expires?: Date
  /**
   * Parses a raw `Cookie` header and returns the value of this cookie or
   * `null` if it's not present.
   */
  parse(cookieHeader: string | null): any
  /**
   * Serializes the given value to a string and returns the `Set-Cookie`
   * header.
   */
  serialize(value: any): string
}

/**
 * Get the client's locales from the Accept-Language header.
 * If the header is not defined returns null.
 * If the header is defined return an array of locales, sorted by the quality
 * value.
 *
 * @example
 * export let loader: LoaderFunction = async ({ request }) => {
 *   let locales = getClientLocales(request)
 *   let date = new Date().toLocaleDateString(locales, {
 *     "day": "numeric",
 *   });
 *   return json({ date })
 * }
 */
export function getClientLocales(headers: Headers): Locales
export function getClientLocales(request: Request): Locales
export function getClientLocales(requestOrHeaders: Request | Headers): Locales {
  const headers = getHeaders(requestOrHeaders)

  const xlang = headers.get('x-lng')
  const acceptLanguage = headers.get('Accept-Language')

  // if the header is not defined, return undefined
  if (!xlang && !acceptLanguage) return undefined

  const locales = parseAcceptLanguage(xlang || acceptLanguage, {
    validate: Intl.DateTimeFormat.supportedLocalesOf,
    ignoreWildcard: true,
  })

  // if there are no locales found, return undefined
  if (locales.length === 0) return undefined
  // if there is only one locale, return it
  if (locales.length === 1) return locales[0]
  // if there are multiple locales, return the array
  return locales
}

/**
 * Receives a Request or Headers objects.
 * If it's a Request returns the request.headers
 * If it's a Headers returns the object directly.
 */
export function getHeaders(requestOrHeaders: Request | Headers): Headers {
  if (requestOrHeaders instanceof Request) {
    return requestOrHeaders.headers
  }

  return requestOrHeaders
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
  cookie?: Cookie
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
  order?: Array<'searchParams' | 'cookie' | 'session' | 'header'> | undefined
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

  public detect(request: Request): string {
    const order = this.options.order ?? ['searchParams', 'cookie', 'session', 'header']
    for (const method of order) {
      let locale: string | null = null

      if (method === 'searchParams') {
        locale = this.fromSearchParams(request)
      }

      if (method === 'cookie') {
        locale = this.fromCookie(request)
      }

      if (method === 'header') {
        locale = this.fromHeader(request)
      }

      if (locale) return locale
    }

    return this.options.fallbackLanguage
  }

  private fromSearchParams(request: Request): string | null {
    const url = new URL(request.url)

    if (!url.searchParams.has(this.options.searchParamKey ?? 'lng')) {
      return null
    }
    return this.fromSupported(url.searchParams.get(this.options.searchParamKey ?? 'lng'))
  }

  private fromCookie(request: Request): string | null {
    if (!this.options.cookie) return null

    const cookie = this.options.cookie
    const lng = cookie.parse(request.headers.get('Cookie')) ?? ''
    if (!lng) return null

    return this.fromSupported(lng)
  }

  private fromHeader(request: Request): string | null {
    const locales = getClientLocales(request)
    if (!locales) return null
    if (Array.isArray(locales)) return this.fromSupported(locales.join(','))
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

const resourcesToBackend = (load: (lng: string, ns: string) => Promise<Record<string, string>>) =>
  ({
    type: 'backend',
    init() {},
    read(language: string, namespace: string, callback: any) {
      const r = load(language, namespace)
      r.then((data: any) => callback(null, data?.default || data)).catch(callback)
    },
  }) satisfies BackendModule

let instance: I18nInstance

export const initI18n =
  (
    initOptions: InitOptions & {
      loadResource: (lng: any, ns: string) => Promise<Record<string, string>>
    },
  ) =>
  (): I18nInstance | Promise<I18nInstance> => {
    // @ts-ignore
    const lng = globalThis.i18nDetectRequestHook((request: Request) => detectLanguage(request, initOptions))

    if (!instance) {
      instance = createInstance()

      instance.use(resourcesToBackend(initOptions.loadResource)).init({
        partialBundledLanguages: true,
        ...initOptions,
        load: 'currentOnly',
        lng,
        initAsync: true,
      })

      instance.changeLanguage(lng)

      // @ts-ignore
      globalThis._i18nInstance = instance

      setI18n(instance)
      setDefaults(initOptions.react ?? {})

      return instance
    }

    if (lng !== instance.language) {
      instance.changeLanguage(lng)
    }

    return instance
  }

export const detectLanguage = (
  request: Request,
  initOptions: InitOptions,
  order?: Array<'searchParams' | 'cookie' | 'session' | 'header'>,
  fallback = 'en',
): string => {
  const cookieKey = 'x-lng'

  const fallbackLanguage = typeof initOptions.fallbackLng === 'string' ? initOptions.fallbackLng : fallback

  const de = new LanguageDetector({
    supportedLanguages: (initOptions.supportedLngs || []) as string[],
    fallbackLanguage: fallbackLanguage,
    order,
    cookie: {
      name: cookieKey,
      isSigned: false,
      parse: (cookieHeader: string | null) => {
        if (!cookieHeader) {
          return
        }

        return findCookieByName(cookieKey, cookieHeader)
      },
      serialize: (value: any) => value,
    },
  })

  return de.detect(request)
}
