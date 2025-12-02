import { ChangelogLoadList } from '@xstack/app/minimalism/changelog/list'
import { SettingGroup } from '@xstack/app-kit/settings'

export function ChangelogList() {
  return (
    <SettingGroup separator={false}>
      <ChangelogLoadList />
    </SettingGroup>
  )
}
