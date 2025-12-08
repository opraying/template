import type * as Model from '@effect/sql/Model'
import * as SqlClient from '@effect/sql/SqlClient'
import type { SqlError } from '@effect/sql/SqlError'
import * as SqlResolver from '@effect/sql/SqlResolver'
import * as SqlSchema from '@effect/sql/SqlSchema'
import type { CastArray } from '@xstack/fx/utils'
import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { flow, pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import type { ParseError } from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

// ----- Selectable ----

interface SelectableEffect<A, E = never, R = never> extends Effect.Effect<Readonly<CastArray<A>>, E, R> {
  /**
   * take first result as Option
   */
  single: Effect.Effect<Option.Option<CastArray<A>[number]>, E, R>
}

type Selectable<A, I> = {
  <E, R = never>(
    statement: Effect.Effect<ReadonlyArray<I>, E>,
  ): SelectableEffect<ReadonlyArray<A>, E | ParseError | SqlError, R>

  decode<DA, DI, E, R = never>(
    schema: Schema.Schema<DA, DI>,
    statement: Effect.Effect<ReadonlyArray<DI>, E>,
  ): SelectableEffect<ReadonlyArray<DA>, E | ParseError | SqlError, R>

  encode: {
    <NA, NI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<I>, E, R>,
      input: NA,
    ): SelectableEffect<ReadonlyArray<A>, E | ParseError | SqlError, R>;

    <NA, NI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<I>, E, R>,
    ): (input: NA) => SelectableEffect<ReadonlyArray<A>, E | ParseError | SqlError, R>
  }

  codec: {
    <NA, NI, DA, DI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      decodeSchema: Schema.Schema<DA, DI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<DI>, E, R>,
      input: NI,
    ): SelectableEffect<ReadonlyArray<DA>, E | ParseError | SqlError, R>;

    <NA, NI, DA, DI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      decodeSchema: Schema.Schema<DA, DI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<DI>, E, R>,
    ): (input: NI) => SelectableEffect<ReadonlyArray<DA>, E | ParseError | SqlError, R>
  }
}

// ----- Insertable ----

interface InsertableEffect<A, E = never, R = never> extends Effect.Effect<A, E, R> {
  void: Effect.Effect<void, E, R>

  result: Effect.Effect<
    {
      rowsAffected: number
      results: A
    },
    E,
    R
  >
}

type InsertData<T> = T | Array<T>

type Insertable<A, I, IA, II> = {
  <const X extends InsertData<IA>, E, R = never>(
    statement: (data: Array<II>) => Effect.Effect<ReadonlyArray<I>, E, R>,
    input: X,
  ): InsertableEffect<X extends Array<any> ? ReadonlyArray<A> : A, E | ParseError | SqlError, R>;

  <E, R = never>(
    statement: (data: Array<II>) => Effect.Effect<ReadonlyArray<I>, E, R>,
  ): <const X extends InsertData<IA>>(
    input: X,
  ) => InsertableEffect<X extends Array<any> ? ReadonlyArray<A> : A, E | ParseError | SqlError, R>

  void: {
    <const X extends InsertData<IA>, E, X1 = any, R = never>(
      statement: (data: Array<II>) => Effect.Effect<X1, E, R>,
      input: X,
    ): Effect.Effect<void, E | ParseError | SqlError, R>;

    <E, X1 = any, R = never>(
      statement: (data: Array<II>) => Effect.Effect<X1, E, R>,
    ): <const X extends InsertData<IA>>(input: X) => Effect.Effect<void, E | ParseError | SqlError, R>
  }

  decode: {
    <const X extends InsertData<IA>, DA, DI, E, R = never>(
      decode: Schema.Schema<DA, DI>,
      statement: (data: Array<II>) => Effect.Effect<ReadonlyArray<DI>, E, R>,
      input: X,
    ): InsertableEffect<X extends Array<any> ? ReadonlyArray<DA> : DA, E | ParseError | SqlError, R>;

    <DA, DI, E, R = never>(
      decode: Schema.Schema<DA, DI>,
      statement: (data: Array<II>) => Effect.Effect<ReadonlyArray<DI>, E, R>,
    ): <const X extends InsertData<IA>>(
      input: X,
    ) => InsertableEffect<X extends Array<any> ? ReadonlyArray<DA> : DA, E | ParseError | SqlError, R>
  }
}

