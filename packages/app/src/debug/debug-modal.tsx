import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Drawer as DrawerPrimitive } from 'vaul'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
} from '@/components/ui/drawer'

const ID = 'debug-modal'

export const DebugModal = NiceModal.create(({ children }: { children: React.ReactNode }) => {
  const modal = useModal()

  return (
    <Drawer
      open={modal.visible}
      onOpenChange={(opened) => {
        opened ? modal.show() : modal.hide()
      }}
      direction="bottom"
      shouldScaleBackground={false}
    >
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
          className="fixed px-fl-xs bottom-0 pb-20 left-0 right-0 w-full pt-fl-md z-50 flex h-auto flex-col border-t rounded-md bg-background overflow-y-scroll outline-none no-scrollbar"
          aria-description="todo"
        >
          <DrawerHeader>
            <DrawerTitle />
            <DrawerDescription />
          </DrawerHeader>
          {children}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  )
})

export const useToggleDebugModal = () => {
  const modal = useModal(ID)

  return () => {
    if (modal.visible) {
      NiceModal.hide(DebugModal)
    } else {
      NiceModal.register(ID, DebugModal)
      NiceModal.show(DebugModal, {})
    }
  }
}
