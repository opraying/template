import { DebugPanelItem } from '@xstack/app/debug/components'
import { LogStorageKey } from '@xstack/preset-web/browser'
import type * as LogLevel from 'effect/LogLevel'
import { useState } from 'react'

const LogLevels: LogLevel.Literal[] = [
  'All', // 0
  'Fatal', // 2
  'Error', // 3
  'Warning', // 4
  'Info', // 6
  'Debug', // 7
  'Trace', // 7
  'None', // 7
] as const

export const LogLevelSwitch = () => {
  const [logLevel, setLogLevel] = useState<LogLevel.Literal>(() => {
    const logLevel = localStorage.getItem(LogStorageKey) as (typeof LogLevels)[number]

    return logLevel || 'All'
  })

  return (
    <DebugPanelItem title="🎹">
      <button
        type="button"
        className="btn btn-xs app"
        onClick={() => {
          const currentLogLevelIndex = LogLevels.indexOf(logLevel)
          let nextLogLevelIndex = currentLogLevelIndex + 1
          if (nextLogLevelIndex >= LogLevels.length) {
            nextLogLevelIndex = 0
          }
          const nextLogLevel = LogLevels[nextLogLevelIndex]
          if (!nextLogLevel) return

          // @ts-ignore
          globalThis.__x_log_level = nextLogLevel
          localStorage.setItem(LogStorageKey, nextLogLevel)

          setLogLevel(nextLogLevel)

          // @ts-ignore
          if (typeof globalThis.__x_log_change === 'function') {
            // @ts-ignore
            globalThis.__x_log_change(nextLogLevel)
          }
        }}
      >
        {logLevel}
      </button>
    </DebugPanelItem>
  )
}
