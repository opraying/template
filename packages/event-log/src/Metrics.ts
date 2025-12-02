import * as Metric from 'effect/Metric'
import * as MetricBoundaries from 'effect/MetricBoundaries'

// ----- Event -----

export const eventQueryCount = Metric.counter('event.query.count', {
  description: 'Event queries count',
  incremental: true,
})

export const eventQueryLatency = Metric.gauge('event.query.latency.ms', { description: 'Event query latency' })

export const eventWriteCount = Metric.counter('event.write.count', {
  description: 'Events written count',
  incremental: true,
})

export const eventWriteMessageSize = Metric.histogram(
  'event.write.message.size.bytes',
  MetricBoundaries.fromIterable([100, 1000, 10000, 100000, 500000, 1000000]),
  'Write Msg size',
)

export const eventWriteLatency = Metric.gauge('event.write.latency.ms', { description: 'Event write latency' })

export const eventWriteErrorCount = Metric.counter('event.write.error.count', {
  description: 'Event write errors',
  incremental: true,
})

// ----- Journal ----

export const journalEventCount = Metric.gauge('event.journal.count', {
  description: 'Events in journal',
})

export const journalEventTypes = Metric.frequency('event.types', {
  description: 'Event type frequency',
})

// ----- Sync -----

export const remoteMessageSize = Metric.histogram(
  'event.journal.message.size.bytes',
  MetricBoundaries.fromIterable([100, 1000, 10000, 100000, 500000, 1000000]),
  'Received Msg size',
)

export const remoteMessageErrorCount = Metric.counter('event.journal.remote.message.error.count', {
  description: 'Remote Msg errors',
  incremental: true,
})

export const remoteMessageSuccessCount = Metric.counter('event.journal.remote.message.success.count', {
  description: 'Remote Msg success',
  incremental: true,
})

export const remoteMessageLatency = Metric.gauge('event.journal.message.latency.ms', {
  description: 'Remote Msg RTT',
})

export const syncSuccessCount = Metric.counter('event.sync.success.count', {
  description: 'Successful syncs',
  incremental: true,
})

export const syncErrorCount = Metric.counter('event.sync.error.count', {
  description: 'Sync errors',
  incremental: true,
})

export const syncLatency = Metric.gauge('event.sync.latency.ms', { description: 'Sync latency' })

// Encrypt/Decrypt

export const encryptionLatency = Metric.gauge('event.encryption.latency.ms', { description: 'Encryption latency' })

export const encryptionCount = Metric.counter('event.encryption.count', {
  description: 'Encryption count',
  incremental: true,
})

export const decryptionLatency = Metric.gauge('event.decryption.latency.ms', { description: 'Decryption latency' })

export const decryptionCount = Metric.counter('event.decryption.count', {
  description: 'Decryption count',
  incremental: true,
})
