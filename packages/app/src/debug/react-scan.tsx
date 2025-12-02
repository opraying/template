import { DebugPanelItem } from '@xstack/app/debug/components'
import { useLocalStorageState } from 'ahooks'
import { useEffect } from 'react'
import type { Options } from 'react-scan'

const defaultOptions: Omit<Options, 'enabled'> = {
  showToolbar: true,
  log: false,
}

export const ReactScanFlag = (options: Omit<Options, 'enabled'> = defaultOptions) => {
  const [flag, setFlag] = useLocalStorageState('react-scan', {
    defaultValue: false,
  })

  // @ts-ignore
  const getScan = (fn: (_: any) => void) => (typeof window.reactScan !== 'undefined' ? fn(window.reactScan) : undefined)

  useEffect(() => {
    setTimeout(() => {
      if (!flag) return
      getScan((scan) =>
        scan({
          enable: true,
          ...options,
        }),
      )
    }, 500)
  }, [])

  // @ts-ignore
  if (!window.reactScan) return null

  return (
    <DebugPanelItem title="⚛️">
      <button
        type="button"
        className="btn btn-xs"
        onClick={() => {
          const nextState = !flag
          setFlag(nextState)

          if (!nextState) {
            window.location.reload()
            return
          }

          getScan((scan) => {
            scan({
              enable: true,
              ...options,
            })
          })
        }}
      >
        Scan:{flag ? 'Y' : 'N'}
      </button>
    </DebugPanelItem>
  )
}
