import { EffectMetricsView } from '@xstack/app/components/effect-metrics-view'
import { DebugPanelPopoverItem } from '@xstack/app/debug/components'
import {
  effectMetricsFromSnapshot,
  eventLogMetricsFromSnapshot,
  sqlMetricsFromSnapshot,
} from '@xstack/app/metric/utils'
import { useLocalStorageState } from 'ahooks'
import * as Metric from 'effect/Metric'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

const width = 550
const baseHeight = 155

export const EffectDebug = ({ sqlEnable, isAppRoute }: { sqlEnable: boolean; isAppRoute: boolean }) => {
  const checkWorkerEnable = () => {
    setWorkerEnable(() => {
      //@ts-ignore
      return typeof globalThis.__x_worker_metrics === 'function'
    })
  }
  const [effectDebugOpened, setEffectDebugOpened] = useLocalStorageState('x-effect-debug-opened', {
    defaultValue: false,
  })
  const location = useLocation()
  const [loaded, setLoaded] = useState(!false)
  const [workerEnable, setWorkerEnable] = useState(() => {
    // @ts-ignore
    return typeof globalThis.__x_worker_metrics === 'function'
  })

  const getSqlMetrics = async () => {
    const snapshot = Metric.unsafeSnapshot()
    return sqlMetricsFromSnapshot(snapshot)
  }

  useEffect(() => {
    checkWorkerEnable()
  }, [location.pathname])

  useEffect(() => {
    if (effectDebugOpened) {
      ///@ts-ignore
      setTimeout(() => {
        checkWorkerEnable()
      }, 500)
    }
  }, [effectDebugOpened])

  return (
    <DebugPanelPopoverItem
      icon={'🔳'}
      title="Effect"
      preventOutside
      forceMount
      className="pointer-events-none relative overflow-hidden"
      opened={effectDebugOpened}
      onOpenChange={(opened) => {
        setEffectDebugOpened(opened)
      }}
    >
      {!loaded && (
        <div className="flex absolute inset-0 flex justify-center items-center bg-background">
          <div className="loader2" />
        </div>
      )}
      {isAppRoute && workerEnable && <WorkerMetricReceived onClose={() => setWorkerEnable(false)} />}
      <MainEffectMetricsView loaded={loaded} setLoaded={setLoaded} />
      <WorkerEffectMetricsView />
      {sqlEnable && (
        <>
          <EffectMetricsView
            getMetrics={getSqlMetrics}
            width={width}
            minHeight={baseHeight}
            refreshInterval={1000}
            historySize={30}
            instanceId="sql-metrics"
          />
          <EventLogMetricsView />
        </>
      )}
    </DebugPanelPopoverItem>
  )
}

function MainEffectMetricsView({ loaded, setLoaded }: { loaded: boolean; setLoaded: (loaded: boolean) => void }) {
  const getEffectMetrics = async () => {
    if (!loaded) {
      setTimeout(() => {
        setLoaded(true)
      }, 1000)
    }

    const snapshot = Metric.unsafeSnapshot()
    const metrics = effectMetricsFromSnapshot(snapshot)
    return metrics
  }

  return (
    <EffectMetricsView
      getMetrics={getEffectMetrics}
      width={width}
      minHeight={baseHeight}
      refreshInterval={1000}
      historySize={30}
      instanceId="main-effect-metrics"
    />
  )
}

// ----- Worker Metrics -----

let snapshot: ReturnType<typeof Metric.unsafeSnapshot> = []

function WorkerMetricReceived({ onClose }: { onClose?: () => void }) {
  useEffect(() => {
    //@ts-ignore
    if (typeof globalThis.__x_worker_metrics === 'function') {
      //@ts-ignore
      globalThis.__x_worker_metrics((data) => {
        snapshot = JSON.parse(data)
      })
    } else {
      onClose?.()
    }
  }, [])

  return null
}

function WorkerEffectMetricsView() {
  const getMetrics = async () => {
    const metrics = effectMetricsFromSnapshot(snapshot)
    return metrics
  }

  return (
    <EffectMetricsView
      getMetrics={getMetrics}
      width={width}
      minHeight={baseHeight}
      refreshInterval={1000}
      historySize={30}
      instanceId="worker-effect-metrics"
    />
  )
}

function EventLogMetricsView() {
  const getMetrics = async () => {
    const metrics = eventLogMetricsFromSnapshot(snapshot)
    return metrics
  }

  return (
    <EffectMetricsView
      getMetrics={getMetrics}
      width={width}
      minHeight={baseHeight * 1.5}
      refreshInterval={1000}
      historySize={30}
      instanceId="event-log-metrics"
    />
  )
}