// ----- Updateable ----

interface UpdateableEffect<A, E, R = never> extends Effect.Effect<A, E, R> {
  /**
   *
   */
  void: Effect.Effect<void, E, R>
  /**
   *
   */
  result: Effect.Effect<
    {
      rowsAffected: number
      results: A
    },
    E,
    R
  >
}

type Updateable<A, I, UA, UI> = {
  <E, R = never>(
    statement: (data: UI) => Effect.Effect<ReadonlyArray<I>, E, R>,
    input: UA,
  ): UpdateableEffect<A, E | ParseError | SqlError, R>;

  <E, R = never>(
    statement: (data: UI) => Effect.Effect<ReadonlyArray<I>, E, R>,
  ): (input: UA) => UpdateableEffect<A, E | ParseError | SqlError, R>

  void: {
    <E, X1 = any, R = never>(
      statement: (data: UI) => Effect.Effect<X1, E, R>,
      input: UA,
    ): Effect.Effect<void, E | ParseError | SqlError, R>;

    <E, X1 = any, R = never>(
      statement: (input: UI) => Effect.Effect<X1, E, R>,
    ): (input: UA) => Effect.Effect<void, E | ParseError | SqlError, R>
  }

  encode: {
    <NA, NI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<I>, E, R>,
      input: NA,
    ): UpdateableEffect<A, E | ParseError | SqlError, R>;

    <NA, NI, E, R = never>(
      encodeSchema: Schema.Schema<NA, NI>,
      statement: (data: NI) => Effect.Effect<ReadonlyArray<I>, E, R>,
    ): (input: NA) => UpdateableEffect<A, E | ParseError | SqlError, R>

    void: {
      <NA, NI, E, R = never>(
        encodeSchema: Schema.Schema<NA, NI>,
        statement: <X = any>(data: NI) => Effect.Effect<X, E, R>,
        input: NA,
      ): Effect.Effect<void, E | ParseError | SqlError, R>;

      <NA, NI, E, R = never>(
        encodeSchema: Schema.Schema<NA, NI>,
        statement: <X = any>(data: NI) => Effect.Effect<X, E, R>,
      ): (input: NA) => Effect.Effect<void, E | ParseError | SqlError, R>
    }
  }

  decode: {
    <DA, DI, E, R = never>(
      decode: Schema.Schema<DA, DI>,
      statement: (data: UI) => Effect.Effect<ReadonlyArray<DI>, E, R>,
      input: UA,
    ): UpdateableEffect<DA, E | ParseError | SqlError, R>;

    <DA, DI, E, R = never>(
      decode: Schema.Schema<DA, DI>,
      statement: (data: UI) => Effect.Effect<ReadonlyArray<DI>, E, R>,
    ): (input: UA) => UpdateableEffect<DA, E | ParseError | SqlError, R>
  }
}

export interface ModelRepo<T extends Model.AnyNoContext> {
  readonly select: Selectable<Schema.Schema.Type<T>, Schema.Schema.Encoded<T>>
  readonly insert: Insertable<
    Schema.Schema.Type<T>,
    Schema.Schema.Encoded<T>,
    Schema.Schema.Type<T['insert']>,
    Schema.Schema.Encoded<T['insert']>
  >
  readonly update: Updateable<
    Schema.Schema.Type<T>,
    Schema.Schema.Encoded<T>,
    Schema.Schema.Type<T['update']>,
    Schema.Schema.Encoded<T['update']>
  >
}

