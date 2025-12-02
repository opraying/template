/**
 * EventLogRemote module provides functionality for remote event synchronization.
 * Handles WebSocket communication, message chunking, and encrypted event transfer.
 */

import * as Socket from '@effect/platform/Socket'
import type * as EventLog from '@xstack/event-log/EventLog'
import {
  closeCodeToReason,
  isErrorCode,
  type SocketCloseCode,
  SocketCloseCodes,
} from '@xstack/event-log/EventLogConfig'
import type * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogRemote from '@xstack/event-log/EventLogRemote'
import * as EventLogStatesWorker from '@xstack/event-log/EventLogStatesWorker'
import * as Identity from '@xstack/event-log/Identity'
import * as Cause from 'effect/Cause'
import * as DateTime from 'effect/DateTime'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberSet from 'effect/FiberSet'
import { constVoid, flow, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import * as Schedule from 'effect/Schedule'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'

/**
 * @internal
 */
let globalCloseCode: (typeof SocketCloseCodes)[keyof typeof SocketCloseCodes] | -1 = -1

/**
 * Creates a remote event log connection over a WebSocket.
 * Handles reconnection, message chunking, and event synchronization.
 */
export const fromSocket: () => Effect.Effect<
  void,
  never,
  | EventLog.EventLog
  | Scope.Scope
  | EventLogEncryption.EventLogEncryption
  | Identity.Identity
  | Socket.Socket
  | EventLogRemote.RemoteEventSources
  | EventLogStatesWorker.EventLogStates
> = Effect.fn(function* () {
  const socket = yield* Socket.Socket
  const fiberSet = yield* FiberSet.make<void, never>()
  const closedDeferredRef = yield* Ref.make(Option.none<Deferred.Deferred<void, Socket.SocketError>>())
  const socketOpenedLatch = yield* Ref.make(Option.none<Effect.Latch>())
  const socketSemaphore = yield* Effect.makeSemaphore(1)

  const { incoming, outgoing } = yield* EventLogRemote.RemoteEventSources
  const { remoteSyncFlag, socketStatus } = yield* EventLogStatesWorker.EventLogStates

  const close = Effect.flatMap(socket.writer, (write) =>
    write(new Socket.CloseEvent(SocketCloseCodes.NORMAL, 'client manual close')),
  )

  yield* EventLogRemote.init

  /**
   * Reusable effect for closing the connection and cleaning up resources.
   */
  const closeConnectionAndCleanup = Effect.flatMap(Ref.get(closedDeferredRef), (maybeDeferred) =>
    Option.match(maybeDeferred, {
      // If no deferred exists, nothing to clean up
      onNone: () => Effect.void,
      onSome: (deferred) =>
        // Attempt to send close frame
        // Wait for the socket fiber to exit (signaled by deferred)
        // Ensure ref is reset regardless of await outcome (success/timeout)
        // Ensure FiberSet is cleared
        // Add a timeout to prevent hanging
        // Ignore errors during cleanup (e.g., timeout)
        pipe(
          Effect.ignore(close),
          Effect.zipRight(Deferred.await(deferred)),
          Effect.zipRight(Ref.set(closedDeferredRef, Option.none())),
          Effect.ensuring(FiberSet.clear(fiberSet)),
          Effect.timeout(1500),
          Effect.ignore,
        ),
    }),
  )

  const write = yield* socket.writer

  yield* outgoing.listen((data) =>
    socketOpenedLatch.get.pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (latch) =>
            latch.whenOpen(
              EventLogRemote.batchWrite(data, (bytes) => write(bytes)).pipe(
                Effect.catchAllCause((cause) =>
                  Effect.logError('write socket message failure').pipe(
                    Effect.annotateLogs({ cause: Cause.pretty(cause) }),
                  ),
                ),
              ),
            ),
        }),
      ),
    ),
  )

  /**
   * 监听远程同步开关变化，当开启时进行 ws 连接
   */
  yield* pipe(
    remoteSyncFlag.enabled,
    Stream.changes,
    Stream.mapEffect((opened) =>
      Effect.gen(function* () {
        if (opened) {
          yield* socketStatus.setConnecting()

          yield* closeConnectionAndCleanup

          yield* Ref.update(socketOpenedLatch, (openedLatch) => {
            Option.match(openedLatch, {
              onNone: constVoid,
              onSome: (latch) => latch.unsafeClose(),
            })
            return Option.none()
          })

          const closedDeferred = yield* Deferred.make<void, Socket.SocketError>()
          yield* Ref.set(closedDeferredRef, Option.some(closedDeferred))

          const latch = yield* Option.match(yield* socketOpenedLatch.get, {
            onNone: () =>
              Effect.gen(function* () {
                const latch = yield* Effect.makeLatch(false)
                yield* Ref.set(socketOpenedLatch, Option.some(latch))
                return latch
              }),
            onSome: Effect.succeed,
          })

          yield* Deferred.await(closedDeferred).pipe(
            Effect.exit,
            Effect.tap((exit) =>
              Effect.gen(function* () {
                if (Exit.isInterrupted(exit)) return

                if (Exit.isFailure(exit)) {
                  const prettyError = Cause.pretty(exit.cause)

                  yield* Effect.logError(prettyError)

                  yield* socketStatus.setError(prettyError)
                }

                yield* socketStatus.setDisconnected(closeCodeToReason(globalCloseCode))
              }),
            ),
            FiberSet.run(fiberSet),
          )

          const openDelayFiber = yield* Effect.fork(Effect.sleep('600 millis'))

          yield* pipe(
            socket.run((data) =>
              pipe(
                Effect.forkScoped(
                  Effect.all([latch.open, openDelayFiber.await]).pipe(Effect.zipRight(socketStatus.setConnected())),
                ),
                Effect.zipRight(incoming.publish([EventLogRemote.decodeResponse(data), data])),
              ),
            ),
            Effect.retry({
              while: Effect.fn('socketConnect.retryWhile')(function* () {
                const enabled = yield* remoteSyncFlag.get.pipe(
                  Effect.map(
                    flow(
                      Option.map((_) => _.enabled),
                      Option.getOrElse(() => false),
                    ),
                  ),
                )

                return enabled
              }),
              schedule: pipe(
                Schedule.union(Schedule.spaced('15 seconds'), Schedule.exponential('200 millis')),
                Schedule.jittered,
                Schedule.delays,
                Schedule.tapOutput(
                  Effect.fn(function* (delayDuration) {
                    const now = yield* DateTime.now
                    const nextRetry = DateTime.addDuration(now, delayDuration)
                    yield* socketStatus.setReconnecting(DateTime.toDate(nextRetry))
                  }),
                ),
              ),
            }),
            Effect.exit,
            Effect.tap((exit) =>
              closedDeferredRef.get.pipe(
                Effect.flatMap((_) =>
                  Option.match(_, {
                    onNone: () => Effect.void,
                    onSome: (deferred) => Deferred.done(deferred, exit),
                  }),
                ),
              ),
            ),
            FiberSet.run(fiberSet),
          )

          return
        }

        yield* closeConnectionAndCleanup
        yield* socketStatus.setDisconnected(closeCodeToReason(SocketCloseCodes.NORMAL))
      }).pipe(socketSemaphore.withPermits(1)),
    ),
    Stream.runDrain,
    Effect.onInterrupt(() => FiberSet.clear(fiberSet)),
    Effect.forkScoped,
    Effect.catchAllCause((cause) => {
      if (Cause.isInterruptedOnly(cause)) {
        return Effect.void
      }
      const prettyError = Cause.pretty(cause)
      return Effect.zipRight(socketStatus.setError(prettyError), Effect.logError(cause))
    }),
  )
})

