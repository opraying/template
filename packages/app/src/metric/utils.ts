import type * as Metric from 'effect/Metric'
import * as MetricState from 'effect/MetricState'
import * as Option from 'effect/Option'
import { hasProperty } from 'effect/Predicate'

const COLORS = {
  blue: 'rgb(66, 165, 245)',
  green: 'rgb(76, 175, 80)',
  gray: 'rgb(82, 125, 189)',
  red: 'rgb(244, 67, 54)',
  orange: 'rgb(255, 152, 0)',
  purple: 'rgb(195, 79, 215)',
  yellow: 'rgb(235, 215, 59)',
  cyan: 'rgb(0, 188, 212)',
  teal: 'rgb(0, 150, 136)',
  indigo: 'rgb(119, 137, 233)',
  pink: 'rgb(233, 30, 99)',
  lime: 'rgb(236, 226, 67)',
}

export interface CountMetric {
  type: 'count'
  value: number
  label: string
  color: string
  textOnly?: boolean
}

export interface HistogramMetric {
  type: 'histogram'
  count: number
  max: number
  min: number
  sum: number
  buckets: Array<[number, number]>
  label: string
  color: string
  unit: string
  fullWidth?: boolean
}

interface GaugeThresholds {
  warning?: number
  danger?: number
}

export interface GaugeMetric {
  type: 'gauge'
  label: string
  value: number
  color: string
  unit: string
  thresholds?: GaugeThresholds
}

export interface FrequencyMetric {
  type: 'frequency'
  label: string
  color: string
  frequencies: Array<[string, number]>
  total: number
}

export type DebugMetric = CountMetric | HistogramMetric | FrequencyMetric | GaugeMetric

const isCounterState = <A extends number | bigint>(
  state: MetricState.MetricState<any>,
): state is MetricState.MetricState.Counter<A> => {
  return MetricState.isCounterState(state) || (Object.keys(state).length === 1 && hasProperty(state, 'count'))
}

const isHistogramState = (state: MetricState.MetricState<any>): state is MetricState.MetricState.Histogram => {
  return MetricState.isHistogramState(state) || (Object.keys(state).length >= 1 && hasProperty(state, 'buckets'))
}

const isFrequencyState = (state: MetricState.MetricState<any>): state is MetricState.MetricState.Frequency => {
  return MetricState.isFrequencyState(state) || (Object.keys(state).length >= 1 && hasProperty(state, 'frequencies'))
}

const isGaugeState = <A extends number | bigint>(
  state: MetricState.MetricState<any>,
): state is MetricState.MetricState.Gauge<A> => {
  return MetricState.isGaugeState(state) || (Object.keys(state).length >= 1 && hasProperty(state, 'value'))
}

interface MetricStyle {
  color: string
  label?: string
  unit?: string
  fullWidth?: boolean
  textOnly?: boolean
  thresholds?: GaugeThresholds
  group?: string
}

interface MetricPattern {
  pattern: string | RegExp
  style: Partial<MetricStyle>
}

type MetricType = 'count' | 'histogram' | 'frequency' | 'gauge'

