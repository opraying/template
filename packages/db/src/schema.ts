import * as VariantSchema from '@effect/experimental/VariantSchema'
import * as Model from '@effect/sql/Model'
import type * as Brand from 'effect/Brand'
import * as DateTime_ from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as AST from 'effect/SchemaAST'
import * as nanoid from 'nanoid'
import * as uuid from 'uuid'

export type Tables = Array<Model.AnyNoContext & { table: string }>

export const tables = <K extends Array<{ table: string }>, I extends K[number] = K[number]>(
  tables: K,
): {
  [k in I['table']]: I extends { table: k } ? I : never
} => tables.reduce((acc, table) => ({ ...acc, [table.table]: table }), {} as any)

export type TablesRecord<K extends Array<{ table: string }>, I extends K[number] = K[number]> = {
  [k in I['table']]: I extends { table: k } ? I : never
}

export type TablesType<T extends Record<string, Tables[number]>> = {
  [K in keyof T]: Schema.Schema.Type<T[K]>
}

export type TablesEncoded<T extends Record<string, Tables[number]>> = {
  [K in keyof T]: Schema.Schema.Encoded<T[K]>
}

export const IdConfigTypeId = Symbol.for('@db/id-config')

export type IdGenerate = 'autoincrement' | 'now()'

export type IdConfig = {
  /**
   * 生成 id 的方式
   */
  generate?: IdGenerate
  /**
   * 描述
   */
  description?: string
  /**
   * 自定义数据库列名
   */
  map?: string
}

export const IdConfig =
  (config: IdConfig = {}) =>
  <S extends Schema.Annotable.All>(self: S): Schema.Annotable.Self<S> => {
    const { description, ...rest } = config

    const exist: any = self.ast.annotations ?? {}
    const existDescription = AST.getDescriptionAnnotation(self.ast).pipe(Option.getOrNull)

    return self.annotations({
      ...exist,
      description: description ?? existDescription,
      [IdConfigTypeId]: {
        ...rest,
      },
    })
  }

export const ColumnConfigTypeId = Symbol.for('@db/column-config')

export type ColumnConfig = {
  /**
   * 是否唯一
   */
  unique?: boolean | string
  /**
   * 是否为索引
   */
  index?: boolean | string
  /**
   * 描述
   */
  description?: string
  /**
   * 默认值
   */
  default?: unknown
  /**
   * 自定义数据库列名
   */
  map?: string
  /**
   * 是否为空
   */
  nullable?: boolean
  /**
   * 数据库类型
   */
  db?: {
    type?: string // Database-specific type
    [key: string]: unknown // Other database-specific options
  }
}

export const ColumnConfig =
  (config: ColumnConfig) =>
  <S extends Schema.Annotable.All>(self: S): Schema.Annotable.Self<S> => {
    const { description, ...rest } = config

    const exist: any = self.ast.annotations ?? {}
    const existDescription = AST.getDescriptionAnnotation(self.ast).pipe(Option.getOrUndefined)

    return self.annotations({
      ...exist,
      description: description ?? existDescription,
      [ColumnConfigTypeId]: {
        ...rest,
      },
    })
  }

export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-one'
export type ReferenceAction = 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

export type RelationConfig =
  | {
      type: 'one-to-one'
      name: string
      description?: string
      relationName?: string
      fields?: string[]
      referencedModel: string
      references?: string[]
      map?: string
      onUpdate?: ReferenceAction
      onDelete?: ReferenceAction
    }
  | {
      type: 'one-to-many'
      name: string
      description?: string
      relationName?: string
      fields?: string[]
      referencedModel: string
      references?: string[]
      map?: string
      onUpdate?: ReferenceAction
      onDelete?: ReferenceAction
    }
  | {
      type: 'many-to-one'
      name: string
      description?: string
      relationName?: string
      fields: string[]
      referencedModel: string
      references: string[]
      map?: string
      onUpdate?: ReferenceAction
      onDelete?: ReferenceAction
    }

export const ModelConfigTypeId = Symbol.for('@db/model-config')

export type ModelConfig = {
  description?: string
  documentation?: string
  namespace?: string
  author?: string
  relations?: RelationConfig[]
}

export const ModelConfig = (config: ModelConfig) => {
  const { description, documentation, ...rest } = config
  return {
    description: description ?? '',
    documentation: documentation ?? '',
    [ModelConfigTypeId]: rest,
  }
}

export const toBool = (value: unknown) => {
  if (value === null) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return value
}

/**
 * @since 1.0.0
 * @category date & time
 */
export interface DateTime extends Schema.transform<
  typeof Schema.ValidDateFromSelf,
  typeof Schema.DateTimeUtcFromSelf
> {}

/**
 * @since 1.0.0
 * @category date & time
 */
