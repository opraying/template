import * as Identity from '@xstack/event-log/Identity'
import * as EventLogWorkerPool from '@xstack/event-log/Pool'
import * as EventLogSchema from '@xstack/event-log/Schema'
import * as Types from '@xstack/event-log/Types'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import type * as Redacted from 'effect/Redacted'
import * as Stream from 'effect/Stream'

const SPAN_ID = 'EventLogIdentity'

export * from '@xstack/event-log/Identity'

export const layer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const worker = yield* EventLogWorkerPool.WorkerPool

    const identity = Identity.Identity.of({
      // ----- Mnemonic ----

      mnemonic: worker
        .executeEffect(new EventLogSchema.GetMnemonicEvent())
        .pipe(Effect.orDie, Effect.withSpan(`${SPAN_ID}.mnemonic`)),
      randomMnemonic: Effect.fn(`${SPAN_ID}.randomMnemonic`)(function* () {
        return yield* worker.executeEffect(new EventLogSchema.RandomMnemonicEvent()).pipe(Effect.orDie)
      }),
      parseMnemonic: Effect.fn(`${SPAN_ID}.parseMnemonic`)(function* (
        mnemonic: Redacted.Redacted<Types.Mnemonic | string>,
      ) {
        return yield* worker.executeEffect(new EventLogSchema.ParseMnemonicEvent({ mnemonic })).pipe(
          Effect.catchTags({
            ParseError: Effect.die,
            WorkerError: Effect.die,
          }),
        )
      }),
      importFromMnemonic: Effect.fn(`${SPAN_ID}.importFromMnemonic`)(function* (
        mnemonic: Redacted.Redacted<Types.Mnemonic | string>,
        data?: { note: string } | undefined,
      ) {
        return yield* worker.executeEffect(new EventLogSchema.ImportFromMnemonicEvent({ mnemonic, data })).pipe(
          Effect.catchTags({
            ParseError: Effect.die,
            WorkerError: Effect.die,
          }),
        )
      }),
      createMnemonic: Effect.fn(`${SPAN_ID}.createMnemonic`)(function* () {
        return yield* worker.executeEffect(new EventLogSchema.CreateMnemonicEvent()).pipe(Effect.orDie)
      }),
      publicKey: Effect.gen(function* () {
        const publicKey = yield* worker.executeEffect(new EventLogSchema.GetIdentityEvent()).pipe(
          Effect.map(
            Option.match({
              onNone: () => Types.PublicKey.make(''),
              onSome: (pair) => pair.publicKey,
            }),
          ),
          Effect.orDie,
        )
        return publicKey
      }).pipe(Effect.withSpan(`${SPAN_ID}.publicKey`)),
      privateKey: Effect.gen(function* () {
        const privateKey = yield* worker.executeEffect(new EventLogSchema.GetIdentityEvent()).pipe(
          Effect.map(
            Option.match({
              onNone: () => Types.PrivateKey.make(new Uint8Array()),
              onSome: (pair) => pair.privateKey,
            }),
          ),
          Effect.orDie,
        )

        return privateKey
      }).pipe(Effect.withSpan(`${SPAN_ID}.privateKey`)),
      clear: worker
        .executeEffect(new EventLogSchema.ClearEvent())
        .pipe(Effect.orDie, Effect.withSpan(`${SPAN_ID}.clear`)),

      // ----- Public key -----

      publicKeyStream: Effect.gen(function* () {
        return worker.execute(new EventLogSchema.PublicKeyStream()).pipe(Stream.orDie)
      }).pipe(Stream.unwrap),
      syncPublicKeys: worker.executeEffect(new EventLogSchema.SyncPublicKeys()).pipe(Effect.orDie),
      syncPublicKey: Effect.fn(`${SPAN_ID}.syncPublicKey`)(function* (publicKey: string) {
        return yield* worker.executeEffect(new EventLogSchema.SyncPublicKey({ publicKey })).pipe(Effect.orDie)
      }),
      upsertPublicKey: Effect.fn(`${SPAN_ID}.upsertPublicKey`)(function* (
        publicKey: string,
        data: Identity.StoragePublicKeyUpdateItem,
      ) {
        return yield* worker.executeEffect(new EventLogSchema.UpsertPublicKey({ publicKey, data })).pipe(Effect.orDie)
      }),
      updatePublicKey: Effect.fn(`${SPAN_ID}.updatePublicKey`)(function* (publicKey: string, data: { note: string }) {
        return yield* worker.executeEffect(new EventLogSchema.UpdatePublicKey({ publicKey, data })).pipe(Effect.orDie)
      }),
      deletePublicKey: Effect.fn(`${SPAN_ID}.deletePublicKey`)(function* (publicKey: string) {
        return yield* worker.executeEffect(new EventLogSchema.DeletePublicKey({ publicKey })).pipe(Effect.orDie)
      }),
      allPublicKeysStream: Effect.gen(function* () {
        return worker.execute(new EventLogSchema.GetAllPublicKeyStream()).pipe(Stream.orDie)
      }).pipe(Stream.unwrap),
    })

    return Layer.succeed(Identity.Identity, identity)
  }),
)
