import NiceModal from '@ebay/nice-modal-react'
import { AppCommand } from '@shared/components/command'

export const CommandModal = {
  open: () => {
    return NiceModal.show(AppCommand)
  },
  hide: () => {
    return NiceModal.hide(AppCommand)
  },
}
