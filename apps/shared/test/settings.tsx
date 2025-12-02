import { settingsMenuModule } from '@shared/components/settings/menu'
import { SettingsPage } from '@xstack/app-kit/settings'

export const TestSettings = () => {
  return <SettingsPage menus={settingsMenuModule.menus} modules={settingsMenuModule.modules} initial="sync-settings" />
}
