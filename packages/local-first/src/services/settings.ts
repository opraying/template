import { Reactivity } from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import type { AtomRuntime } from '@effect-atom/atom/Atom'
import { SettingsEvents, table } from '@xstack/event-log/DefaultEvents/Settings'
import type { EventLog } from '@xstack/event-log/EventLog'
import type { FormSubmitData, ReactiveServiceBinding } from '@xstack/form/use-schema-form'
import type * as Settings from '@xstack/local-first/settings'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'
import * as R from 'remeda'

const SettingItemUnknownSchema = Schema.Struct({
  name: Schema.String,
  json: Schema.parseJson(Schema.Struct({ value: Schema.Unknown })),
})
const SettingItemsSchema = Schema.Array(SettingItemUnknownSchema)
const settingItemsDecode = Schema.decodeUnknown(SettingItemsSchema)
const settingItemsEncode = Schema.encodeUnknown(SettingItemsSchema)

const LOG_SPAN = '@app-kit/settings'

export { SettingsEvents, table }

/**
 * Synchronizes settings with the database and provides operations to get and set values
 * @param settings - The settings schema
 * @param handler - Optional handlers for get and set operations
 * @returns An object with settings, get, and set operations
 */
export const sync = <S extends Settings.Settings.Any, E = never, R = never>(
  label: string,
  settings: S,
  handler: {
    get?: Effect.Effect<Partial<Settings.Settings.Success<S>>, E, R | Settings.Settings.Context<S>>
    set?: (_: FormSubmitData<Settings.Settings.Success<S>>) => Effect.Effect<void, never>
  } = {},
): Effect.Effect<SettingsActions<S, never>, never, EventLog | Settings.Settings.Context<S>> =>
  Effect.gen(function* () {
    const context = yield* Effect.context<Settings.Settings.Context<S>>()
    const settingsEvents = yield* SettingsEvents

    const get = Effect.gen(function* () {
      const empty = {} as Partial<Settings.Settings.Success<S>>

      const defaultValues = settings.defaults as Effect.Effect<
        Settings.Settings.Success<S>,
        Settings.Settings.Error<S>,
        Settings.Settings.Context<S>
      >

      const getDefaultValues = pipe(
        defaultValues,
        Effect.orElseSucceed(() => empty),
      )
      const getLocalValues = pipe(
        load(settings),
        Effect.orElseSucceed(() => empty),
      )
      const getUserValues = handler.get
        ? pipe(
            handler.get,
            Effect.orElseSucceed(() => empty),
          )
        : Effect.succeed(empty)

      const [v1, v2, v3] = yield* Effect.all([getDefaultValues, getLocalValues, getUserValues], {
        concurrency: 'unbounded',
      }).pipe(Effect.tapErrorCause(Effect.logError))

      const values: Settings.Settings.Success<S> = R.mergeDeep(
        R.mergeDeep(v1, v2),
        v3,
      ) as unknown as Settings.Settings.Success<S>

      return values
    }).pipe(
      Effect.provide(context),
      Effect.tapErrorCause(Effect.logError),
      Effect.withLogSpan(LOG_SPAN),
      Effect.withSpan(`${LOG_SPAN}.${label}.get`),
    )

    const set = (data: FormSubmitData<Settings.Settings.Success<S>>) =>
      Effect.gen(function* () {
        if (handler.set) {
          yield* handler.set(data).pipe(Effect.catchAllCause(Effect.logError))
        }

        yield* Effect.logTrace('Settings changed').pipe(
          Effect.annotateLogs({
            values: Object.entries(data.changed).map((_) => _.at(0)),
          }),
        )

        // create event log, only if there are changes
        yield* Effect.forEach(Object.entries(data.changed), ([key, value]) =>
          settingsEvents('SettingChange', {
            name: key,
            json: JSON.stringify({ value }),
          }),
        )
      }).pipe(
        Effect.provide(context),
        Effect.catchAllCause(Effect.logError),
        Effect.withLogSpan(LOG_SPAN),
        Effect.withSpan(`${LOG_SPAN}.${label}.set`),
      )

    return {
      settings,
      get,
      set,
    } as unknown as SettingsActions<S, never>
  })

export type SettingsActions<S extends Settings.Settings.Any, R> = Effect.Effect<{
  settings: S
  get: Effect.Effect<Settings.Settings.Success<S>, never, R>
  set: (_: FormSubmitData<Settings.Settings.Success<S>>) => Effect.Effect<void, never, R>
}>

/**
 * Creates a reactive binding for settings that can be used in React components
 * Provides read, write, and stream operations for reactive data flow
 *
 * @param runtime - The AtomRuntime instance
 * @param actions - Effect containing settings operations
 * @returns A ReactiveServiceBinding with read, write, and stream operations
 */
