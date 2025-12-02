import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogStates from '@xstack/event-log/EventLogStatesWorker'
import * as Identity from '@xstack/event-log/Identity'
import type * as EventLogSchema from '@xstack/event-log/Schema'
import * as WorkerRunner from '@xstack/fx/worker/runner'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'

export const workerHandles = () =>
  WorkerRunner.handler<EventLogSchema.LocalFirstEvent>((scope) => ({
    EventLogWriteRequest: Effect.fn(
      function* (execute) {
        const eventLog = yield* EventLog.EventLog
        return yield* eventLog.write({
          schema: null,
          event: execute.event,
          payload: execute.payload,
        } as any)
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    EventLogEntriesRequest: Effect.fn(
      function* () {
        const eventLog = yield* EventLog.EventLog
        return yield* eventLog.entries
      },
      Effect.provideService(Scope.Scope, scope),
    ),

    // ----- Identity -----

    GetMnemonicEvent: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        return yield* identity.mnemonic
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    ParseMnemonicEvent: Effect.fn(
      function* (execute) {
        const identity = yield* Identity.Identity
        return yield* identity.parseMnemonic(execute.mnemonic)
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    RandomMnemonicEvent: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        return yield* identity.randomMnemonic()
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    ImportFromMnemonicEvent: Effect.fn(
      function* (execute) {
        const identity = yield* Identity.Identity
        return yield* identity.importFromMnemonic(execute.mnemonic, execute.data)
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    CreateMnemonicEvent: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        return yield* identity.createMnemonic()
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    GetIdentityEvent: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        const publicKey = yield* identity.publicKey
        const privateKey = yield* identity.privateKey
        return Option.some({ publicKey, privateKey })
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    ClearEvent: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        return yield* identity.clear
      },
      Effect.provideService(Scope.Scope, scope),
    ),

    // ----- Public Key -----

    PublicKeyStream: () =>
      Effect.gen(function* () {
        const identity = yield* Identity.Identity
        return identity.publicKeyStream
      }).pipe(Stream.unwrap, Stream.provideService(Scope.Scope, scope)),
    SyncPublicKeys: Effect.fn(
      function* () {
        const identity = yield* Identity.Identity
        return yield* identity.syncPublicKeys
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    SyncPublicKey: Effect.fn(
      function* (execute) {
        const identity = yield* Identity.Identity
        return yield* identity.syncPublicKey(execute.publicKey)
      },
      Effect.provideService(Scope.Scope, scope),
    ),
    GetAllPublicKeyStream: () =>
      pipe(
        Effect.gen(function* () {
          const identity = yield* Identity.Identity
          return identity.allPublicKeysStream
        }),
        Stream.unwrap,
        Stream.provideService(Scope.Scope, scope),
      ),
    UpsertPublicKey: Effect.fn(function* (execute) {
      const identity = yield* Identity.Identity
      return yield* identity.upsertPublicKey(execute.publicKey, execute.data)
    }),
    UpdatePublicKey: Effect.fn(function* (execute) {
      const identity = yield* Identity.Identity

      return yield* identity.updatePublicKey(execute.publicKey, execute.data)
    }),
    DeletePublicKey: Effect.fn(function* (execute) {
      const identity = yield* Identity.Identity
      return yield* identity.deletePublicKey(execute.publicKey)
    }),

    // -----

    EventLogEventStreamEvent: () =>
      pipe(
        Effect.gen(function* () {
          const eventLogStates = yield* EventLogStates.EventLogStates
          return eventLogStates.events.toStream<EventLogSchema.SyncEvents>('sync-event')
        }),
        Stream.unwrap,
        Stream.provideService(Scope.Scope, scope),
      ),
  }))
