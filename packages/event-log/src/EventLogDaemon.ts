import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogPlatformEffects from '@xstack/event-log/EventLogPlatformEffects'
import * as EventLogStates from '@xstack/event-log/EventLogStatesWorker'
import * as Identity from '@xstack/event-log/Identity'
import type * as EventLogSchema from '@xstack/event-log/Schema'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'

export class EventLogDaemon extends Effect.Service<EventLogDaemon>()('EventLogDaemon', {
  scoped: Effect.gen(function* () {
    const { syncLocalStatsInterval, syncRemoteStatsInterval } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
    const eventLogState = yield* EventLogStates.EventLogStates
    const identity = yield* Identity.Identity
    const platformEffects = yield* EventLogPlatformEffects.EventLogPlatformEffects
    const fetchRemoteStatusSemaphore = yield* Effect.makeSemaphore(1)

    const { socketStatus, remoteSyncFlag, remoteSyncStats, localSyncStats, localSyncEvent, events } = eventLogState

    const isOnlinePredicate = (enable = true) =>
      platformEffects.getNetworkStatus.pipe(Effect.map((_) => _.isInternetReachable && enable))

    const updateRemoteSyncStats = Effect.gen(function* () {
      const publicKey = yield* Stream.runHead(identity.publicKeyStream)
      if (Option.isNone(publicKey)) return

      yield* Effect.logTrace('Fetching remote sync stats').pipe(Effect.annotateLogs({ publicKey: publicKey.value }))

      yield* pipe(
        identity.syncPublicKey(publicKey.value),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.void,
            onSome: (stats) =>
              remoteSyncStats
                .upsert(stats)
                .pipe(Effect.tap(Effect.logTrace('Remote sync stats updated').pipe(Effect.annotateLogs({ stats })))),
          }),
        ),
      )
    }).pipe(
      fetchRemoteStatusSemaphore.withPermitsIfAvailable(1),
      Effect.catchAllCause((cause) =>
        Effect.logWarning('updateRemoteSyncStats failed').pipe(Effect.annotateLogs({ cause: Cause.pretty(cause) })),
      ),
      Effect.withSpan('EventLogState.updateRemoteSyncStats'),
      Effect.forkScoped,
      Effect.asVoid,
    )

    const updateLocalStats = Effect.gen(function* () {
      yield* Effect.logTrace('Local storage stats fetching')

      const stats = yield* platformEffects.getLocalStorageStats

      yield* localSyncStats.upsert({
        usedStorageSize: stats.used,
      })

      yield* Effect.logTrace('Local storage stats refreshed').pipe(
        Effect.annotateLogs({
          ...stats,
        }),
      )
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning('Local storage stats refreshed failed').pipe(
          Effect.annotateLogs({ cause: Cause.pretty(cause) }),
        ),
      ),
      Effect.withSpan('EventLogState.updateLocalStats'),
      Effect.forkScoped,
      Effect.asVoid,
    )

    /**
     * 初始化时如果同步开启则获取一次远端信息
     */
    yield* pipe(
      remoteSyncFlag.enabled,
      Stream.changes,
      Stream.filterEffect((enable) => isOnlinePredicate(enable)),
      Stream.debounce('100 millis'),
      Stream.tap(() => Effect.logTrace('Remote sync enabled, initiating stats update')),
      Stream.mapEffect(() => updateRemoteSyncStats),
      Stream.runDrain,
      Effect.interruptible,
      Effect.forkScoped,
    )

    /**
     * 监听 socket 状态, 设置是否在线提供给界面显示
     * 如果 socket 异常 -> Offline
     * 如果 socket 正常，定期获取 Remote sync stats
     */
    yield* pipe(
      socketStatus.online,
      Stream.changes,
      Stream.debounce('100 millis'),
      Stream.filter((socketOnline) => !!socketOnline),
      Stream.tap(() => Effect.logTrace('Socket online, starting periodic remote stats fetch')),
      Stream.flatMap(() => Stream.fromSchedule(Schedule.spaced(syncRemoteStatsInterval)), {
        switch: true,
      }),
      Stream.filterEffect(() => isOnlinePredicate()),
      Stream.mapEffect(() => updateRemoteSyncStats),
      Stream.runDrain,
      Effect.interruptible,
      Effect.forkScoped,
    )

    /**
     * 定期获取本地存储使用情况
     */
    yield* pipe(
      updateLocalStats,
      Effect.repeat({ schedule: Schedule.spaced(syncLocalStatsInterval) }),
      Effect.tap(() => Effect.logTrace('Updating local stats periodically')),
      Effect.interruptible,
      Effect.forkScoped,
    )

    /**
     * 将 Event Log 同步状态持久化
     */
    yield* pipe(
      events.toStream<EventLogSchema.SyncEvents>('sync-event'),
      Stream.changes,
      Stream.mapEffect(
        Effect.fn(function* (e) {
          const publicKey = yield* Stream.runHead(identity.publicKeyStream)
          if (Option.isNone(publicKey)) {
            return yield* Effect.dieMessage('Public key not found')
          }
          yield* Match.value(e).pipe(
            Match.tag('SyncEvents', (_) =>
              Match.value(_.payload).pipe(
                Match.tag('starting', () => Effect.logTrace('Sync starting')),
                Match.tag('end', ({ exit }) => {
                  const now = new Date()
                  return pipe(
                    Exit.match(exit, {
                      onFailure: (cause) =>
                        localSyncEvent.failure({
                          reason: cause._tag,
                          error: JSON.stringify(Cause.squashWith(cause, (_) => _.message)),
                        }),
                      onSuccess: () => localSyncEvent.success(),
                    }),
                    Effect.zipRight(
                      identity.upsertPublicKey(publicKey.value, { lastSyncedAt: now, synced: true }).pipe(Effect.orDie),
                    ),
                    Effect.tap(Effect.logTrace('Sync end')),
                  )
                }),
                Match.exhaustive,
              ),
            ),
            Match.orElse(() => Effect.void),
          )
        }),
      ),
      Stream.runDrain,
      Effect.interruptible,
      Effect.forkScoped,
    )

    return {}
  }).pipe(Effect.withLogSpan('@event-log/daemon')),
  dependencies: [],
}) {}
