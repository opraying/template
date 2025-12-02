import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRevalidator } from 'react-router'

export const useLanguageChangeRevalidator = () => {
  const { i18n } = useTranslation()
  const { revalidate, state } = useRevalidator()
  const flag = useRef(false)
  // ignore first
  // when language change we need to revalidate

  useEffect(() => {
    if (state === 'loading') return

    if (flag.current) {
      revalidate()
    } else {
      flag.current = true
    }
  }, [i18n.language])

  return null
}
