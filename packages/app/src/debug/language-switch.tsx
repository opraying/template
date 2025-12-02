import { DebugPanelItem } from '@xstack/app/debug/components'
import { useLanguageOptions } from '@xstack/app/i18n'
import { getI18n, useTranslation } from 'react-i18next'

export const LanguageSwitch = () => {
  const i18n_ = getI18n()
  const { i18n } = useTranslation('translation', {
    i18n: i18n_,
  })
  const languageOptions = useLanguageOptions()

  const selected = languageOptions.find((option) => option.value === i18n.language)

  if (languageOptions.length <= 1) {
    return null
  }

  return (
    <DebugPanelItem title="🌐">
      <button
        className="btn btn-xs"
        onClick={() => {
          const currentLangIndex = languageOptions.findIndex((lang) => lang.value === i18n.language)
          let nextLangIndex = currentLangIndex + 1
          if (nextLangIndex >= languageOptions.length) {
            nextLangIndex = 0
          }
          const nextLang = languageOptions[nextLangIndex]
          if (!nextLang) return

          // @ts-ignore
          globalThis.__react_previous_language = i18n.language

          i18n.changeLanguage(nextLang.value)
        }}
      >
        {selected?.label}
      </button>
    </DebugPanelItem>
  )
}
