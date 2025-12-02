import { useSettingOpenItem } from '@xstack/app-kit/global-state'
import { useIsDesktopScreen } from '@xstack/app-kit/lib/screen-utils'
import { useSize } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MenuChildConfigItem {
  id: string
  title: string
}

interface MenuConfigItem {
  id: string
  data: Array<MenuChildConfigItem>
}

export function SettingsFooter({
  menus,
  fixed,
  containerRef,
}: {
  menus: Array<MenuConfigItem>
  fixed?: boolean | undefined
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  const size = useSize(containerRef)
  const isMd = useIsDesktopScreen()
  const [settingOpenItem, setSettingOpenItem] = useSettingOpenItem()
  const { t } = useTranslation()

  const current = () => {
    const idx = menus.findIndex((item) => item.data.find((link) => link.id === settingOpenItem?.id))

    return {
      index: idx,
      found: menus[idx],
    }
  }

  const prev_ = () => {
    const go = (item: MenuConfigItem | undefined) => {
      const children = item?.data || []

      if (children.length === 0) return

      const index = children.findIndex((link) => link.id === settingOpenItem?.id)
      const nextIndex = index === -1 ? children.length - 1 : index - 1

      const next = children[nextIndex]
      if (!next) return

      return next
    }

    const { found, index } = current()

    const item = go(found) || go(menus[index - 1])

    return item
  }

  const next_ = () => {
    const go = (item: MenuConfigItem | undefined) => {
      const children = item?.data || []

      if (children.length === 0) return

      const index = children.findIndex((link) => link.id === settingOpenItem?.id)
      const nextIndex = index === -1 ? 0 : index + 1

      const next = children[nextIndex]
      if (!next) return

      return next
    }

    const { found, index } = current()

    const item = go(found) || go(menus[index + 1])

    return item
  }

  const prev = prev_()
  const next = next_()

  const handlePrev = () => {
    if (prev) {
      setSettingOpenItem({ id: prev.id })
    }
  }

  const handleNext = () => {
    if (next) {
      setSettingOpenItem({ id: next.id })
    }
  }

  return (
    <div
      className={cn(
        'flex gap-fl-sm flex-shrink-0',
        fixed ? 'fixed left-3 bottom-3 md:left-[240px] px-fl-2xs' : 'pb-fl-xs px-fl-2xs',
      )}
      style={{
        width: !fixed ? '100%' : size?.width ? `${size.width + (isMd ? 20 : 30)}px` : undefined,
      }}
    >
      {prev && (
        <Button
          variant="ghost"
          className="border flex-1 flex justify-between py-1.5 h-auto col-span-full bg-card/85 active:bg-card-70"
          onClick={() => handlePrev()}
        >
          <i className="i-lucide-arrow-left size-5 opacity-70" />
          <div className="text-left">
            <div className="min-h-5 text-primary font-medium">{t(prev.title)}</div>
            <div className="text-muted-foreground">{t('misc.previous', { defaultValue: 'Previous' })}</div>
          </div>
        </Button>
      )}
      {next && (
        <Button
          variant="ghost"
          className="border flex-1 flex justify-between py-1.5 h-auto bg-card/85 active:bg-card-70"
          onClick={() => handleNext()}
        >
          <div className="text-left">
            <div className="min-h-5 text-primary font-medium">{t(next.title)}</div>
            <div className="text-muted-foreground">{t('misc.next', { defaultValue: 'Next' })}</div>
          </div>
          <i className="i-lucide-arrow-right size-5 opacity-70" />
        </Button>
      )}
    </div>
  )
}
