import type { Appearance } from '@/lib/appearance/appearance-provider'
import { useAppearance } from '@/lib/appearance/hooks'
import { DebugPanelItem } from '@xstack/app/debug/components'

const upcaseFirst = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const AppearanceSwitch = () => {
  const { appearance, setAppearance } = useAppearance()
  const appearances: Appearance[] = ['light', 'dark', 'system']

  return (
    <DebugPanelItem title="🌈">
      <button
        className="btn btn-xs"
        onClick={() => {
          const currentIndex = appearances.indexOf(appearance)
          let nextIndex = currentIndex + 1
          if (nextIndex >= appearances.length) {
            nextIndex = 0
          }
          const next = appearances[nextIndex]
          if (!next) return
          setAppearance(next)
        }}
      >
        {upcaseFirst(appearance)}
      </button>
    </DebugPanelItem>
  )
}