export const DateTime: DateTime = Schema.transform(
  Schema.Union(Schema.String, Schema.ValidDateFromSelf) as unknown as typeof Schema.ValidDateFromSelf,
  Schema.DateTimeUtcFromSelf,
  {
    decode: (_) => {
      const date = typeof _ === 'string' ? new Date(_) : _
      return DateTime_.unsafeFromDate(date)
    },
    encode: (_) => {
      return DateTime_.formatIso(_)
    },
    strict: false,
  },
)

/**
 * Decode always returns a Boolean
 * Encode always returns a Boolean
 */
export const Boolean_ = Schema.transform(
  Schema.Union(Schema.Boolean, Schema.Number) as Schema.Schema<boolean, boolean>,
  Schema.Boolean,
  {
    strict: false,
    decode: (n) => toBool(n),
    encode: (b) => b,
  },
)

/**
 * Make sure that the boolean is encoded as a number
 * Decode always returns a Boolean
 * Encode always returns a Number
 */
export const Boolean = Schema.transform(
  Schema.Union(Schema.Boolean, Schema.Number, Schema.Null) as Schema.Schema<boolean, boolean>,
  Schema.Boolean,
  {
    strict: false,
    decode: (n: boolean | number | null) => {
      return toBool(n)
    },
    encode: (n) => {
      return n ? 1 : 0
    },
  },
).annotations({
  identifier: 'Boolean',
})

/**
 * Float
 */
export const Float = Schema.Int.annotations({
  identifier: 'Float',
  description: 'a float number',
}).pipe(Schema.brand('Float'))
export type Float = typeof Float.Type

/**
 * Decimal
 */
export const Decimal = Schema.Int.annotations({
  identifier: 'Decimal',
  description: 'a decimal number',
}).pipe(Schema.brand('Decimal'))
export type Decimal = typeof Decimal.Type

/**
 * String from comma separated
 *
 * @example
 * ```ts
 * const schema = StringFromCommaSeparated(Schema.String)
 * ```
 * @data 1,2,3
 * @result ["1", "2", "3"]
 */
export const StringFromCommaSeparated = Schema.transform(Schema.NullOr(Schema.String), Schema.Array(Schema.String), {
  decode: (s) => {
    if (s === null) {
      return []
    }

    return s.split(',')
  },
  encode: (a) => a.join(','),
})

/**
 * Schema from comma separated
 *
 * @example
 * ```ts
 * const schema = SchemaFromCommaSeparated(Schema.String)
 * ```
 * @data 1,2,3
 * @result ["1", "2", "3"]
 */
export const SchemaFromCommaSeparated = <A, I>(schema: Schema.Schema<A, I>, transform?: (_: string) => I) => {
  return Schema.transform(Schema.NullOr(Schema.String), Schema.Array(schema), {
    strict: false,
    decode: (s) => {
      if (s === null) {
        return []
      }

      if (transform) {
        return s.split(',').map((_) => transform(_) as I)
      }

      return s.split(',')
    },
    encode: (a) => a.join(','),
  })
}

export const nonEmptyString = Schema.String.pipe(Schema.nonEmptyString())

// ID helper

/**
 * Auto increment id
 */
export const AutoIncrementId = Schema.Int.pipe(
  Schema.positive(),
  IdConfig({
    description: 'Auto increment primary key',
    generate: 'autoincrement',
  }),
  Model.Generated,
)

/**
 * UUID v4 string id
 */
export const Uuid = Schema.String.pipe(
  IdConfig({
    description: 'UUID primary key',
  }),
  Model.Generated,
)

/**
 * UUID v7 string id
 */
export const UuidV7 = Schema.String.pipe(
  IdConfig({
    description: 'UUID primary key',
  }),
  Model.Generated,
)

// Auto insert id

/**
 * @since 1.0.0
 * @category uuid
 */
export interface UuidInsert<B extends string | symbol> extends VariantSchema.Field<{
  readonly select: Schema.brand<typeof Schema.String, B>
  readonly insert: VariantSchema.Overrideable<string & Brand.Brand<B>, string>
  readonly update: Schema.brand<typeof Schema.String, B>
  readonly json: Schema.brand<typeof Schema.String, B>
}> {}

/**
 * @since 1.0.0
 * @category uuid
 */
export const UuidWithGenerate = <B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
): VariantSchema.Overrideable<string & Brand.Brand<B>, string> =>
  VariantSchema.Overrideable(Schema.String, schema, {
    generate: Option.match({
      onNone: () => Effect.sync(() => uuid.v4({})),
      onSome: (id) => Effect.succeed(id as any),
    }),
    decode: Schema.String,
    constructorDefault: () => uuid.v4({}) as any,
  })

/**
 * A field that represents a binary UUID v4 that is generated on inserts.
 *
 * @since 1.0.0
 * @category uuid
 */
export const UuidInsert = <const B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
): UuidInsert<B> =>
  Model.Field({
    select: schema,
    insert: UuidWithGenerate(schema),
    update: schema,
    json: schema,
  })

/**
 * UUID v4 insert
 */