/**
 * @since 1.0.0
 * @category constructors
 */
export const fromWebSocket: (
  url: Effect.Effect<
    string | Stream.Stream<Option.Option<string>, never, never>,
    never,
    Scope.Scope | Identity.Identity
  >,
) => Effect.Effect<
  void,
  never,
  | EventLog.EventLog
  | Scope.Scope
  | EventLogEncryption.EventLogEncryption
  | Identity.Identity
  | EventLogRemote.RemoteEventSources
  | EventLogStatesWorker.EventLogStates
  | Socket.WebSocketConstructor
> = Effect.fn(function* (
  url: Effect.Effect<string | Stream.Stream<Option.Option<string>>, never, Scope.Scope | Identity.Identity>,
) {
  const scope = yield* Effect.scope
  const scopeRef = yield* Ref.make<Option.Option<Scope.CloseableScope>>(Option.none())
  const closeSocketScope = scopeRef.get.pipe(
    Effect.flatMap(Option.match({ onNone: () => Effect.void, onSome: (scope) => Scope.close(scope, Exit.void) })),
  )
  const createSocketScope = Scope.fork(scope, scope.strategy).pipe(Effect.tap((_) => Ref.set(scopeRef, Option.some(_))))
  const identity = yield* Identity.Identity

  yield* pipe(
    url,
    Effect.map((_) => (typeof _ === 'string' ? Stream.make(Option.fromNullable(_)) : _)),
    Stream.unwrap,
    Stream.changes,
    Stream.tap(
      Option.match({
        onNone: () => closeSocketScope,
        onSome: (url) =>
          pipe(
            closeSocketScope,
            Effect.zipRight(createSocketScope),
            Effect.flatMap((scope) =>
              pipe(
                Socket.makeWebSocket(url, {
                  closeCodeIsError: (code) => {
                    const isAllowError = isErrorCode.includes(code)

                    if (isAllowError) {
                      globalCloseCode = code as SocketCloseCode
                    }

                    return !isAllowError
                  },
                }),
                Effect.flatMap((socket) => fromSocket().pipe(Effect.provideService(Socket.Socket, socket))),
                Effect.provideService(Scope.Scope, scope),
              ),
            ),
          ),
      }),
    ),
    Stream.provideService(Identity.Identity, identity),
    Stream.runDrain,
    Effect.interruptible,
    Effect.forkScoped,
    Effect.asVoid,
  )
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocket: (
  url: Effect.Effect<string | Stream.Stream<Option.Option<string>>, never, Scope.Scope | Identity.Identity>,
) => Layer.Layer<
  never,
  never,
  | EventLog.EventLog
  | EventLogEncryption.EventLogEncryption
  | Identity.Identity
  | EventLogRemote.RemoteEventSources
  | EventLogStatesWorker.EventLogStates
  | Socket.WebSocketConstructor
> = (url: Effect.Effect<string | Stream.Stream<Option.Option<string>>, never, Scope.Scope | Identity.Identity>) =>
  Layer.scopedDiscard(fromWebSocket(url))

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocketBrowser: (
  url: Effect.Effect<string | Stream.Stream<Option.Option<string>>, never, Scope.Scope | Identity.Identity>,
) => Layer.Layer<
  never,
  never,
  EventLog.EventLog | EventLogEncryption.EventLogEncryption | Identity.Identity | EventLogStatesWorker.EventLogStates
> = (url: Effect.Effect<string | Stream.Stream<Option.Option<string>>, never, Scope.Scope | Identity.Identity>) =>
  layerWebSocket(url).pipe(
    Layer.provide([Socket.layerWebSocketConstructorGlobal, EventLogRemote.RemoteEventSources.Default]),
  )
