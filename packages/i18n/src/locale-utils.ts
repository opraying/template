const LANGUAGE_TO_LOCALE_MAP: Record<string, string> = {
  // 英语
  en: 'en',
  'en-us': 'en',

  // 中文
  zh: 'zh-Hans',
  'zh-hans': 'zh-Hans', // 简体中文
  'zh-cn': 'zh-Hans', // 中国大陆
  'zh-hk': 'zh-Hans', // 香港
  'zh-hant': 'zh-TW', // 繁体中文
  'zh-tw': 'zh-TW', // 台湾

  // 日语
  ja: 'ja',
  'ja-jp': 'ja',
}

/**
 * Normalize language code by converting to lowercase and handling variants
 */
const normalizeLanguageCode = (language: string): string => {
  return language.toLowerCase().replace('_', '-')
}

/**
 * Get browser locales in order of preference
 * Server-safe: returns fallback when navigator is not available
 */
export const getBrowserLocales = (): ReadonlyArray<string> => {
  if (typeof navigator === 'undefined') {
    return ['en'] // Server-side fallback
  }

  const locales: string[] = []

  // Check navigator.languages first (most preferred)
  if (navigator.languages && navigator.languages.length > 0) {
    locales.push(...navigator.languages)
  }

  // Fallback to navigator.language
  if (navigator.language) {
    locales.push(navigator.language)
  }

  // Final fallback
  if (locales.length === 0) {
    locales.push('en')
  }

  return locales
}

/**
 * Convert language code to locale, with fallback to provided locales or browser locale
 * Supports: en, zh, zh-Hans, zh-Hant, zh-CN, ja, etc.
 */
export const resolveLocaleFromLanguage = (language: string, fallbackLocales?: ReadonlyArray<string>): string => {
  if (!language) {
    const availableLocales = fallbackLocales || getBrowserLocales()
    return availableLocales[0]
  }

  const normalizedLanguage = normalizeLanguageCode(language)

  // Try exact match in mapping first
  const mappedLocale = LANGUAGE_TO_LOCALE_MAP[normalizedLanguage]
  if (mappedLocale) {
    return mappedLocale
  }

  // Use provided fallback locales or get browser locales
  const availableLocales = fallbackLocales || getBrowserLocales()

  // Check if available locales contain this language (prefix match)
  const baseLang = normalizedLanguage.split('-')[0]
  const matchingLocale = availableLocales.find(
    (locale) => normalizeLanguageCode(locale).startsWith(baseLang + '-') || normalizeLanguageCode(locale) === baseLang,
  )

  if (matchingLocale) {
    return normalizeLanguageCode(matchingLocale)
  }

  // Fallback to first available locale
  return availableLocales[0]
}
