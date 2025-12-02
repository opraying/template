import type { SocketStatus } from '@xstack/event-log/EventLogStates'
import * as Match from 'effect/Match'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function ReconnectingTimer({ nextRetry }: { nextRetry: Date }) {
  const { t } = useTranslation()

  const calculateRemainingSeconds = () => {
    return Math.max(0, Math.round((nextRetry.getTime() - Date.now()) / 1000))
  }
  const [remainingSeconds, setRemainingSeconds] = useState(calculateRemainingSeconds())

  useEffect(() => {
    setRemainingSeconds(calculateRemainingSeconds())

    const intervalId = setInterval(() => {
      const secondsLeft = calculateRemainingSeconds()
      setRemainingSeconds(secondsLeft)
      if (secondsLeft <= 0) {
        clearInterval(intervalId)
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [nextRetry])

  return t('sync.connectionStatus.reconnectingSeconds', { seconds: remainingSeconds })
}

export function RenderStatusContent({ status }: { status: SocketStatus.Value }) {
  const { t } = useTranslation()

  return Match.value(status).pipe(
    Match.tag('Connected', () => (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-muted-foreground">{t('sync.connectionStatus.online')}</span>
      </div>
    )),
    Match.tag('Connecting', () => (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-sm text-muted-foreground">{t('sync.connectionStatus.connecting')}</span>
      </div>
    )),
    Match.tag('Reconnecting', ({ nextRetry }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">{t('sync.connectionStatus.reconnecting')}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <ReconnectingTimer nextRetry={nextRetry} />
        </TooltipContent>
      </Tooltip>
    )),
    Match.tag('Disconnected', ({ reason }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm text-muted-foreground">{t('sync.connectionStatus.offline')}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{reason ?? t('sync.connectionStatus.unknownReason')}</TooltipContent>
      </Tooltip>
    )),
    Match.tag('Error', ({ error }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm text-destructive">{t('sync.connectionStatus.error')}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{error}</TooltipContent>
      </Tooltip>
    )),
    Match.exhaustive,
  )
}
