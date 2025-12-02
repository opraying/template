import { SecuritySettings } from '@xstack/app-kit/settings/module/security'
import { useTranslation } from 'react-i18next'

export function ProfileSettings() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <SecuritySettings />
    </div>
  )
}