const DEFAULT_METRIC_PATTERNS: MetricPattern[] = [
  // Performance metrics
  {
    pattern: 'latency',
    style: { color: COLORS.blue, unit: 'ms' },
  },
  {
    pattern: 'duration',
    style: { color: COLORS.blue, unit: 'ms' },
  },
  {
    pattern: 'timeout',
    style: { color: COLORS.orange, unit: 'ms' },
  },

  // Error metrics
  {
    pattern: /\.(error|errors|failure|failures)\./,
    style: { color: COLORS.red },
  },

  // Success metrics
  {
    pattern: /\.(success|completed|ok)\./,
    style: { color: COLORS.green },
  },

  // Size metrics
  {
    pattern: /\.size\.(bytes|kb|mb|gb)\./,
    style: { color: COLORS.orange, unit: 'bytes' },
  },
  {
    pattern: 'memory',
    style: { color: COLORS.orange, unit: 'bytes' },
  },

  // Count metrics
  {
    pattern: /\.(count|total)\./,
    style: { color: COLORS.yellow },
  },

  // State metrics
  {
    pattern: 'active',
    style: { color: COLORS.lime },
  },
  {
    pattern: 'pending',
    style: { color: COLORS.yellow },
  },
  {
    pattern: 'queued',
    style: { color: COLORS.orange },
  },

  // Type distribution metrics
  {
    pattern: 'types',
    style: { color: COLORS.purple },
  },

  // Cache metrics
  {
    pattern: 'cache.hit',
    style: { color: COLORS.green },
  },
  {
    pattern: 'cache.miss',
    style: { color: COLORS.orange },
  },

  // Connection metrics
  {
    pattern: /\.(connected|online)\./,
    style: { color: COLORS.green },
  },
  {
    pattern: /\.(disconnected|offline)\./,
    style: { color: COLORS.red },
  },

  // Resource metrics
  {
    pattern: 'usage',
    style: { color: COLORS.teal },
  },
  {
    pattern: 'capacity',
    style: { color: COLORS.indigo },
  },

  // Gauge metrics
  {
    pattern: 'gauge',
    style: { color: COLORS.cyan },
  },

  // 同步相关指标
  {
    pattern: /^sync\./,
    style: {
      group: 'sync',
      color: COLORS.blue,
    },
  },
]

interface MetricProcessorConfig {
  prefix: Array<string | RegExp>
  patterns?: MetricPattern[]
  defaultColor?: string
  formatLabel?: (name: string) => string
}

const METRIC_TYPE_ORDER = {
  gauge: 0,
  count: 1,
  histogram: 2,
  frequency: 3,
} as const

const GROUP_ORDER = {
  errors: 0, // 错误指标最重要，放在最前面
  latency: 1, // 延迟指标次之
  sync: 2, // 同步状态
  size: 3, // 大小指标
  batch: 4, // 批处理指标
  counters: 5, // 计数器指标
  others: 6, // 其他指标放最后
} as const

type MetricGroup = keyof typeof GROUP_ORDER

const getMetricGroup = (metric: DebugMetric): string => {
  // 首先检查是否有显式配置的组
  const style = getMetricStyle(metric.label, metric.type, DEFAULT_METRIC_PATTERNS)
  if (style.group) {
    return style.group
  }

  // 然后使用默认的分组逻辑
  if (metric.type === 'gauge' && (metric as GaugeMetric).unit === 'ms') {
    return 'latency'
  }

  if (metric.type === 'histogram' && (metric as HistogramMetric).unit === 'bytes') {
    return 'size'
  }

  if (metric.type === 'count' && (metric as CountMetric).textOnly) {
    return 'counters'
  }

  return 'others'
}

const compareMetrics = (a: DebugMetric, b: DebugMetric): number => {
  // First sort by group
  const groupA = getMetricGroup(a) as MetricGroup
  const groupB = getMetricGroup(b) as MetricGroup

  const orderA = GROUP_ORDER[groupA] ?? GROUP_ORDER.others
  const orderB = GROUP_ORDER[groupB] ?? GROUP_ORDER.others

  if (orderA !== orderB) {
    return orderA - orderB
  }

  // Then sort by metric type order
  const typeOrderDiff = METRIC_TYPE_ORDER[a.type] - METRIC_TYPE_ORDER[b.type]
  if (typeOrderDiff !== 0) {
    return typeOrderDiff
  }

  // Finally sort by label within the same type
  return a.label.localeCompare(b.label)
}

const getTypeColors = (type: MetricType): string => {
  switch (type) {
    case 'count':
      return COLORS.yellow
    case 'gauge':
      return COLORS.cyan
    case 'histogram':
      return COLORS.purple
    case 'frequency':
      return COLORS.teal
  }
}

