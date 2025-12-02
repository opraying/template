import * as Metric from 'effect/Metric'
import * as MetricBoundaries from 'effect/MetricBoundaries'

// 查询执行计数
export const queryCount = Metric.counter('sql.query.count', {
  description: 'Query count',
  incremental: true,
})

// 查询错误计数
export const errorCount = Metric.counter('sql.error.count', {
  description: 'Query errors',
  incremental: true,
})

// 查询延迟直方图
export const queryLatency = Metric.histogram(
  'sql.query.latency.ms',
  MetricBoundaries.fromIterable([1, 5, 10, 25, 50, 100, 250, 500, 1000]),
  'Query latency',
)

// 最后查询延迟
export const lastQueryLatency = Metric.gauge('sql.query.last.latency.ms', {
  description: 'Last query latency',
})

// 查询类型频率
export const queryTypes = Metric.frequency('sql.query.types', {
  description: 'Query types',
})
