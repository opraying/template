import { useSubscription } from '@xstack/app-kit/purchase/hooks'
import * as Settings from '@xstack/app-kit/settings'
import type { ConnectedDevice } from '@xstack/event-log/Schema'
import { useSequencedStatus } from '@xstack/lib/hooks/use-sequenced-status'
import { ClearDataDialog, SetupMnemonicDialog, TechnicalDetailsDialog } from '@xstack/local-first/components/dialogs'
import { MnemonicDisplay } from '@xstack/local-first/components/mnemonic'
import { RenderStatusContent } from '@xstack/local-first/components/status'
import { IdentityService, SyncService } from '@xstack/local-first/services'
import { useUser } from '@xstack/user-kit/authentication/hooks'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function SyncSettings() {
  const { t } = useTranslation()

  return (
    <>
      <UpgradeNotice />
      <Settings.SettingGroup>
        <SyncHeader />
        <SyncStatus />
        <SyncIdentities />
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-start h-10"
          {...TechnicalDetailsDialog.eventHandler()}
        >
          <i className="i-lucide-circle-help w-4 h-4" />
          {t('sync.identity.learnMore')}
        </Button>
      </Settings.SettingGroup>
      <Settings.SettingGroup title={t('sync.dangerZone.title')} description={t('sync.dangerZone.description')}>
        <Settings.SettingItem title={t('sync.clearLocalData.title')}>
          <div className="space-y-4">
            <Button variant="destructive" size="sm" {...ClearDataDialog.eventHandler()}>
              {t('sync.clearLocalData.title')}
            </Button>
          </div>
        </Settings.SettingItem>
      </Settings.SettingGroup>
    </>
  )
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatTimeAgo(date: number | Date | undefined): string {
  if (!date) return 'Never'
  const seconds = Math.floor((Date.now() - (date instanceof Date ? date.getTime() : date)) / 1000)
  if (seconds < 10) return 'Now'
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`
  return (date instanceof Date ? date : new Date(date)).toLocaleDateString()
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-normal', className)}>
      {status}
    </Badge>
  )
}

const deviceIcons = {
  desktop: 'i-lucide-monitor',
  mobile: 'i-lucide-smartphone',
  tablet: 'i-lucide-tablet',
}

const browserIcons = {
  chrome: 'i-logos-chrome',
  firefox: 'i-logos-firefox',
  safari: 'i-logos-safari',
  edge: 'i-logos-edge',
  opera: 'i-logos-opera',
  ie: 'i-logos-ie',
  other: 'i-lucide-globe',
}

const getBrowserIcon = (browser: string) => browserIcons[browser as keyof typeof browserIcons]

function DeviceItem({ device, selected }: { device: ConnectedDevice; selected: boolean }) {
  const { t } = useTranslation()

  return (
    <div className={'group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border'}>
      {selected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-primary rounded-r-full" />}
      <div className="h-8 w-8 rounded-full flex items-center justify-center">
        <i className={deviceIcons[device.type as keyof typeof deviceIcons] || 'i-lucide-device'} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{device.os}</span>
          {device.browser && (
            <span className="flex items-center text-muted-foreground text-sm">
              <i className={cn(getBrowserIcon(device.browser), 'mr-1')} />
              {device.browser}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {t('sync.devices.status.lastSeen', { time: formatTimeAgo(device.lastSeenAt) })}
        </div>
      </div>
    </div>
  )
}

function UpgradeNotice() {
  const { t } = useTranslation()
  const { value: subscription } = useSubscription()
  const user = useUser()

  if (Option.isSome(subscription)) return null

  // 未登录状态
  if (Option.isNone(user)) {
    return (
      <Alert variant="warning" className="relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 rounded-full bg-warning/5" />
        <div className="absolute right-8 bottom-0 translate-y-1/2 w-24 h-24 rounded-full bg-warning/5" />

        <AlertTitle className="flex items-center gap-3 relative">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning/10">
            <i className="i-lucide-log-in text-warning text-xl" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{t('sync.auth.required')}</h3>
            <p className="text-sm font-normal text-muted-foreground mt-1">{t('sync.auth.description')}</p>
          </div>
        </AlertTitle>

        <AlertDescription className="mt-4 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <i className="i-lucide-shield-check text-base text-success" />
                <span>{t('sync.auth.benefits.secure')}</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div className="flex items-center gap-2">
                <i className="i-lucide-cloud text-base text-primary" />
                <span>{t('sync.auth.benefits.sync')}</span>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-warning text-warning-foreground hover:bg-warning/90 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 gap-2"
              onClick={() => {
                // TODO: Handle login
              }}
            >
              <i className="i-lucide-log-in text-base" />
              {t('sync.auth.login')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // 免费用户状态
  return (
    <Alert variant="warning" className="relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/2 w-32 h-32 rounded-full bg-warning/5" />
      <div className="absolute right-8 bottom-0 translate-y-1/2 w-24 h-24 rounded-full bg-warning/5" />

      <AlertTitle className="flex items-center gap-3 relative">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning/10">
          <i className="i-lucide-zap text-warning text-xl" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{t('sync.upgrade.limitedFeatures')}</h3>
          <p className="text-sm font-normal text-muted-foreground mt-1">{t('sync.upgrade.freeDescription')}</p>
        </div>
      </AlertTitle>

      <AlertDescription className="mt-4 relative">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 transition-all duration-200 hover:bg-card">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <i className="i-lucide-key text-primary text-base" />
              </div>
              <div>
                <div className="font-medium">{t('sync.upgrade.limits.identities.title')}</div>
                <div className="text-sm text-muted-foreground">{t('sync.upgrade.limits.identities', { count: 1 })}</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 transition-all duration-200 hover:bg-card">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <i className="i-lucide-devices text-primary text-base" />
              </div>
              <div>
                <div className="font-medium">{t('sync.upgrade.limits.devices.title')}</div>
                <div className="text-sm text-muted-foreground">{t('sync.upgrade.limits.devices', { count: 2 })}</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 transition-all duration-200 hover:bg-card">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <i className="i-lucide-hard-drive text-primary text-base" />
              </div>
              <div>
                <div className="font-medium">{t('sync.upgrade.limits.storage.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('sync.upgrade.limits.storage', { size: '500MB' })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 transition-all duration-200 hover:bg-card">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <i className="i-lucide-history text-primary text-base" />
              </div>
              <div>
                <div className="font-medium">{t('sync.upgrade.limits.history.title')}</div>
                <div className="text-sm text-muted-foreground">{t('sync.upgrade.limits.history', { days: 7 })}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <i className="i-lucide-sparkles text-warning text-xl" />
              <span className="text-sm font-medium">{t('sync.upgrade.benefits')}</span>
            </div>
            <Button
              size="sm"
              className="bg-warning text-warning-foreground hover:bg-warning/90 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 gap-2"
              onClick={() => {
                // TODO: Handle upgrade
              }}
            >
              <i className="i-lucide-zap text-base" />
              {t('sync.upgrade.button')}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function SyncHeader() {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: publicKeys } = sync.publicKeys.useSuspenseSuccess()
  const { value: syncing } = sync.syncing.useSuspenseSuccess()
  const { value: localSyncStats } = sync.localSyncStats.useSuspenseSuccess()
  const sequencedSyncing = useSequencedStatus(syncing, { minDisplayTimeMs: 1000 })

  const current = publicKeys.items.find((_) => _.publicKey === publicKeys.publicKey)

  // 只有在切换，创建的时候可能出现一瞬间
  if (!current) {
    return null
  }

  // Helper function to split note into name and emoji
  const splitNote = (note: string) => {
    const [name = '', emoji = '🔑'] = note.split(';')
    return { name: name.trim(), emoji: emoji.trim() }
  }

  const { name } = splitNote(current.note)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight" {...SetupMnemonicDialog.eventHandler()}>
          {name}
        </h2>
      </div>
      <div className="flex gap-2 items-center">
        {sequencedSyncing && <StatusBadge status={t('sync.overview.syncing')} className="animate-pulse bg-primary/5" />}
        {Option.match(localSyncStats.lastSync, {
          onNone: () => null,
          onSome: (event) => (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-muted-foreground">{formatTimeAgo(event.date)}</span>
                </TooltipTrigger>
                <TooltipContent>{t('sync.overview.lastSync')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
        })}
      </div>
    </div>
  )
}

function LocalStatus() {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: localSyncStats } = sync.localSyncStats.useSuspenseSuccess()
  const localUsedStorage = localSyncStats.usedStorageSize

  return (
    <Settings.SettingItem title={t('sync.storage.local.title')} description={t('sync.storage.local.description')}>
      <span className="text-muted-foreground">{formatBytes(localUsedStorage)}</span>
    </Settings.SettingItem>
  )
}

function SyncDetails() {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: remoteSyncStats } = sync.remoteSyncStats.useSuspenseSuccess()
  const serverUsedStorage = Option.map(remoteSyncStats, (data) => data.usedStorageSize)
  const serverMaxStorage = Option.map(remoteSyncStats, (data) => data.maxStorageSize)
  const { value: subscription } = useSubscription()
  const { value: connectedDevices } = sync.connectedDevices.useSuspenseSuccess()

  // TODO: 需要从 subscription 中获取 maxDevices
  const maxDevices = Option.isSome(subscription) ? 5 : 2
  const totalDeviceCount = connectedDevices.length
  const deviceCountText = `${totalDeviceCount}/${maxDevices}`

  return (
    <div className="flex flex-col gap-2.5">
      <Settings.SettingItem title={t('sync.storage.server.title')} description={t('sync.storage.server.description')}>
        {formatBytes(Option.getOrElse(serverUsedStorage, () => 0))} /{' '}
        {formatBytes(Option.getOrElse(serverMaxStorage, () => 0))}
      </Settings.SettingItem>
      <div className="space-y-2">
        <Progress
          className="flex-1"
          value={Option.getOrElse(serverUsedStorage, () => 0) / Option.getOrElse(serverMaxStorage, () => 0)}
        />
      </div>
      <Settings.SettingItem title={t('sync.devices.title')}>
        <span className="text-muted-foreground">{deviceCountText}</span>
      </Settings.SettingItem>
      {connectedDevices.length === 0 ? (
        <div className="flex items-center justify-center h-24 border rounded-lg bg-muted/5 border-dashed">
          <div className="text-sm text-muted-foreground text-center">
            <i className="i-lucide-devices block mx-auto mb-2 text-xl opacity-50" />
            {t('sync.devices.noDevices')}
          </div>
        </div>
      ) : (
        <div className="gap-2">
          {connectedDevices.map((device, index) => (
            <DeviceItem key={device.id} device={device} selected={index === 0} />
          ))}
        </div>
      )}
    </div>
  )
}

function SyncError() {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: localSyncStats } = sync.localSyncStats.useSuspenseSuccess()
  const { lastSync } = localSyncStats

  return Option.match(lastSync, {
    onNone: () => null,
    onSome: (event) =>
      event._tag === 'SyncFailure' ? (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle className="flex items-center gap-2 mb-2">
            <span className="i-lucide-alert-circle text-lg" />
            {t('sync.error.title')}
          </AlertTitle>
          <AlertDescription className="text-sm">
            <p className="mb-1">{t('sync.error.description')}</p>
            <p className="font-mono text-xs bg-destructive/10 p-2 rounded">{event.error}</p>
          </AlertDescription>
        </Alert>
      ) : null,
  })
}

function SyncStatus() {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: syncEnabled } = sync.syncEnabled.useSuspenseSuccess()
  const { value: socketStatus } = sync.socketStatus.useSuspenseSuccess()

  return (
    <>
      <Settings.SettingItem title={'Enable Sync'} description={'Enable or disable sync for your library'}>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {Option.match(socketStatus, {
              onNone: () => null,
              onSome: (status) => <RenderStatusContent status={status} />,
            })}
          </TooltipProvider>
          <Switch
            checked={syncEnabled}
            onCheckedChange={(checked) => {
              if (checked) sync.resumeSync()
              else sync.pauseSync()
            }}
          />
        </div>
        <SyncError />
      </Settings.SettingItem>
      <LocalStatus />
      {syncEnabled && <SyncDetails />}
    </>
  )
}

function SyncIdentities() {
  const { t } = useTranslation()
  const identity = IdentityService.useAtom
  const { value: mnemonic } = identity.mnemonic.useSuspenseSuccess()

  return (
    <Settings.SettingItem
      title={t('sync.identities.title')}
      orientation="vertical"
      description={t('sync.identities.description')}
    >
      {Option.match(mnemonic, {
        onNone: () => null,
        onSome: (_) => <MnemonicDisplay mnemonic={Redacted.value(_)} />,
      })}
    </Settings.SettingItem>
  )
}