const getMetricStyle = (name: string, type: MetricType, patterns: MetricPattern[]): MetricStyle => {
  const matchingPattern = patterns.find((p) =>
    typeof p.pattern === 'string' ? name.includes(p.pattern) : p.pattern.test(name),
  )

  const color = matchingPattern?.style.color || getTypeColors(type)

  return {
    color,
    label: matchingPattern?.style.label || '',
    unit: matchingPattern?.style.unit || '',
    fullWidth: matchingPattern?.style.fullWidth ?? true,
    textOnly: matchingPattern?.style.textOnly ?? false,
    thresholds: matchingPattern?.style.thresholds ?? {},
    group: matchingPattern?.style.group || '',
  }
}

const createMetricsProcessor = (config: MetricProcessorConfig) => {
  const {
    prefix,
    patterns = DEFAULT_METRIC_PATTERNS,
    defaultColor = COLORS.gray,
    formatLabel = (name: string) => {
      const matchingPrefix = prefix.find((p) => {
        if (typeof p === 'string') {
          return name.startsWith(p)
        }
        return p.test(name)
      })

      const cleanName =
        typeof matchingPrefix === 'string'
          ? name.replace(matchingPrefix, '')
          : matchingPrefix instanceof RegExp
            ? name.replace(matchingPrefix, '')
            : name

      return cleanName
        .split('.')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
        .trim()
    },
  } = config

  return (snapshot: ReturnType<typeof Metric.unsafeSnapshot>): DebugMetric[] => {
    const metrics: DebugMetric[] = []

    const filteredMetrics = snapshot.filter((metric) =>
      prefix.some((p) => {
        if (typeof p === 'string') {
          return metric.metricKey.name.startsWith(p)
        }
        return p.test(metric.metricKey.name)
      }),
    )

    for (const metric of filteredMetrics) {
      const { name, description } = metric.metricKey
      const state = metric.metricState

      if (isCounterState(state)) {
        const type = 'count'
        const style = getMetricStyle(name, type, patterns)
        const label = style.label || Option.getOrElse(description, () => formatLabel(name))
        const _unit = style.unit || ''

        metrics.push({
          type,
          label,
          value: Number(state.count),
          color: style.color,
          textOnly: style.textOnly ?? false,
        })
      } else if (isHistogramState(state)) {
        const type = 'histogram'
        const style = getMetricStyle(name, type, patterns)
        const label = style.label || Option.getOrElse(description, () => formatLabel(name))
        const unit = style.unit || ''

        metrics.push({
          type,
          label,
          color: style.color,
          buckets: state.buckets as HistogramMetric['buckets'],
          count: state.count,
          max: state.max,
          min: state.min,
          sum: state.sum,
          unit,
          fullWidth: style.fullWidth ?? true,
        })
      } else if (isFrequencyState(state)) {
        const type = 'frequency'
        const style = getMetricStyle(name, type, patterns)
        const label = style.label || Option.getOrElse(description, () => formatLabel(name))
        const entries = Array.from(state.occurrences.entries())
        const total = entries.reduce((sum, [_, count]) => sum + Number(count), 0)
        metrics.push({
          type,
          label,
          color: style.color,
          frequencies: entries.map(([key, value]) => [key, Number(value)]),
          total,
        })
      } else if (isGaugeState(state)) {
        const type = 'gauge'
        const style = getMetricStyle(name, type, patterns)
        const label = style.label || Option.getOrElse(description, () => formatLabel(name))
        const unit = style.unit || ''

        metrics.push({
          type,
          label,
          value: Number(state.value),
          color: style.color,
          unit,
          thresholds: style.thresholds ?? {},
        })
      }
    }

    // Sort metrics before returning
    return metrics.sort(compareMetrics)
  }
}

// Update metric processors with custom patterns if needed
export const effectMetricsFromSnapshot = createMetricsProcessor({
  prefix: ['effect_'],
  patterns: [
    { pattern: 'fiber_active', style: { color: COLORS.lime, label: 'Active Fibers' } },
    { pattern: 'fiber_started', style: { color: COLORS.blue, label: 'Started Fibers' } },
    { pattern: 'fiber_successes', style: { color: COLORS.green, label: 'Successful Fibers' } },
    { pattern: 'fiber_failures', style: { color: COLORS.red, label: 'Failed Fibers' } },
    { pattern: 'fiber_lifetimes', style: { color: COLORS.gray, label: 'Fiber Lifetimes', unit: 'ms' } },
  ],
})