const table = <T extends Model.AnyNoContext>(table: T) => {
  type SType = Schema.Schema.Type<T>
  type SEncoded = Schema.Schema.Encoded<T>

  const decodeSelect = Schema.decodeUnknown(Schema.Array(table))

  // ----- Selectable ----
  const select = ((statement: Effect.Effect<Array<SEncoded>>) => {
    const effect = statement.pipe(Effect.flatMap((_) => decodeSelect(_))) as unknown as SelectableEffect<SType>

    return enhanceEffect(effect, {
      single: effect.pipe(Effect.map((result) => Option.fromNullable(result.at(0)))),
    })
  }) as unknown as ModelRepo<T>['select']

  enhanceEffect(select, {
    decode: ((schema, statement) => {
      const decodeSelect = Schema.decodeUnknown(Schema.Array(schema))
      const effect = statement.pipe(Effect.flatMap((_) => decodeSelect(_))) as unknown as SelectableEffect<SType>

      return enhanceEffect(effect, {
        single: effect.pipe(Effect.map((result) => Option.fromNullable(result.at(0)))),
      })
    }) as ModelRepo<T>['select']['decode'],
    encode: ((schema, statement, input) => {
      const encode = Schema.encodeUnknown(schema)

      const handle = (data: unknown) => {
        const effect = pipe(
          encode(data),
          Effect.flatMap((_) => statement(_)),
          Effect.flatMap((_) => decodeSelect(_)),
        )

        return enhanceEffect(effect, {
          single: effect.pipe(Effect.map((result) => Option.fromNullable(result.at(0)))),
        })
      }

      if (typeof input !== 'undefined') {
        return handle(input) as any
      }

      return handle
    }) as ModelRepo<T>['update']['encode'],
    codec: ((encodeSchema, decodeSchema, statement, input) => {
      const encode = Schema.encodeUnknown(encodeSchema)
      const decode = Schema.decodeUnknown(Schema.Array(decodeSchema))

      const handle = (data: unknown) => {
        const effect = pipe(
          encode(data),
          Effect.flatMap((_) => statement(_)),
          Effect.flatMap((_) => decode(_)),
        ) as unknown as SelectableEffect<SType>

        return enhanceEffect(effect, {
          single: effect.pipe(Effect.map((result) => Option.fromNullable(result.at(0)))),
        })
      }

      if (typeof input !== 'undefined') {
        return handle(input) as any
      }

      return handle
    }) as ModelRepo<T>['select']['codec'],
  })

  // ----- Insertable ----

  const encodeInsertMany = Schema.encodeUnknown(Schema.Array(table.insert))

  const insert = ((statement, input) => {
    const handle = (data: InsertData<unknown>) => {
      const effect = pipe(
        encodeInsertMany(Arr.ensure(data)),
        Effect.flatMap((_) => statement(_ as any)),
      )

      return enhanceEffect(
        pipe(
          effect,
          Effect.flatMap((_) => decodeSelect(_)),
          Effect.map((_) => {
            if (Array.isArray(data)) {
              return _
            }

            return _.at(0)
          }),
        ),
        {
          void: Effect.asVoid(effect),
          result: pipe(
            effect,
            Effect.flatMap((_) => decodeSelect(_)),
            Effect.map((_) => {
              // TODO: Implement result decoding logic
              return {
                rowsAffected: 1,
                results: Array.isArray(data) ? _ : _.at(0),
              }
            }),
          ),
        },
      ) as unknown as InsertableEffect<any>
    }

    if (typeof input !== 'undefined') {
      return handle(input) as any
    }

    return handle
  }) as ModelRepo<T>['insert']

  enhanceEffect(insert, {
    void: ((statement, input) => {
      const handle = flow(
        Arr.ensure,
        encodeInsertMany,
        Effect.flatMap((_) => statement(_ as any)),
      )

      return typeof input !== 'undefined' ? Effect.asVoid(handle(input)) : handle
    }) as ModelRepo<T>['insert']['void'],
    decode: ((schema, statement, input) => {
      const decode = Schema.decodeUnknown(Schema.Array(schema))
      const handle = (data: InsertData<unknown>) => {
        const effect = pipe(
          encodeInsertMany(Arr.ensure(data)),
          Effect.flatMap((_) => statement(_ as any)),
        ) as unknown as SelectableEffect<unknown, never>

        return enhanceEffect(
          pipe(
            effect,
            Effect.flatMap((_) => decode(_)),
            Effect.map((_) => {
              if (Array.isArray(data)) {
                return _
              }

              return _.at(0)
            }),
          ),
          {
            void: Effect.asVoid(effect),
            result: pipe(
              effect,
              Effect.flatMap((_) => decode(_)),
              Effect.map((_) => {
                // TODO: Implement result decoding logic
                return {
                  rowsAffected: 1,
                  results: Array.isArray(data) ? _ : _.at(0),
                }
              }),
            ),
          },
        )
      }

      if (typeof input !== 'undefined') {
        return handle(input) as any
      }

      return handle
    }) as ModelRepo<T>['insert']['decode'],
  })

  // ----- Updateable ----

  const update = ((statement, input) => {
    const encode = Schema.encodeUnknown(table.update)

    const handle = (data: unknown) => {
      const effect = pipe(
        encode(data),
        Effect.flatMap((_) => statement(_)),
      )

      return enhanceEffect(
        pipe(
          effect,
          Effect.flatMap((_) => decodeSelect(_)),
          Effect.map((_) => _.at(0)),
        ),
        {
          void: Effect.asVoid(effect),
          result: pipe(
            effect,
            Effect.flatMap((_) => decodeSelect(_)),
            Effect.map((_) => {
              // TODO: Implement result decoding logic
              return {
                rowsAffected: 1,
                results: _.at(0),
              }
            }),
          ),
        },
      )
    }

    if (typeof input !== 'undefined') {
      return handle(input) as any
    }

    return handle
  }) as ModelRepo<T>['update']

  enhanceEffect(update, {
    void: ((statement, input) => {
      const encode = Schema.encodeUnknown(table.update)

      const handle = (data: unknown) =>
        pipe(
          encode(data),
          Effect.flatMap((_) => statement(_)),
        )

      return typeof input !== 'undefined' ? handle(input) : handle
    }) as ModelRepo<T>['update']['void'],
    encode: enhanceEffect(
      ((schema, statement, input) => {
        const encodeUnknown = Schema.encodeUnknown(schema)

        const handle = (data: unknown) => {
          const effect = pipe(
            encodeUnknown(data),
            Effect.flatMap((_) => statement(_)),
          )

          return enhanceEffect(
            pipe(
              effect,
              Effect.flatMap((_) => decodeSelect(_)),
              Effect.map((_) => _.at(0)),
            ),
            {
              void: Effect.asVoid(effect),
              result: pipe(
                effect,
                Effect.flatMap((_) => decodeSelect(_)),
                Effect.map((_) => {
                  // TODO: Implement result decoding logic
                  return {
                    rowsAffected: 1,
                    results: _.at(0),
                  }
                }),
              ),
            },
          )
        }

        if (typeof input !== 'undefined') {
          return handle(input) as any
        }

        return handle
      }) as ModelRepo<T>['update']['encode'],
      {
        void: ((schema, statement, input) => {
          const encodeUnknown = Schema.encodeUnknown(schema)

          const handle = flow(
            encodeUnknown,
            Effect.flatMap((_) => statement(_)),
            Effect.asVoid,
          )

          if (typeof input !== 'undefined') {
            return handle(input) as any
          }

          return handle
        }) as ModelRepo<T>['update']['encode']['void'],
      },
    ),
    decode: ((schema, statement, input) => {
      const encode = Schema.encodeUnknown(table.update)
      const decode = Schema.decodeUnknown(Schema.Array(schema))

      const handle = (data: unknown) => {
        const effect = pipe(
          encode(data),
          Effect.flatMap((_) => statement(_)),
        ) as unknown as SelectableEffect<unknown, never>

        return enhanceEffect(
          Effect.flatMap(effect, (_) => decode(_)),
          {
            void: Effect.asVoid(effect),
            result: pipe(
              effect,
              Effect.flatMap((_) => decode(_)),
              Effect.map((_) => {
                // TODO: Implement result decoding logic
                return {
                  rowsAffected: 1,
                  results: _.at(0),
                }
              }),
            ),
          },
        )
      }

      if (typeof input !== 'undefined') {
        return handle(input) as any
      }

      return handle
    }) as ModelRepo<T>['update']['decode'],
  })

  return {
    select: select,
    insert: insert,
    update: update,
  } as ModelRepo<T>
}

