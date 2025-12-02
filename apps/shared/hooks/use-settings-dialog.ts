import { settingsMenuModule } from '@shared/components/settings/menu'
import * as Settings from '@xstack/app-kit/settings'

export const SettingsDialog = {
  open: (initialMenu?: string | undefined) => {
    Settings.openSettingsDialog({ initialMenu, settingsMenuModule })
  },
  close: () => {
    Settings.closeSettingsDialog()
  },
}
