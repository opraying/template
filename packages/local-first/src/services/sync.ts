import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import * as Identity from '@xstack/event-log/Identity'
import { makeAtomService, UseUseServices, Atom } from '@xstack/atom-react'
import * as GlobalLayer from '@xstack/atom-react/global'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Stream from 'effect/Stream'

const Live = pipe(
  GlobalLayer.use(
    'LocalSync',
    // Tracer.Tracer,
    SqlClient.SqlClient,
    Reactivity.Reactivity,
    Identity.Identity,
    EventLogStates.EventLogStates,
  ),
)

export class SyncService extends Effect.Service<SyncService>()('SyncService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const eventLogState = yield* EventLogStates.EventLogStates

    const {
      socketStatus,
      devicesStatus,
      remoteSyncFlag,
      remoteSyncStats,
      localSyncStatsStream,
      syncing,
      publicKeysStream,
    } = eventLogState

    const pauseSync = Effect.fn('pauseSync')(function* () {
      yield* remoteSyncFlag.pause
    })

    const resumeSync = Effect.fn('resumeSync')(function* () {
      yield* remoteSyncFlag.resume
    })

    return {
      pauseSync,
      resumeSync,
      syncEnabled: remoteSyncFlag.enabled,
      syncing,
      connectedDevicesStream: devicesStatus.connected,
      socketStatusStream: socketStatus.stream,
      remoteSyncStatsStream: remoteSyncStats.stream,
      localSyncStatsStream,
      publicKeysStream,
    }
  }),
  dependencies: [],
}) {
  static get useAtom() {
    return makeAtomService(this, useSyncService)
  }
}

const useSyncService = UseUseServices(
  { SyncService },
  Live,
)(({ runtime, services: { SyncService } }) => {
  const pauseSync = runtime.fn(() => SyncService.pauseSync()).pipe(Atom.debounce(500))

  const resumeSync = runtime.fn(() => SyncService.resumeSync()).pipe(Atom.debounce(500))

  const syncEnabled = runtime.atom(Stream.unwrap(SyncService.syncEnabled), { initialValue: true })

  const syncing = runtime.atom(Stream.unwrap(SyncService.syncing), { initialValue: false })

  const socketStatus = runtime.atom(Stream.unwrap(SyncService.socketStatusStream), { initialValue: Option.none() })

  const remoteSyncStats = runtime.atom(Stream.unwrap(SyncService.remoteSyncStatsStream), {
    initialValue: Option.none(),
  })

  const localSyncStats = runtime.atom(Stream.unwrap(SyncService.localSyncStatsStream), {
    initialValue: { usedStorageSize: 0, lastSync: Option.none() },
  })

  const connectedDevices = runtime.atom(Stream.unwrap(SyncService.connectedDevicesStream))

  const publicKeys = runtime.atom(Stream.unwrap(SyncService.publicKeysStream))

  const deletePublicKey = runtime.fn((publicKey: string) =>
    Effect.flatMap(Identity.Identity, (identity) => identity.deletePublicKey(publicKey)),
  )

  const updatePublicKey = runtime.fn(({ publicKey, note }: { publicKey: string; note: string }) =>
    Effect.flatMap(Identity.Identity, (identity) => identity.updatePublicKey(publicKey, { note })),
  )

  return {
    pauseSync,
    resumeSync,
    syncEnabled,
    syncing,
    socketStatus,
    remoteSyncStats,
    localSyncStats,
    connectedDevices,
    publicKeys,
    deletePublicKey,
    updatePublicKey,
  }
})