export const encode: {
  <A, I, X, E, R = never>(
    schema: Schema.Schema<A, I>,
    statement: (input: I) => Effect.Effect<X, E, R>,
    input: A,
  ): Effect.Effect<X, E | SqlError | ParseError, R>;
  <A, I, X, E, R = never>(
    schema: Schema.Schema<A, I>,
    statement: (input: I) => Effect.Effect<X, E, R>,
  ): (input: A) => Effect.Effect<X, E | SqlError | ParseError, R>
} = (<A, I, X, E, R = never>(
  schema: Schema.Schema<A, I>,
  statement: (input: I) => Effect.Effect<X, E, R>,
  input: A,
) => {
  const encodeUnknown = Schema.encodeUnknown(schema)

  const handle = flow(
    encodeUnknown,
    Effect.flatMap((_) => statement(_)),
  )

  return typeof input !== 'undefined' ? handle(input) : handle
}) as any

export const decode: {
  <A, I, E, R = never>(
    schema: Schema.Schema<A, I>,
    statement: Effect.Effect<I, E>,
  ): Effect.Effect<CastArray<A>, E | ParseError | SqlError, R>;
  <A, I>(
    schema: Schema.Schema<A, I>,
  ): <E, R = never>(statement: Effect.Effect<I, E>) => Effect.Effect<CastArray<A>, E | ParseError | SqlError, R>
} = (<A, I, E = never, R = never>(schema: Schema.Schema<A, I>, statement: Effect.Effect<I, E>) => {
  const decodeUnknown = Schema.decodeUnknown(schema)
  return (
    typeof statement !== 'undefined'
      ? statement.pipe(Effect.flatMap(decodeUnknown))
      : (s: Effect.Effect<I, E>) => pipe(s, Effect.flatMap(decodeUnknown))
  ) as Effect.Effect<CastArray<A>, E | ParseError | SqlError, R>
}) as any

