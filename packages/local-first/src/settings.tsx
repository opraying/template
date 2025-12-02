import type * as Effect from 'effect/Effect'
import type { ParseError } from 'effect/ParseResult'
import * as Schema from 'effect/Schema'
import type { ParseOptions } from 'effect/SchemaAST'

export class Setting<const Name extends string, A = unknown, I = A> {
  readonly name: Name
  readonly schema: Schema.Schema<A, I, never>
  constructor(name: Name, schema: Schema.Schema<A, I, never>) {
    this.name = name
    this.schema = schema
    this.json = Schema.parseJson(schema)
    this.encode = Schema.encode(this.json)
    this.encodeSync = Schema.encodeSync(this.json)
    this.decode = Schema.decode(this.json)
  }
  readonly json: Schema.transform<Schema.SchemaClass<unknown, string, never>, Schema.Schema<A, I, never>>
  readonly encode: (a: A, overrideOptions?: ParseOptions) => Effect.Effect<string, ParseError, never>
  readonly encodeSync: (a: A, overrideOptions?: ParseOptions) => string
  readonly decode: (i: string, overrideOptions?: ParseOptions) => Effect.Effect<A, ParseError, never>
}

export declare namespace Setting {
  export type Any = Setting<string, any>
  export type Name<T> = T extends Setting<infer N, any> ? N : never
  export type Schema<T> = T extends Setting<any, infer A, infer I> ? Schema.Schema<A, I, never> : never
  export type Type<T> = T extends Setting<any, infer A> ? A : never
}

export const make = <
  A extends Record<string, Setting<any, any>>,
  O extends { [K in A[keyof A]['name']]: Extract<A[keyof A], Setting<K, any>>['schema'] },
  E = never,
  R = never,
>(
  records: A,
  defaults: (schema: Schema.Struct<O>) => Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, E, R>,
) => {
  const fields = Object.fromEntries(Object.entries(records).map(([_, setting]) => [setting.name, setting.schema])) as O

  const StructSchema = Schema.Struct(fields)

  return class Settings extends StructSchema {
    static _kind = 'settings' as const

    static get keys(): string[] {
      return Object.entries(records).map(([_, setting]) => setting.name)
    }

    static get defaults(): Effect.Effect<Schema.Schema.Type<Schema.Struct<O>>, E, R> {
      return defaults(StructSchema)
    }
  }
}

interface Settings__<A, E = never, R = never> {
  _kind: 'settings'
  keys: string[]
  defaults: Effect.Effect<A, E, R>
}

export interface Settings<A = unknown, E = never, R = never> extends Schema.Schema.AnyNoContext, Settings__<A, E, R> {}

export declare namespace Settings {
  export type Any = Settings<any, any, any>

  export type Error<A> = A extends Settings<any, infer E, any> ? E : never
  export type Context<A> = A extends Settings<any, any, infer C> ? C : never
  export type Success<A> = A extends Settings<infer A, any, any> ? A : never

  export type Type<A> = Schema.Schema.Type<A>
  export type Encoded<A> = Schema.Schema.Encoded<A>
}
