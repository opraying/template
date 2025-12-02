import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'
import { DrillDownNavigator, NavigationBreadcrumb } from './drill-down-navigator'
import type { NavigationLevel } from './drill-down-navigator'
import { cn } from '@/lib/utils'

export interface MobileNavigationDialogProps {
  initialLevel: NavigationLevel
  title?: string
  showBreadcrumb?: boolean
  className?: string
}

export const MobileNavigationDialog = NiceModal.create<MobileNavigationDialogProps>(
  ({ initialLevel, title, showBreadcrumb = false, className }) => {
    const modal = useModal()
    const isMobile = useIsMobileScreen()

    return (
      <Dialog
        open={modal.visible}
        onOpenChange={(opened) => {
          opened ? modal.show() : modal.hide()
        }}
        forceDesktop={isMobile} // Force desktop dialog for better mobile experience
      >
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden',
            isMobile ? 'w-[100vw] h-[100vh] max-w-none rounded-none border-0' : 'max-w-md h-[600px]',
            className,
          )}
          containerClassName="overflow-hidden w-full h-full p-0 flex flex-col"
          forceDesktop={isMobile}
        >
          <DrillDownNavigator initialLevel={initialLevel} className="flex-1">
            {showBreadcrumb && <NavigationBreadcrumb className="border-t bg-muted/20" />}
          </DrillDownNavigator>
        </DialogContent>
      </Dialog>
    )
  },
)

export const openMobileNavigationDialog = (props: MobileNavigationDialogProps) =>
  NiceModal.show(MobileNavigationDialog, props)

export const closeMobileNavigationDialog = () => NiceModal.hide(MobileNavigationDialog)
