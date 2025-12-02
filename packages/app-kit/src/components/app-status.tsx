import { useOnline } from '@xstack/lib/hooks/use-online'
import { useSequencedStatus } from '@xstack/lib/hooks/use-sequenced-status'
import { SyncService } from '@xstack/local-first/services'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

/**
 * AppStatus Component
 *
 * Displays the current system status with three main states:
 * - Network Status: Shows if the app is fully online, partially connected, or offline
 * - Sync Status: Shows the current sync state (idle, syncing, or error)
 *
 * Status Priority:
 * 1. Offline (Red): Browser is offline or no connection available
 * 2. Partial (Yellow): Browser is online but sync service is disconnected
 * 3. Online (Green): Both browser and sync service are connected
 * 4. Syncing (Blue): System is actively syncing data
 */

interface AppStatusState {
  networkStatus: 'online' | 'partial' | 'offline'
  syncStatus: 'idle' | 'syncing' | 'error'
}

/**
 * Status text mapping for different states
 */
const STATUS_TEXT = {
  network: {
    online: 'Connected',
    partial: 'Partially',
    offline: 'Offline',
  },
  sync: {
    syncing: 'Syncing...',
    error: 'Something went wrong',
    idle: 'Up to date',
  },
} as const

/**
 * Status display configurations for different states
 */
const STATUS_DISPLAY = {
  network: {
    offline: {
      icon: <div className="size-2.5 bg-destructive rounded-full" />,
      iconClass: 'i-lucide-wifi-off text-destructive',
    },
    partial: {
      icon: <div className="size-2.5 bg-yellow-500 rounded-full" />,
      iconClass: 'i-lucide-alert-circle text-yellow-500',
    },
    online: {
      icon: <div className="size-2.5 bg-green-500 rounded-full" />,
      iconClass: 'i-lucide-check-circle-2 text-green-500',
    },
  },
  sync: {
    syncing: {
      icon: <i className="i-lucide-refresh-cw size-4 text-blue-500 animate-spin" />,
      iconClass: 'i-lucide-refresh-cw text-blue-500',
    },
    error: {
      icon: <div className="size-2.5 bg-yellow-500 rounded-full" />,
      iconClass: 'i-lucide-alert-circle text-yellow-500',
    },
    idle: {
      icon: <div className="size-2.5 bg-green-500 rounded-full" />,
      iconClass: 'i-lucide-refresh-ccw text-green-500',
    },
  },
} as const

export function AppStatus() {
  const { online } = useOnline()
  const syncService = SyncService.useAtom
  const { value: localSyncStats } = syncService.localSyncStats.useSuspenseSuccess()
  const { value: socketStatus } = syncService.socketStatus.useSuspenseSuccess()
  const { value: syncing } = syncService.syncing.useSuspenseSuccess()

  const state: AppStatusState = {
    networkStatus: !online
      ? 'offline'
      : pipe(
          socketStatus,
          Option.map((status) => (status?._tag === 'Connected' ? 'online' : 'partial')),
          Option.getOrElse(() => 'partial' as const),
        ),
    syncStatus: syncing
      ? 'syncing'
      : Option.match(localSyncStats.lastSync, {
          onNone: () => 'idle' as const,
          onSome: (event) => (event._tag === 'SyncFailure' ? 'error' : 'idle'),
        }),
  }

  const syncStatus = useSequencedStatus(state.syncStatus)
  const networkStatus = useSequencedStatus(state.networkStatus)

  const getStatusDisplay = () => {
    if (state.networkStatus !== 'online') {
      return STATUS_DISPLAY.network[networkStatus]
    }
    return STATUS_DISPLAY.sync[syncStatus]
  }

  const statusInfo = getStatusDisplay()

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="icon" className="p-1 w-auto h-auto">
          {statusInfo.icon}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <AppStatusContent />
      </HoverCardContent>
    </HoverCard>
  )
}

export function AppStatusContent() {
  const { online } = useOnline()
  const syncService = SyncService.useAtom
  const { value: localSyncStats } = syncService.localSyncStats.useSuspenseSuccess()
  const { value: socketStatus } = syncService.socketStatus.useSuspenseSuccess()
  const { value: syncing } = syncService.syncing.useSuspenseSuccess()

  const state: AppStatusState = {
    networkStatus: !online
      ? 'offline'
      : pipe(
          socketStatus,
          Option.map((status) => (status?._tag === 'Connected' ? 'online' : 'partial')),
          Option.getOrElse(() => 'partial' as const),
        ),
    syncStatus: syncing
      ? 'syncing'
      : Option.match(localSyncStats.lastSync, {
          onNone: () => 'idle' as const,
          onSome: (event) => (event._tag === 'SyncFailure' ? 'error' : 'idle'),
        }),
  }

  // Get sync error message if available
  const getSyncErrorMessage = () =>
    Option.match(localSyncStats.lastSync, {
      onNone: () => STATUS_TEXT.sync.error,
      onSome: (sync) => (sync._tag === 'SyncFailure' ? sync.error : undefined),
    })

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-1">
        <span className="font-medium leading-none">App Status</span>
      </div>
      <div className="space-y-2">
        {/* Network Status Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className={cn('size-4', STATUS_DISPLAY.network[state.networkStatus].iconClass)} />
            <span className="text-sm">Connection</span>
          </div>
          <span className="text-sm text-muted-foreground">{STATUS_TEXT.network[state.networkStatus]}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className={cn('size-4', STATUS_DISPLAY.sync[state.syncStatus].iconClass)} />
            <span className="text-sm">Sync Status</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {state.syncStatus === 'error' ? getSyncErrorMessage() : STATUS_TEXT.sync[state.syncStatus]}
          </span>
        </div>
        {Option.match(localSyncStats.lastSync, {
          onNone: () => null,
          onSome: (event) => (
            <div className="flex items-center justify-between" key={event.date.toISOString()}>
              <div className="flex items-center gap-2">
                <i className="i-lucide-clock size-4 text-muted-foreground" />
                <span className="text-sm">Last Synced</span>
              </div>
              <span className="text-sm text-muted-foreground">{event.date.toLocaleString()}</span>
            </div>
          ),
        })}
      </div>
    </div>
  )
}

export function AppStatusOnly() {
  const { online } = useOnline()
  const syncService = SyncService.useAtom
  const { value: localSyncStats } = syncService.localSyncStats.useSuspenseSuccess()
  const { value: socketStatus } = syncService.socketStatus.useSuspenseSuccess()
  const { value: syncing } = syncService.syncing.useSuspenseSuccess()

  const state: AppStatusState = {
    networkStatus: !online
      ? 'offline'
      : pipe(
          socketStatus,
          Option.map((status) => (status?._tag === 'Connected' ? 'online' : 'partial')),
          Option.getOrElse(() => 'partial' as const),
        ),
    syncStatus: syncing
      ? 'syncing'
      : Option.match(localSyncStats.lastSync, {
          onNone: () => 'idle' as const,
          onSome: (event) => (event._tag === 'SyncFailure' ? 'error' : 'idle'),
        }),
  }

  const syncStatus = useSequencedStatus(state.syncStatus)
  const networkStatus = useSequencedStatus(state.networkStatus)

  const getStatusDisplay = () => {
    if (state.networkStatus !== 'online') {
      return STATUS_DISPLAY.network[networkStatus]
    }
    return STATUS_DISPLAY.sync[syncStatus]
  }

  const statusInfo = getStatusDisplay()

  return <div className="p-1 w-auto h-auto pointer-event-none">{statusInfo.icon}</div>
}