export const uuidInsert = Schema.String.pipe(
  Schema.brand('DB-Uuid'),
  IdConfig({
    description: 'UUID primary key',
  }),
  UuidInsert,
)

/**
 * @since 1.0.0
 * @category uuid
 */
export interface UuidV7Insert<B extends string | symbol> extends VariantSchema.Field<{
  readonly select: Schema.brand<typeof Schema.String, B>
  readonly insert: VariantSchema.Overrideable<string & Brand.Brand<B>, string>
  readonly update: Schema.brand<typeof Schema.String, B>
  readonly json: Schema.brand<typeof Schema.String, B>
}> {}

/**
 * @since 1.0.0
 * @category uuid
 */
export const UuidV7WithGenerate = <B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
): VariantSchema.Overrideable<string & Brand.Brand<B>, string> =>
  VariantSchema.Overrideable(Schema.String, schema, {
    generate: Option.match({
      onNone: () => Effect.sync(() => uuid.v7({})),
      onSome: (id) => Effect.succeed(id as any),
    }),
    decode: Schema.String,
    constructorDefault: () => uuid.v7({}) as any,
  })

/**
 * A field that represents a binary UUID v7 that is generated on inserts.
 *
 * @since 1.0.0
 * @category uuid
 */
export const UuidV7Insert = <const B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
): UuidV7Insert<B> =>
  Model.Field({
    select: schema,
    insert: UuidV7WithGenerate(schema),
    update: schema,
    json: schema,
  })

/**
 * UUID v7 insert
 */
export const uuidV7Insert = Schema.String.pipe(
  Schema.brand('DB-Uuid'),
  IdConfig({
    description: 'UUID primary key',
  }),
  UuidV7Insert,
)

/**
 * @since 1.0.0
 * @category uuid
 */
interface NanoIdInsert<B extends string | symbol> extends VariantSchema.Field<{
  readonly select: Schema.brand<typeof Schema.String, B>
  readonly insert: VariantSchema.Overrideable<string & Brand.Brand<B>, string>
  readonly update: Schema.brand<typeof Schema.String, B>
  readonly json: Schema.brand<typeof Schema.String, B>
}> {}

/**
 * @since 1.0.0
 * @category id
 */
export const NanoIdWithGenerate = <B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
  size?: number,
  factory: (size?: number) => string = (size) => nanoid.nanoid(size),
): VariantSchema.Overrideable<string & Brand.Brand<B>, string> =>
  VariantSchema.Overrideable(Schema.String, schema, {
    generate: Option.match({
      onNone: () => Effect.sync(() => factory(size)),
      onSome: (id) => Effect.succeed(id as any),
    }),
    decode: Schema.String,
    constructorDefault: () => factory(size) as any,
  })

/**
 * A field that represents a NanoId that is generated on inserts.
 *
 * @since 1.0.0
 * @category id
 */
export const NanoIdInsert = <const B extends string | symbol>(
  schema: Schema.brand<typeof Schema.String, B>,
  size?: number,
  factory: (size?: number) => string = (size) => nanoid.nanoid(size),
): NanoIdInsert<B> =>
  Model.Field({
    select: schema,
    insert: NanoIdWithGenerate(schema, size, factory),
    update: schema,
    json: schema,
  })

/**
 * NanoId id
 */
export const NanoId = Schema.String.pipe(
  IdConfig({
    description: 'NanoId primary key',
  }),
  Model.Generated,
)

/**
 * NanoId insert
 */
export const nanoIdInsert = Schema.String.pipe(
  Schema.brand('DB-NanoId'),
  IdConfig({
    description: 'NanoId primary key',
  }),
  NanoIdInsert,
)

export const id = {
  string: Schema.String.pipe(
    IdConfig({
      description: 'String primary key',
    }),
  ),
  autoIncrement: AutoIncrementId,

  uuid: Uuid,
  uuidInsert: uuidInsert,
  uuidInsertSchema:
    (config: IdConfig = {}) =>
    <const B extends string | symbol>(schema: Schema.brand<typeof Schema.String, B>) =>
      pipe(schema, IdConfig(config), UuidInsert),

  uuidV7: UuidV7,
  uuidV7Insert: uuidV7Insert,
  uuidV7InsertSchema:
    (config: IdConfig = {}) =>
    <const B extends string | symbol>(schema: Schema.brand<typeof Schema.String, B>) =>
      pipe(schema, IdConfig(config), UuidV7Insert),

  nanoId: NanoId,
  nanoIdInsert,
  nanoIdInsertSchema:
    (config: IdConfig = {}) =>
    <const B extends string | symbol>(schema: Schema.brand<typeof Schema.String, B>) =>
      pipe(schema, IdConfig(config), NanoIdInsert),
}

export declare namespace id {
  export interface AutoIncrementId extends Schema.filter<typeof Schema.Int> {}
  export interface UuidId extends Schema.filter<typeof Schema.Uint8ArrayFromSelf> {}
  export interface NanoId extends Schema.filter<typeof Schema.String> {}
}
