import { HotUpdater, getUpdateSource, useHotUpdaterStore } from '@hot-updater/react-native'
import { hide } from 'expo-splash-screen'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

type CheckForUpdateResult = Awaited<ReturnType<typeof HotUpdater.checkForUpdate>>
type UpdateInfo = NonNullable<CheckForUpdateResult>

const UPDATE_BASE_URL = 'https://hot-updater.opraying.workers.dev/api/check-update'

export default function HotUpdaterDebugPage() {
  const channel = useMemo(() => HotUpdater.getChannel(), [])
  const { progress, isUpdateDownloaded } = useHotUpdaterStore()

  const [snapshotDownloaded, setSnapshotDownloaded] = useState(() => HotUpdater.isUpdateDownloaded())
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Ready to inspect updates.')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [logs, setLogs] = useState<Array<{ id: string; text: string }>>([])

  const updateSource = useMemo(
    () =>
      getUpdateSource(UPDATE_BASE_URL, {
        updateStrategy: 'fingerprint',
      }),
    [],
  )

  const appendLog = useCallback((text: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((current) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, text: `[${timestamp}] ${text}` }, ...current]
      return next.slice(0, 30)
    })
  }, [])

  useEffect(() => {
    hide()
  }, [])

  useEffect(() => {
    setSnapshotDownloaded(HotUpdater.isUpdateDownloaded())
  }, [isUpdateDownloaded])

  useEffect(() => {
    const unsubscribe = HotUpdater.addListener('onProgress', ({ progress: nextProgress }) => {
      appendLog(`Download progress ${Math.round(nextProgress * 100)}%`)
    })

    return () => {
      unsubscribe()
    }
  }, [appendLog])

  const handleCheckForUpdate = useCallback(async () => {
    setIsChecking(true)
    setLastError(null)
    appendLog('Checking for updates...')

    try {
      const result = await HotUpdater.checkForUpdate({
        source: updateSource,
      })
      setLastCheckedAt(new Date())

      if (!result) {
        setUpdateInfo(null)
        setStatusMessage('Device is up to date.')
        appendLog('No update available.')
        return
      }

      setUpdateInfo(result)
      setStatusMessage(
        `Update ${result.id} (${result.status}) available${result.shouldForceUpdate ? ' - force update' : ''}.`,
      )
      if (result.message) {
        appendLog(`Server message: ${result.message}`)
      } else {
        appendLog(`Update ${result.id} ready to download.`)
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error)
      setLastError(description)
      setStatusMessage('Update check failed.')
      appendLog(`Check failed: ${description}`)
    } finally {
      setIsChecking(false)
    }
  }, [appendLog, updateSource])

  const handleApplyWithInfo = useCallback(async () => {
    if (!updateInfo) return
    setIsUpdating(true)
    setLastError(null)
    appendLog('Applying update via updateInfo.updateBundle()...')

    try {
      await updateInfo.updateBundle()
      appendLog('Bundle downloaded via updateInfo and ready for reload.')
      if (updateInfo.shouldForceUpdate) {
        appendLog('Force update detected, reloading app.')
        await HotUpdater.reload()
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error)
      setLastError(description)
      appendLog(`updateBundle() failed: ${description}`)
    } finally {
      setIsUpdating(false)
    }
  }, [appendLog, updateInfo])

  const handleManualUpdate = useCallback(async () => {
    if (!updateInfo) return
    if (!updateInfo.fileUrl) {
      const description = 'fileUrl missing in update metadata.'
      setLastError(description)
      appendLog(description)
      return
    }

    setIsUpdating(true)
    setLastError(null)
    appendLog('Applying update via HotUpdater.updateBundle()...')

    try {
      const fileHash = 'fileHash' in updateInfo ? (updateInfo.fileHash ?? null) : null
      await HotUpdater.updateBundle({
        bundleId: updateInfo.id,
        fileUrl: updateInfo.fileUrl,
        fileHash,
        status: updateInfo.status,
      })
      appendLog('Manual updateBundle() download finished.')
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error)
      setLastError(description)
      appendLog(`HotUpdater.updateBundle failed: ${description}`)
    } finally {
      setIsUpdating(false)
    }
  }, [appendLog, updateInfo])

  const handleReload = useCallback(async () => {
    appendLog('Reload requested.')
    await HotUpdater.reload()
  }, [appendLog])

  const hasUpdate = Boolean(updateInfo)
  const progressPercent = `${Math.round(progress * 100)}%`
  const showReloadCta = isUpdateDownloaded || snapshotDownloaded

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-zinc-950">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-3xl font-bold text-white">Hot Updater 调试面板</Text>
          <Text className="text-base text-slate-400">
            Channel: <Text className="font-semibold text-white">{channel}</Text>
          </Text>
          <Text className="text-xs text-slate-500">
            Last checked: {lastCheckedAt ? lastCheckedAt.toLocaleString() : '尚未检查'}
          </Text>
          <Text className="text-sm text-emerald-300">{statusMessage}</Text>
          {lastError ? <Text className="text-sm text-rose-400">Error: {lastError}</Text> : null}
        </View>

        <View className="gap-4">
          <StatCard label="Download Progress" value={progressPercent}>
            <View className="mt-3 h-2 w-full rounded-full bg-zinc-800">
              <View className="h-2 rounded-full bg-emerald-500" style={{ width: progress * 100 + '%' }} />
            </View>
          </StatCard>
          <StatCard
            label="isUpdateDownloaded()"
            value={showReloadCta ? 'ready' : 'pending'}
            helper={showReloadCta ? 'Bundle ready - reload to apply.' : 'Download a bundle to enable reload.'}
          />
          <StatCard
            label="Store snapshot"
            value={snapshotDownloaded ? 'true' : 'false'}
            helper="Derived from useHotUpdaterStore().isUpdateDownloaded"
          />
        </View>

        {updateInfo ? (
          <View className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400">Update Metadata</Text>
            <KeyValue label="ID" value={updateInfo.id} />
            <KeyValue label="Status" value={updateInfo.status} />
            <KeyValue label="Force Update" value={updateInfo.shouldForceUpdate ? 'true' : 'false'} />
            <KeyValue label="File URL" value={updateInfo.fileUrl ?? 'null'} />
            {'fileHash' in updateInfo ? <KeyValue label="File Hash" value={updateInfo.fileHash ?? 'null'} /> : null}
            <KeyValue label="Message" value={updateInfo.message ?? '无'} />
          </View>
        ) : null}

        <View className="gap-3">
          <Text className="text-lg font-semibold text-white">操作</Text>
          <ActionButton
            title="检查更新"
            subtitle="调用 HotUpdater.checkForUpdate"
            onPress={handleCheckForUpdate}
            disabled={isChecking || isUpdating}
            loading={isChecking}
          />
          <ActionButton
            title="使用 updateInfo.updateBundle() 下载"
            subtitle="推荐路径，自动带上 fileHash"
            onPress={handleApplyWithInfo}
            disabled={!hasUpdate || isUpdating}
            loading={isUpdating}
          />
          <ActionButton
            title="直接调用 HotUpdater.updateBundle()"
            subtitle="完全手动控制"
            onPress={handleManualUpdate}
            disabled={!hasUpdate || isUpdating}
            loading={isUpdating}
            tone="secondary"
          />
          <ActionButton
            title="HotUpdater.reload()"
            subtitle={showReloadCta ? '即刻应用已下载的 bundle' : '等待 bundle 下载完成'}
            onPress={handleReload}
            disabled={!showReloadCta}
            tone="danger"
          />
        </View>

        <View className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400">实时日志</Text>
          {logs.length === 0 ? (
            <Text className="mt-2 text-xs text-slate-500">暂无日志</Text>
          ) : (
            <View className="mt-2 gap-1">
              {logs.map((entry) => (
                <Text key={entry.id} className="font-mono text-[11px] text-slate-200">
                  {entry.text}
                </Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({
  label,
  value,
  helper,
  children,
}: {
  label: string
  value: string
  helper?: string
  children?: ReactNode
}) {
  return (
    <View className="rounded-3xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="text-2xl font-semibold text-white">{value}</Text>
      {helper ? <Text className="text-xs text-slate-400">{helper}</Text> : null}
      {children}
    </View>
  )
}

type ActionButtonProps = {
  title: string
  subtitle?: string
  onPress: () => void | Promise<void>
  disabled?: boolean
  tone?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

function ActionButton({ title, subtitle, onPress, disabled, tone = 'primary', loading }: ActionButtonProps) {
  const toneClasses: Record<ActionButtonProps['tone'], string> = {
    primary: 'bg-emerald-600 border-emerald-500',
    secondary: 'bg-indigo-600 border-indigo-500',
    danger: 'bg-rose-600 border-rose-500',
  }

  const className = ['rounded-2xl border px-4 py-3', toneClasses[tone], disabled ? 'opacity-50' : null]
    .filter(Boolean)
    .join(' ')

  return (
    <Pressable className={className} onPress={onPress} disabled={disabled}>
      <Text className="text-base font-semibold text-white">{loading ? '处理中...' : title}</Text>
      {subtitle ? <Text className="text-xs text-white/80">{subtitle}</Text> : null}
    </Pressable>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-2">
      <Text className="text-[11px] uppercase tracking-[1px] text-slate-500">{label}</Text>
      <Text className="text-sm text-white">{value}</Text>
    </View>
  )
}
