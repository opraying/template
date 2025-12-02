import { APP_ROOT_SCOPE } from '@shared/constants'
import { SettingsDialog } from '@shared/hooks/use-settings-dialog'
import { CommandModal } from '@shared/misc/modals/command'
import { useMenuOpened } from '@xstack/app-kit/global-state'
import { useNavigate } from '@xstack/router'
import { useHotkeys } from 'react-hotkeys-hook'
import { useAppearance } from '@/lib/appearance/hooks'

export function useAppScopeHotKey() {
  const navigate = useNavigate()
  const { toggleAppearance } = useAppearance()
  const [menuOpened, setMenuOpened] = useMenuOpened()

  /// global keydown event
  useHotkeys('mod+k', () => CommandModal.open(), {
    description: 'Show command modal',
    scopes: APP_ROOT_SCOPE,
    preventDefault: true,
  })

  useHotkeys('mod+comma', () => SettingsDialog.open(), {
    description: 'Show settings modal',
    scopes: APP_ROOT_SCOPE,
    preventDefault: true,
  })

  useHotkeys(
    'mod+1',
    () => {
      navigate.push('/')
    },
    {
      description: 'Go to home',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )

  useHotkeys(
    'mod+b',
    () => {
      setMenuOpened(!menuOpened)
      // expand/collapse sidebar
    },
    {
      description: 'Expand/Collapse sidebar',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )

  useHotkeys(
    'alt+m',
    () => {
      toggleAppearance()
    },
    {
      description: 'Switch Theme',
      scopes: APP_ROOT_SCOPE,
    },
  )

  useHotkeys(
    'mod+shift+c',
    () => {
      console.log('mod+shift+c')
    },
    {
      description: 'Open contacts',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )
  useHotkeys(
    'mod+shift+b',
    () => {
      console.log('mod+shift+b')
    },
    {
      description: 'Open bookmarks',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )
  useHotkeys(
    'mod+shift+m',
    () => {
      console.log('mod+shift+m')
    },
    {
      description: 'Open messages',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )

  useHotkeys(
    'mod+shift+u',
    () => {
      console.log('mod+shift+u')
    },
    {
      description: 'Open notifications',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )

  useHotkeys(
    'mod+shift+d',
    () => {
      console.log('mod+shift+d')
    },
    {
      description: 'Open drafts',
      preventDefault: true,
      scopes: APP_ROOT_SCOPE,
    },
  )
}
