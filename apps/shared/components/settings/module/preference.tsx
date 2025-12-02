import { ProfileService } from '@client/profile/profile-service'
import { PreferenceSettingsSchema } from '@client/profile/schema'
import { LanguageSelect } from '@xstack/app/components/language-select'
import { SettingsSchemaForm } from '@xstack/app-kit/settings'
import { useStreamingSchemaForm } from '@xstack/form/schema-form'
import { useTranslation } from 'react-i18next'

const CustomComponent = {
  LanguageSelect,
}

export function PreferenceSettings() {
  const { t } = useTranslation()
  const profileService = ProfileService.useAtom
  const formProps = useStreamingSchemaForm(PreferenceSettingsSchema, profileService.preferenceSettings)

  const groups = [
    {
      title: t('settings.preferences.title'),
      description: t('settings.preferences.desc'),
    },
    {
      title: t('settings.appearance.title'),
      description: t('settings.appearance.desc'),
    },
  ]

  return (
    <SettingsSchemaForm autoSave={true} groups={groups} skipFirstGroup components={CustomComponent} {...formProps} />
  )
}
