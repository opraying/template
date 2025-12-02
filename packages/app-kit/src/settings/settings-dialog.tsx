import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'
import { SettingsContent, type SettingsMenuModule } from '@xstack/app-kit/settings/settings-content'
import { SettingsMenu } from '@xstack/app-kit/settings/settings-menu'
import { useNavigate } from 'react-router'
import { useUpdateEffect } from 'ahooks'
import { useEffect } from 'react'
import { useSettingOpenItem } from '@xstack/app-kit/global-state'

export const SettingsDialog = NiceModal.create<{
  initialMenu?: string | undefined
  settingsMenuModule: SettingsMenuModule
}>(({ initialMenu, settingsMenuModule }) => {
  const modal = useModal()
  const isMobile = useIsMobileScreen()
  const navigate = useNavigate()
  const [, setSettingOpenItem] = useSettingOpenItem()

  useEffect(() => {
    if (isMobile) {
      return
    }

    settingsMenuModule.preload()

    // Set initial menu if provided and not mobile
    if (initialMenu) {
      const initialItem = settingsMenuModule.menus.flatMap((menu) => menu.data).find((item) => item.id === initialMenu)
      if (initialItem) {
        setSettingOpenItem({ id: initialMenu })
      }
    }
  }, [isMobile, settingsMenuModule, initialMenu, setSettingOpenItem])

  useUpdateEffect(() => {
    if (!isMobile || !modal.visible) return
    // Navigate to settings page when switching to mobile
    navigate('/settings' + (initialMenu ? '/' + initialMenu : ''))
    modal.hide().finally(() => {
      modal.remove()
    })
  }, [isMobile, modal.visible, navigate, initialMenu])

  return (
    <Dialog
      open={modal.visible}
      onOpenChange={(opened) => {
        opened ? modal.show() : modal.hide()
      }}
    >
      <DialogContent
        className={'flex flex-col overflow-hidden w-[95vw] max-w-auto h-[90vh] lg:max-h-[900px] lg:max-w-5xl'}
        containerClassName={'overflow-hidden w-full h-full max-h-none p-0 @container flex flex-col md:flex-row'}
      >
        <DialogHeader className="hidden">
          <DialogTitle />
          <DialogDescription />
        </DialogHeader>
        <SettingsMenu menus={settingsMenuModule.menus} />
        <SettingsContent menus={settingsMenuModule.menus} modules={settingsMenuModule.modules} fixed />
      </DialogContent>
    </Dialog>
  )
})

export const openSettingsDialog = ({
  initialMenu,
  settingsMenuModule,
}: {
  initialMenu?: string | undefined
  settingsMenuModule: SettingsMenuModule
}) => NiceModal.show(SettingsDialog, { initialMenu, settingsMenuModule })

export const closeSettingsDialog = () => NiceModal.hide(SettingsDialog)
