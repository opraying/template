import * as HttpApiError from '@effect/platform/HttpApiError'
import * as HttpBody from '@effect/platform/HttpBody'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientError from '@effect/platform/HttpClientError'
import type * as HttpClientRequest from '@effect/platform/HttpClientRequest'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as secp256k1 from '@noble/secp256k1'
import * as Bip39 from '@xstack/event-log/Bip39'
import * as Crypto from '@xstack/event-log/Crypto'
import { InvalidMnemonicError } from '@xstack/event-log/Error'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import type { StoragePublicKeyUpdateItem } from '@xstack/event-log/Identity'
import * as Identity_ from '@xstack/event-log/Identity'
import * as IdentityStorage from '@xstack/event-log/IdentityStorage'
import * as EventLogSchema from '@xstack/event-log/Schema'
import * as Types from '@xstack/event-log/Types'
import * as Utils from '@xstack/event-log/Utils'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as SubscriptionRef from 'effect/SubscriptionRef'

const SPAN_ID = 'EventLogIdentity'

export * from '@xstack/event-log/Identity'

const make = Effect.gen(function* () {
  const config = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
  const crypto = yield* Crypto.Crypto
  const bip39 = yield* Bip39.Bip39
  const storage = yield* IdentityStorage.IdentityStorage

  const randomMnemonic = () => bip39.generateMnemonic().pipe(Effect.map(Redacted.make))

  const takeIdentityLatch = yield* Effect.makeLatch(false)

  const getStorageMnemonic = Effect.gen(function* (_) {
    const stored = yield* storage.getMnemonic

    if (stored) {
      yield* Effect.logTrace('Found mnemonic in storage')
      return Option.some(Redacted.make(Types.Mnemonic.make(stored)))
    }

    yield* Effect.logTrace('No mnemonic found in storage')
    return Option.none<Redacted.Redacted<Types.Mnemonic>>()
  })
  const mnemonicRef = yield* SubscriptionRef.make<Option.Option<Redacted.Redacted<Types.Mnemonic>>>(
    yield* getStorageMnemonic,
  )
  const masterKeyPairRef = yield* SubscriptionRef.make<Option.Option<Types.KeyPair>>(Option.none())
  const masterKeyPairGet = takeIdentityLatch.whenOpen(masterKeyPairRef.get)
  const publicKeysCountRef = yield* SubscriptionRef.make(0)
  const invalidatePublicKeys = SubscriptionRef.update(publicKeysCountRef, (_) => _ + 1)

  const client = yield* HttpClient.HttpClient

  const unexpectedStatus = (
    request: HttpClientRequest.HttpClientRequest,
    response: HttpClientResponse.HttpClientResponse,
  ) =>
    Effect.flatMap(
      Effect.all([
        Effect.orElseSucceed(response.text, () => 'Unexpected status code'),
        Effect.orElseSucceed(Schema.decodeUnknown(Schema.Struct({ message: Schema.String }))(response.json), () => {}),
      ]),
      ([description, json]) =>
        Effect.fail(
          new HttpClientError.ResponseError({
            request,
            response,
            reason: 'StatusCode',
            description: json ? json.message : description,
            cause: json ? json.message : undefined,
          }),
        ),
    )

  const persistMnemonic = Effect.fn(`${SPAN_ID}.persistMnemonic`)(function* (
    mnemonic: Option.Option<Redacted.Redacted<Types.Mnemonic>>,
  ) {
    yield* Effect.logTrace('Persisting mnemonic')

    if (Option.isNone(mnemonic)) {
      yield* Effect.logTrace('Deleting mnemonic from storage')
      yield* storage.deleteMnemonic
    } else {
      yield* Effect.logTrace('Setting mnemonic in storage')
      yield* storage.setMnemonic(Redacted.value(mnemonic.value))
    }
  }, Effect.withSpan('persistMnemonic'))

  const parseMnemonic = Effect.fn(`${SPAN_ID}.parseMnemonic`)(function* (
    mnemonic: Redacted.Redacted<Types.Mnemonic | string>,
  ) {
    const mnemonicTrimmed = Redacted.value(mnemonic).trim()

    const isValid = yield* bip39.validateMnemonic(mnemonicTrimmed)
    if (!isValid) {
      return yield* new InvalidMnemonicError({
        message: 'Invalid mnemonic',
        cause: new Error('Invalid mnemonic'),
      })
    }

    return Types.Mnemonic.make(mnemonicTrimmed)
  })

  const slip21DeriveAsync = Effect.fn(`${SPAN_ID}.slip21DeriveAsync`)(function* (
    seed: Uint8Array<ArrayBufferLike>,
    path: ReadonlyArray<string>,
  ) {
    let m = yield* crypto.hmacSha512('Symmetric key seed', seed)
    for (let i = 0; i < path.length; i++) {
      const p = new TextEncoder().encode(path[i])
      const e = new Uint8Array(p.byteLength + 1)
      e[0] = 0
      e.set(p, 1)
      m = yield* crypto.hmacSha512(m.slice(0, 32), e)
    }
    return m.slice(32, 64)
  })

  const generateMasterKeyPair = Effect.fn(`${SPAN_ID}.generateMasterKeyPair`)(function* (
    mnemonic: Redacted.Redacted<Types.Mnemonic>,
  ) {
    yield* Effect.logTrace('Generating master key pair from mnemonic')

    const seed = yield* bip39.mnemonicToSeed(Redacted.value(mnemonic))
    const hmacResult = yield* crypto.hmacSha256(config.masterKeySalt, seed)
    const privateKeyBuffer = yield* slip21DeriveAsync(hmacResult, config.masterKeyPrivateKeyDerivationPath)
    const publicKeyBytes = secp256k1.getPublicKey(privateKeyBuffer, true)
    const keyPair = Types.KeyPair.make({
      publicKey: Types.PublicKey.make(Utils.arrayBufferToBase64(publicKeyBytes)),
      privateKey: Types.PrivateKey.make(privateKeyBuffer),
    })

    yield* SubscriptionRef.set(masterKeyPairRef, Option.some(keyPair))

    yield* takeIdentityLatch.open

    return keyPair
  })

  const importFromMnemonic = Effect.fn(`${SPAN_ID}.importFromMnemonic`)(function* (
    mnemonic: Redacted.Redacted<Types.Mnemonic | string>,
    data?: { note: string } | undefined,
  ) {
    yield* Effect.logTrace('Importing from mnemonic')

    const validMnemonic = yield* parseMnemonic(mnemonic).pipe(Effect.map(Redacted.make))

    const publicKey = yield* generateMasterKeyPair(validMnemonic).pipe(
      Effect.flatMap((_) => crypto.sha256String(_.publicKey)),
    )

    const now = yield* DateTime.now
    const defaultNote = data?.note || DateTime.formatIso(now)

    yield* SubscriptionRef.set(mnemonicRef, Option.some(validMnemonic))
    yield* persistMnemonic(Option.some(validMnemonic))

    // Insert locally first, then a request will be initiated later to get the latest stats.
    yield* upsertPublicKey(publicKey, { note: defaultNote })

    yield* syncPublicKeys
  })

  const createMnemonic = Effect.fn(`${SPAN_ID}.createMnemonic`)(function* () {
    yield* Effect.logTrace('Generated new mnemonic')

    const mnemonic = yield* randomMnemonic()

    yield* importFromMnemonic(mnemonic).pipe(Effect.orDie)
  })

  const publicKey = masterKeyPairGet.pipe(
    Effect.map(
      Option.match({
        onNone: () => Types.PublicKey.make(''),
        onSome: (pair) => pair.publicKey,
      }),
    ),
    Effect.withSpan(`${SPAN_ID}.publicKey`),
  )

  const privateKey = masterKeyPairGet.pipe(
    Effect.map(
      Option.match({
        onNone: () => Types.PrivateKey.make(new Uint8Array()),
        onSome: (pair) => pair.privateKey,
      }),
    ),
    Effect.withSpan(`${SPAN_ID}.privateKey`),
  )

  const clear = Effect.gen(function* () {
    yield* Effect.logTrace('Clearing identity data')

    yield* takeIdentityLatch.close

    yield* storage.clearPublicKeys()

    yield* createMnemonic()
  }).pipe(Effect.withSpan(`${SPAN_ID}.clear`))

  const publicKeyStream = masterKeyPairRef.changes.pipe(
    Stream.tap(() => takeIdentityLatch.await),
    Stream.mapEffect(
      Option.match({
        onNone: () => Effect.succeed(''),
        onSome: (pair) => crypto.sha256String(pair.publicKey),
      }),
    ),
  )

  const syncPublicKeys = Effect.gen(function* () {
    const url = `${config.syncUrl}/api/register`

    yield* Effect.logTrace('Starting public keys sync')

    const localPublicKeys = yield* storage.getAllPublicKeys()

    yield* pipe(
      client.put(url, {
        urlParams: {
          q: btoa(config.namespace),
        },
        body: HttpBody.unsafeJson({
          items: localPublicKeys.map((_) => {
            return {
              publicKey: _.publicKey,
              note: _.note,
              createdAt: _.createdAt,
              updatedAt: _.updatedAt,
            }
          }),
        }),
      }),
      Effect.flatMap(
        HttpClientResponse.matchStatus({
          '2xx': (response) =>
            HttpClientResponse.schemaBodyJson(Schema.Array(EventLogSchema.RemotePublicKeyItem))(response),
          401: () => Effect.fail(new HttpApiError.Unauthorized()),
          orElse: (response) => unexpectedStatus(response.request, response),
        }),
      ),
      Effect.flatMap((remotePublicKeys) =>
        storage.importPublicKeys(remotePublicKeys).pipe(
          Effect.zipRight(invalidatePublicKeys),
          Effect.tap(
            Effect.logTrace('Public keys sync successful').pipe(
              Effect.annotateLogs({
                'sync.public-keys.count': remotePublicKeys.length,
              }),
            ),
          ),
          Effect.as(remotePublicKeys),
        ),
      ),
      Effect.catchTags({
        Unauthorized: () => Effect.logWarning('public keys sync failed, unauthorized'),
        ParseError: Effect.die,
        ResponseError: (res) =>
          Effect.logError('public keys sync failed, response error').pipe(
            Effect.annotateLogs({
              message: res.message,
            }),
          ),
        RequestError: (res) =>
          Effect.logError('public keys sync failed, request error').pipe(
            Effect.annotateLogs({
              message: res.message,
            }),
          ),
      }),
    )
  }).pipe(Effect.withSpan(`${SPAN_ID}.syncPublicKeys`))

  const syncPublicKey = Effect.fn(`${SPAN_ID}.syncPublicKey`)(function* (publicKey: string) {
    const query = btoa(`${config.namespace}:${publicKey}`)
    const syncStatsUrl = `${config.syncUrl}/api/stats`

    const stats = yield* pipe(
      client.get(syncStatsUrl, { urlParams: { q: query } }),
      Effect.flatMap(
        HttpClientResponse.matchStatus({
          '2xx': (response) => HttpClientResponse.schemaBodyJson(EventLogSchema.RemotePublicKeySyncStats)(response),
          401: () => Effect.fail(new HttpApiError.Unauthorized()),
          orElse: (response) => unexpectedStatus(response.request, response),
        }),
      ),
      Effect.asSome,
      Effect.tapErrorTag('Unauthorized', () => Effect.logWarning('sync public key failed, unauthorized')),
      Effect.catchTag('ParseError', Effect.die),
      Effect.orElseSucceed(() => Option.none<typeof EventLogSchema.RemotePublicKeySyncStats.Type>()),
    )

    return stats
  })

  const deletePublicKey = Effect.fn(`${SPAN_ID}.deletePublicKey`)(function* (publicKey: string) {
    const query = btoa(`${config.namespace}:${publicKey}`)
    const url = `${config.syncUrl}/api/destroy`

    yield* Effect.logTrace('Deleting public key', { publicKey })

    const publicKeys = yield* storage.getAllPublicKeys()
    const deleted = publicKeys.find((_) => _.publicKey === publicKey)

    if (!deleted) {
      yield* Effect.logTrace('Public key not found', { publicKey })
      return
    }

    yield* storage.deletePublicKey(publicKey)

    if (deleted.synced) {
      yield* client
        .del(url, { urlParams: { q: query } })
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.ignoreLogged)
    }

    yield* invalidatePublicKeys
  })

  const upsertPublicKey = Effect.fn(`${SPAN_ID}.upsertPublicKey`)(function* (
    publicKey: string,
    data: StoragePublicKeyUpdateItem,
  ) {
    yield* Effect.logTrace('Updating public key locally').pipe(Effect.annotateLogs({ publicKey, data }))

    yield* storage.upsertPublicKey(publicKey, data).pipe(Effect.zipRight(invalidatePublicKeys))
  })

  const updatePublicKey = Effect.fn(`${SPAN_ID}.updatePublicKey`)(function* (
    publicKey: string,
    data: { note: string },
  ) {
    const query = btoa(`${config.namespace}:${publicKey}`)
    const url = `${config.syncUrl}/api/update`

    yield* Effect.logTrace('Updating public key ').pipe(Effect.annotateLogs({ publicKey, data }))

    yield* Effect.all(
      [
        upsertPublicKey(publicKey, data),
        client
          .patch(url, {
            urlParams: { q: query },
            body: HttpBody.unsafeJson(data),
          })
          .pipe(
            Effect.flatMap(
              HttpClientResponse.matchStatus({
                '2xx': () => Effect.void,
                401: () => Effect.logWarning('update public key failed, unauthorized'),
                orElse: (response) => unexpectedStatus(response.request, response),
              }),
            ),
            Effect.catchTags({
              ResponseError: (res) =>
                Effect.logError('update public key failed, response error').pipe(
                  Effect.annotateLogs({
                    message: res.message,
                  }),
                ),
              RequestError: (res) =>
                Effect.logError('update public key failed, request error').pipe(
                  Effect.annotateLogs({
                    message: res.message,
                  }),
                ),
            }),
          ),
      ],
      { discard: true, concurrency: 'unbounded' },
    )
  })

  const allPublicKeysStream = publicKeysCountRef.changes.pipe(Stream.mapEffect(() => storage.getAllPublicKeys()))

  yield* Option.match(yield* mnemonicRef.get, {
    onNone: () => Effect.void,
    onSome: Effect.fn(function* (redactedMnemonic) {
      yield* generateMasterKeyPair(redactedMnemonic)
      yield* syncPublicKeys
    }),
  }).pipe(Effect.forkScoped)

  return {
    // ----- Mnemonic -----

    mnemonic: mnemonicRef.get,
    randomMnemonic,
    parseMnemonic,
    importFromMnemonic,
    createMnemonic,
    publicKey,
    privateKey,
    clear,

    // ----- Public key -----

    publicKeyStream,
    syncPublicKeys,
    syncPublicKey,
    deletePublicKey,
    upsertPublicKey,
    updatePublicKey,
    allPublicKeysStream,
  } satisfies Identity_.Identity
}).pipe(Effect.withLogSpan('@event-log/identity'), Effect.withSpan('EventLogIdentity.init'))

export const Default = Layer.scoped(Identity_.Identity, make)
