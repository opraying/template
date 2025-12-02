import * as Client from '@effect/sql/SqlClient'
import { SqlError } from '@effect/sql/SqlError'
import { ATTR_DB_QUERY_TEXT } from '@opentelemetry/semantic-conventions/incubating'
import * as Effect from 'effect/Effect'
import * as Effectable from 'effect/Effectable'
import * as Either from 'effect/Either'
import * as Hash from 'effect/Hash'
import * as Option from 'effect/Option'
import { hasProperty } from 'effect/Predicate'
import type { Compilable } from 'kysely'

interface Executable extends Compilable {
  execute: () => Promise<ReadonlyArray<unknown>>
}

const COMMIT_ERROR = "Kysely instance not properly initialised: use 'make' to create an Effect compatible instance"

const PatchProto = {
  ...Effectable.CommitPrototype,
  commit() {
    return Effect.die(new Error(COMMIT_ERROR))
  },
}

/** @internal */
export const patch = (prototype: any) => {
  if (!(Effect.EffectTypeId in prototype)) {
    Object.assign(prototype, PatchProto)
  }
}

/**
 * Check whether a value should skip proxy wrapping
 * Mainly used for handling data types supported by SQLite and types in the Effect ecosystem.
 */
const hasPassProxy = (u: unknown) => {
  // - string, number, boolean, undefined
  // - null (even typeof null === 'object')
  if (typeof u !== 'object' || u === null) {
    return true
  }

  // Array directly returns
  // SQLite correctly handles array type parameters
  if (Array.isArray(u)) {
    return true
  }

  // Types in the Effect ecosystem, including:
  // - Effect (identified by _A property)
  // - Either (identified by TypeId)
  // - Option (identified by TypeId)
  // These types should remain unchanged and not be proxied
  if (hasProperty(u, '_A') || Either.TypeId in (u as any) || Option.TypeId in (u as any)) {
    return true
  }

  // SQLite natively supports the following types:
  // - Date: converted to ISO string
  // - Int8Array/Uint8Array: used for BLOB data
  // - ArrayBuffer/DataView: binary data support
  if (
    u instanceof Date ||
    u instanceof Int8Array ||
    u instanceof Uint8Array ||
    u instanceof ArrayBuffer ||
    u instanceof DataView
  ) {
    return true
  }

  // Handle plain objects (pure objects)
  // Conditions:
  // 1. The object's prototype must be Object.prototype (pure object)
  // 2. All property values must be of the supported types above
  if (Object.getPrototypeOf(u) === Object.prototype) {
    return Object.values(u).every(
      (v) =>
        v === null ||
        typeof v !== 'object' ||
        v instanceof Date ||
        v instanceof Int8Array ||
        v instanceof Uint8Array ||
        v instanceof ArrayBuffer ||
        v instanceof DataView ||
        (v && Either.TypeId in v) || // Support nested Either
        (v && Option.TypeId in v), // Support nested Option
    )
  }

  // All other cases require creating a proxy
  // Including:
  // - Instances of custom classes
  // - Objects containing unsupported types
  // - Other complex objects
  return false
}

/**
 * Create a proxy for an object, handling method calls and property access
 * Mainly used for handling objects in the SQL query building process
 *
 * @param obj - The object to proxy
 * @param commit - The commit function, used to execute the final SQL query
 * @param whitelist - The list of method names that should not be proxied
 */
function effectifyWith(
  obj: any,
  commit: () => Effect.Effect<ReadonlyArray<unknown>, SqlError, Client.SqlClient>,
  whitelist: Array<string>,
) {
  const passProxy = hasPassProxy(obj)
  if (passProxy) return obj

  return new Proxy(obj, {
    get(target, prop): any {
      const prototype = Object.getPrototypeOf(target)
      // Handle commit calls
      if (Effect.EffectTypeId in prototype && prop === 'commit') {
        return commit.bind(target)
      }

      // Handle Hash symbol
      if (prop === Hash.symbol) {
        return effectifyWith(target[prop], commit, whitelist)
      }

      // Handle method calls
      if (typeof target[prop] === 'function') {
        // Methods in the whitelist return directly
        if (typeof prop === 'string' && whitelist.includes(prop)) {
          return target[prop].bind(target)
        }
        // Other method calls need to continue proxying
        return (...args: Array<any>) => effectifyWith(target[prop].call(target, ...args), commit, whitelist)
      }
      // Handle property access
      return effectifyWith(target[prop], commit, whitelist)
    },
  })
}

/** @internal */
const makeSqlCommit = function (this: Compilable) {
  const { parameters, sql } = this.compile()
  return Effect.flatMap(Client.SqlClient, (client) => client.unsafe(sql, parameters as any))
}

/** @internal */
function executeCommit(this: Executable) {
  return Effect.withSpan(
    Effect.tryPromise({
      try: () => this.execute(),
      catch: (cause) => new SqlError({ cause }),
    }),
    'kysely.execute',
    {
      kind: 'client',
      captureStackTrace: false,
      attributes: {
        [ATTR_DB_QUERY_TEXT]: this.compile().sql,
      },
    },
  )
}

/**
 *  @internal
 */
export const effectifyWithSql = <T>(obj: T, whitelist: Array<string> = []): T =>
  effectifyWith(obj, makeSqlCommit, whitelist)

/**
 *  @internal
 */
export const effectifyWithExecute = <T>(obj: T, whitelist: Array<string> = []): T =>
  effectifyWith(obj, executeCommit, whitelist)
