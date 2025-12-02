import { AppearanceSwitch } from '@xstack/app/debug/appearance-switch'
import { DebugPanelItem } from '@xstack/app/debug/components'
import { FPSMeter } from '@xstack/app/debug/fps-meter'
import { LanguageSwitch } from '@xstack/app/debug/language-switch'
import { LogLevelSwitch } from '@xstack/app/debug/log-level'
import { ReactScanFlag } from '@xstack/app/debug/react-scan'
import type { ReactNode } from 'react'
import { TailwindIndicator } from '@/lib/components/tailwind-indicator'
import { useHydrated } from '@/lib/hooks/use-hydrated'

interface Props {
  left?: ReactNode[]
  right?: ReactNode[]
}

export function DebugPanel({ left, right }: Props) {
  const hydrated = useHydrated()

  if (!hydrated) {
    return null
  }

  return (
    <div className="fixed border-t bg-background/90 bottom-0 inset-x-0 opacity-0 hover:opacity-100 transition-opacity text-fl-xs select-none flex justify-between items-center px-2 cursor-default z-[9999] font-mono">
      <div className="flex items-center justify-start gap-x-2 py-1">
        <FPSMeter />
        <ReactScanFlag />
        {left}
      </div>
      <div className="flex items-center justify-start gap-x-2 py-1">
        {right}
        {/* Builtin */}
        <AppearanceSwitch />
        <LanguageSwitch />
        <LogLevelSwitch />
        <DebugPanelItem title="⭕">
          <TailwindIndicator />
        </DebugPanelItem>
      </div>
    </div>
  )
}