export const codec: {
  <A, I, DA, DI, E, R = never>(
    encode: Schema.Schema<A, I, never>,
    decode: Schema.Schema<DA, DI, never>,
    statement: (input: I) => Effect.Effect<DI, E, R>,
    input: A,
  ): Effect.Effect<DA, E | ParseError | SqlError, R>;
  <A, I, DA, DI, E, R = never>(
    encode: Schema.Schema<A, I, never>,
    decode: Schema.Schema<DA, DI, never>,
    statement: (input: I) => Effect.Effect<DI, E, R>,
  ): (input: A) => Effect.Effect<DA, E | ParseError | SqlError, R>
} = (<A, I, DA, DI, E, R = never>(
  encode: Schema.Schema<A, I, never>,
  decode: Schema.Schema<DA, DI, never>,
  statement: (input: I) => Effect.Effect<DI, E, R>,
  input: A,
) => {
  const encodeUnknown = Schema.encodeUnknown(encode)
  const decodeUnknown = Schema.decodeUnknown(decode)

  const handle = flow(
    encodeUnknown,
    Effect.flatMap((_) => statement(_)),
    Effect.flatMap(decodeUnknown),
  )

  return typeof input !== 'undefined' ? handle(input) : handle
}) as any

export const repo = <T extends Model.AnyNoContext>(
  model: T,
): Effect.Effect<ModelRepo<T> & { sql: SqlClient.SqlClient }, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      ...table(model),
      sql,
    }
  })

export const findAll = SqlSchema.findAll

export const findOne = SqlSchema.findOne

export const single = SqlSchema.single

const void_ = SqlSchema.void

export { void_ as void }

export const resolver = SqlResolver

const enhanceEffect = (object: any, properties: Record<string, any>) => {
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(object, key, {
      // writable: false,
      enumerable: true,
      configurable: false,
      get() {
        return value
      },
    })
  })

  return object
}

export * from '@effect/sql/Model'
