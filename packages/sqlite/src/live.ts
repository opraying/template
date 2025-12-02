import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import type { Row } from '@effect/sql/SqlConnection'
import { Atom, ensureAtomInitialValues, RegistryContext } from '@xstack/atom-react'
import * as GlobalLayer from '@xstack/atom-react/global'
import type { CastArray } from '@xstack/fx/utils/types'
import type { SqlError } from '@xstack/sqlite/schema'
import { parseSql } from '@xstack/sqlite/sql-parser'
import type { DurationInput } from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { identity, type LazyArg, pipe } from 'effect/Function'
import { isFunction, isString } from 'effect/Predicate'
import * as Stream from 'effect/Stream'
import * as Tracer from 'effect/Tracer'
import { use, useEffect, useMemo, useState } from 'react'

/**
 * Configuration options for live queries
 */
export interface LiveQueryBaseOptions<T = any> {
  /** Transform the raw database rows into the desired type */
  transform?: <A>(rows: T[]) => A[]
  /** Default value to use when query fails or is loading */
  fallback?: T
  /** Custom error handler */
  onError?: (error: unknown) => void
  /** Debounce time in milliseconds for updates */
  debounce?: DurationInput
  /** Whether to log query execution and table dependencies */
  debug?: boolean
  onStart?: () => void
  onEnd?: () => void
  onDone?: () => void
}

/**
 * Options for live SQL queries
 */
export interface LiveSqlQueryOptions extends LiveQueryBaseOptions {
  /** Parameters for the SQL query */
  params?: ReadonlyArray<unknown>
}

/**
 * Options for live Effect queries
 */
export interface LiveEffectQueryOptions extends LiveQueryBaseOptions {}

/**
 * Options for creating live queries
 */
export type CreateQueryOptions =
  | { execute: LazyArg<string>; options?: LiveSqlQueryOptions }
  | {
      execute: Effect.Effect<readonly Row[], SqlError, SqlClient.SqlClient>
      options?: LiveEffectQueryOptions
    }

const QueryLayer = GlobalLayer.use('SqliteAtom', Tracer.Tracer, SqlClient.SqlClient, Reactivity.Reactivity)

export const queryRuntime = Atom.runtime(QueryLayer)

export const effectQuery = (createOptions: CreateQueryOptions) =>
  Effect.gen(function* () {
    const client = yield* SqlClient.SqlClient
    const reactivity = yield* Reactivity.Reactivity
    const reactivityKeys: Record<string, string[]> = {}

    let sqlString: string
    let effect: Effect.Effect<any, SqlError, never>
    const baseOptions = (createOptions.options ?? {}) as LiveQueryBaseOptions

    if (isFunction(createOptions.execute)) {
      const options = (createOptions.options ?? {}) as LiveSqlQueryOptions
      const query = createOptions.execute()
      if (isString(query)) {
        sqlString = query
        const sqlParseResult = parseSql(query)
        sqlParseResult.tables.forEach((i) => {
          reactivityKeys[i] = []
        })
        effect = client.unsafe(query, options.params).withoutTransform as any
      } else {
        effect = Effect.provideService(query as any, SqlClient.SqlClient, client) as any
      }
    } else {
      const query = createOptions.execute as any
      //  SqlClient

      effect = Effect.provideService(query, SqlClient.SqlClient, client) as any
    }

    const stream = pipe(
      reactivity.stream(
        reactivityKeys,
        Effect.withSpan(effect, 'liveQueryAtom', {
          attributes: {
            'query.reactivityKeys': JSON.stringify(reactivityKeys),
            'query.debounce': baseOptions.debounce ?? 'none',
          },
        }),
      ),
      baseOptions.debounce ? Stream.debounce(baseOptions.debounce) : identity,
      baseOptions.onStart ? Stream.onDone(() => Effect.ignore(Effect.try(() => baseOptions.onDone?.()))) : identity,
      baseOptions.onError
        ? Stream.onError((error) => Effect.ignore(Effect.try(() => baseOptions.onError?.(error))))
        : identity,
      baseOptions.onEnd ? Stream.onDone(() => Effect.ignore(Effect.try(() => baseOptions.onEnd?.()))) : identity,
      baseOptions.onDone ? Stream.onDone(() => Effect.ignore(Effect.try(() => baseOptions.onDone?.()))) : identity,
      baseOptions.debug
        ? Stream.tap((_) =>
            Effect.logInfo(`Query: ${sqlString}`).pipe(
              Effect.annotateLogs({
                ...baseOptions,
              }),
            ),
          )
        : identity,
      Stream.tapErrorCause(Effect.logError),
    )

    return stream
  }).pipe(Effect.tapErrorCause(Effect.logError), Stream.unwrap)

export const effectQueryAtom = Atom.family((_: any) => queryRuntime.fn(effectQuery))

export const createQueryHooks =
  <A extends Atom.Atom<any>>(inputAtom: A) =>
  <T>(sql: any, options: LiveQueryBaseOptions = {}) => {
    const registry = use(RegistryContext)
    const [results, setResults] = useState<T>(() => options.fallback ?? [])

    const atom = useMemo(() => inputAtom || effectQueryAtom(sql), [sql])

    useEffect(() => {
      if (options.fallback) {
        ensureAtomInitialValues(registry, options.fallback)
      }
      const unsubscribe = registry.subscribe(
        atom,
        (result) => {
          if (result.waiting) {
            // ignore waiting
          }

          if (result._tag === 'Initial') {
            // ignore initial value
          }

          if (result._tag === 'Success') {
            setResults(result.value)
          }
        },
        { immediate: true },
      )

      if (!inputAtom && Atom.isWritable(atom)) {
        registry.set(atom, { execute: sql, options })
      }

      return () => unsubscribe()
    }, [])

    return results
  }

/**
 * React hook for live Effect queries
 */
export const effectQueryHooks: <A>(
  effect: Effect.Effect<A, SqlError, SqlClient.SqlClient>,
) => (options?: LiveEffectQueryOptions) => CastArray<A> = (queryBuilder: any) => (options: any) =>
  createQueryHooks(null as any)(queryBuilder, options) as any
