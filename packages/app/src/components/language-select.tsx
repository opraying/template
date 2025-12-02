import { useLanguageOptions } from '@xstack/app/i18n'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

interface LanguageSelectProps {
  name?: string
  value?: string
  defaultValue?: string
  ref?: React.RefObject<HTMLDivElement>
  onBlur?: (event: React.FocusEvent<HTMLDivElement>) => void
  onChange?: (event: { target: { name: string; value: string }; type?: string }) => void
}

export function LanguageSelect({ name, defaultValue, onChange, onBlur, ref, ...rest }: LanguageSelectProps) {
  const { i18n } = useTranslation()
  const languageOptions = useLanguageOptions()

  // For uncontrolled mode - internal state
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue ?? i18n.language)

  // Determine if we're in controlled mode
  const isControlled = 'value' in rest

  // Use either controlled value or internal state
  const language = isControlled ? rest.value : internalValue
  const selected = languageOptions.find((option) => option.value === language)

  // Update internal state if defaultValue changes
  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  // Handler for language change
  const handleLanguageChange = (selectedValue: string) => {
    // @ts-ignore
    globalThis.__react_previous_language = i18n.language
    i18n.changeLanguage(selectedValue, () => {
      if (!isControlled) {
        setInternalValue(selectedValue)
      }

      onChange?.({
        target: {
          name: name ?? 'language',
          value: selectedValue,
        },
        type: 'change',
      })
    })
  }

  return (
    <Select value={language ?? ''} onValueChange={handleLanguageChange}>
      <SelectTrigger suppressHydrationWarning>{selected ? selected.label : 'Select language'}</SelectTrigger>
      <SelectContent align="end" ref={ref} onBlur={onBlur}>
        {languageOptions.map((option) => (
          <SelectItem key={option.value} className={option.value === language ? 'bg-accent' : ''} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