export const sqlMetricsFromSnapshot = createMetricsProcessor({
  prefix: ['sql'],
  patterns: [
    { pattern: 'query.count', style: { color: COLORS.blue, label: 'Queries' } },
    { pattern: 'query.latency', style: { label: 'Query Latency', unit: 'ms' } },
    { pattern: 'query.types', style: { label: 'Query Types' } },
    { pattern: 'query.last.latency', style: { color: COLORS.yellow, label: 'Last Query', unit: 'ms' } },
    ...DEFAULT_METRIC_PATTERNS,
  ],
})

export const eventLogMetricsFromSnapshot = createMetricsProcessor({
  prefix: ['event'],
  patterns: [
    {
      pattern: /\.(error|errors|failure|failures)$/,
      style: {
        color: COLORS.red,
        group: 'errors',
        textOnly: true,
      },
    },
    // 同步
    {
      pattern: /^sync\.(?!error|errors)/, // 匹配 sync. 开头但不是错误的指标
      style: {
        group: 'sync',
        color: COLORS.blue,
        textOnly: true, // 使用紧凑模式
      },
    },
    {
      pattern: /sync\.latency/,
      style: {
        group: 'latency',
        color: COLORS.blue,
        unit: 'ms',
        thresholds: {
          warning: 200,
          danger: 500,
        },
      },
    },
    {
      pattern: /sync\.(error|errors)$/,
      style: {
        color: COLORS.red,
        group: 'errors',
        textOnly: true,
      },
    },
    // 调整延迟指标的阈值
    {
      pattern: /event\.write\.latency/,
      style: {
        group: 'latency',
        unit: 'ms',
        thresholds: {
          warning: 10, // 写入操作应该更快
          danger: 50,
        },
      },
    },
    {
      pattern: /remote\.msg\.rtt/,
      style: {
        group: 'latency',
        unit: 'ms',
        thresholds: {
          warning: 5, // 网络延迟要求更严格
          danger: 20,
        },
      },
    },
    // 延迟相关指标
    {
      pattern: /\.(latency|rtt)$/,
      style: {
        fullWidth: false,
        unit: 'ms',
        group: 'latency',
        thresholds: {
          warning: 100,
          danger: 300,
        },
      },
    },
    // 加密解密
    {
      pattern: /\.encryption\.(latency|count)/,
      style: {
        unit: 'ms',
        group: 'latency',
        color: COLORS.indigo,
        thresholds: {
          warning: 50, // 加密解密操作应该更快
          danger: 100,
        },
      },
    },
    {
      pattern: /\.encryption\.batch/,
      style: {
        fullWidth: false,
        group: 'batch',
        color: COLORS.indigo,
      },
    },
    {
      pattern: /\.decryption\.(latency|count)/,
      style: {
        unit: 'ms',
        group: 'latency',
        color: COLORS.cyan,
        thresholds: {
          warning: 50, // 加密解密操作应该更快
          danger: 100,
        },
      },
    },
    {
      pattern: /\.decryption\.batch/,
      style: {
        fullWidth: false,
        group: 'batch',
        color: COLORS.cyan,
      },
    },
    // 计数器指标
    {
      pattern: /\.(count|attempts)$/,
      style: {
        textOnly: true,
        group: 'counters',
      },
    },
    {
      pattern: /\.message\.size/,
      style: {
        color: COLORS.pink,
        unit: 'bytes',
        group: 'size',
      },
    },
    {
      pattern: /\.size$/,
      style: {
        color: COLORS.orange,
        unit: 'bytes',
        group: 'size',
        fullWidth: false,
      },
    },
    ...DEFAULT_METRIC_PATTERNS,
  ],
})