export const createAtomBinding = <R, S extends Settings.Settings.Any>(
  runtime: AtomRuntime<R | Reactivity, never>,
  actions: SettingsActions<S, R>,
): ReactiveServiceBinding<Settings.Settings.Success<S>, Settings.Settings.Context<S>> => {
  const read = runtime.atom(Effect.flatMap(actions, (_) => _.get))

  const write = runtime.fn((args: FormSubmitData<Settings.Settings.Success<S>>) =>
    Effect.flatMap(actions, (_) => _.set(args)),
  )

  const stream = (onUpdate: (result: Settings.Settings.Success<S>) => boolean) =>
    runtime.atom((ctx) =>
      Effect.gen(function* () {
        const { settings, get } = yield* actions
        const reactivity = yield* Reactivity
        const keys = settings.keys

        const reactivityKeys = {
          [table]: keys,
        }

        let first = true

        return pipe(
          reactivity.stream(
            reactivityKeys,
            Effect.suspend(() => {
              // skip first time
              if (first) {
                first = false
                return Effect.void as unknown as Effect.Effect<Settings.Settings.Success<S>, never, R>
              }

              return get
            }),
          ),
          Stream.filter(Boolean),
          Stream.map((_) => onUpdate(_)),
          Stream.filter(Boolean),
          Stream.tap(() => Effect.sync(() => ctx.refresh(read))),
          Stream.catchAllCause(Effect.logError),
        )
      }).pipe(Stream.unwrap),
    )

  return {
    read,
    stream,
    write,
  }
}

/**
 * Loads settings from the database
 * @param settings - The settings schema
 * @returns A partial object with loaded settings
 */
export const load = <S extends Settings.Settings.Any>(settings: S) =>
  Effect.gen(function* () {
    const keys = settings.keys
    const sql = yield* SqlClient.SqlClient

    const rows = yield* sql`SELECT name, json FROM ${sql(table)} WHERE ${sql.in('name', keys)}`.pipe(
      Effect.tap(Effect.logTrace('Settings loaded from database')),
      Effect.annotateLogs({ operation: 'loadSettings', keys }),
      Effect.orDie,
    )

    const results = yield* settingItemsDecode(rows).pipe(
      Effect.map((items) => items.map((item) => [item.name, item.json.value])),
    )

    return Object.fromEntries(results) as Partial<Settings.Settings.Success<S>>
  })

/**
 * Saves settings to the database
 * @param settings - The settings schema
 * @param values - The values to save
 * @returns An Effect that completes when the save operation is done
 */
export const save = Effect.fn(function* <S extends Settings.Settings.Any>(
  settings: S,
  values: Partial<Settings.Settings.Success<S>>,
) {
  const sql = yield* SqlClient.SqlClient
  const keys = settings.keys

  // Prepare batch insert data
  const entries = Object.entries(values)
    .filter(([key]) => keys.includes(key))
    .map(([key, value]) => ({
      name: key,
      json: { value },
    }))

  if (entries.length === 0) {
    return
  }

  const encoded = yield* settingItemsEncode(entries)

  yield* Effect.logTrace('Saving settings to database').pipe(Effect.annotateLogs({ encoded }))

  return yield* Effect.forEach(
    encoded,
    (entry) =>
      sql`INSERT INTO ${sql(table)} ${sql.insert(entry)} ON CONFLICT (name) DO UPDATE SET json = ${entry.json}`.pipe(
        Effect.catchAllCause(Effect.logError),
      ),
    {
      discard: true,
    },
  )
})

/**
 * Creates a stream of settings changes
 * @param settings - The settings schema
 * @returns A stream that emits when settings change
 */
export const stream = <S extends Settings.Settings.Any>(settings: S) =>
  Effect.gen(function* () {
    const reactivity = yield* Reactivity
    const keys = settings.keys

    const reactivityKeys = {
      [table]: keys,
    }

    return reactivity.stream(reactivityKeys, load(settings))
  }).pipe(Stream.unwrap)

/**
 * Uses a single setting
 * @param setting - The setting to use
 * @returns An Effect that resolves to the setting value
 */
export const use = <S extends Settings.Setting.Any>(_setting: S) => Effect.gen(function* () {})

/**
 * Sets a single setting value
 * @param setting - The setting to set
 * @param value - The value to set
 * @returns An Effect that completes when the set operation is done
 */
export const set = <S extends Settings.Setting.Any>(_setting: S, _value: unknown) => Effect.gen(function* () {})

/**
 * Creates a stream for a single setting
 * @param setting - The setting to stream
 * @returns A stream that emits when the setting changes
 */
export const useStream = <S extends Settings.Setting.Any>(_setting: S) => Effect.gen(function* () {})
