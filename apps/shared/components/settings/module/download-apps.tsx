import { InstallAppPrompt } from '@xstack/app/app-life-cycle/install-prompt'
import * as Settings from '@xstack/app-kit/settings'

export function DownloadApp() {
  return (
    <>
      <Settings.SettingGroup>
        <InstallAppPrompt />
      </Settings.SettingGroup>
    </>
  )
}
