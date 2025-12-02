import { getUserDurableId, Separator } from '@xstack/event-log-server/server/utils'
import * as Cause from 'effect/Cause'
import * as Context from 'effect/Context'
import * as Either from 'effect/Either'
import { identity } from 'effect/Function'
import * as Option from 'effect/Option'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

export class DurableObjectParseError extends Schema.TaggedError<DurableObjectParseError>('DurableObjectParseError')(
  'DurableObjectParseError',
  {
    // TreeFormatter message
    message: Schema.String,
    // ArrayFormatter message
    errors: Schema.Array(
      Schema.Struct({
        _tag: Schema.String,
        path: Schema.Array(Schema.Union(Schema.String, Schema.Number, Schema.Symbol)),
        message: Schema.String,
      }),
    ),
  },
) {
  static fromParseError(error: ParseResult.ParseError) {
    const message = ParseResult.TreeFormatter.formatErrorSync(error)
    const errors = ParseResult.ArrayFormatter.formatErrorSync(error)

    return DurableObjectParseError.make(
      {
        message,
        errors,
      },
      { disableValidation: true },
    )
  }
}

export const DurableObjectErrors = Schema.Union(DurableObjectParseError)

const unknownToDurableObjectError = (error: unknown): string => {
  let e: DurableObjectError

  if (typeof error === 'string') {
    e = DurableObjectError.make({ message: error })
  } else if (ParseResult.isParseError(error)) {
    e = DurableObjectError.make({
      message: error.name,
      cause: Cause.fail(DurableObjectParseError.fromParseError(error)),
    })
  } else {
    e = DurableObjectError.make(
      DurableObjectError.make({
        message: 'Unknown error',
        cause: Cause.die(error),
      }),
    )
  }

  const encodeErrorString = DurableObjectError.encodeJSON(e).pipe(
    Either.match({
      onLeft: (e) => JSON.stringify(e),
      onRight: identity,
    }),
  )

  return encodeErrorString
}

export class DurableObjectError extends Schema.TaggedError<DurableObjectError>('DurableObjectError')(
  'DurableObjectError',
  {
    message: Schema.String,
    cause: Schema.optionalWith(
      Schema.Cause({
        defect: Schema.Defect,
        error: DurableObjectErrors,
      }),
      {
        exact: true,
      },
    ),
  },
) {
  static JSON = Schema.parseJson(DurableObjectError)

  static decodeJSON = Schema.decodeEither(DurableObjectError.JSON)

  static encodeJSON = Schema.encodeEither(DurableObjectError.JSON)

  static fromUnknown(error: unknown): DurableObjectError {
    const errorString = typeof error === 'string' ? error : JSON.stringify(error)
    const decodeError = DurableObjectError.decodeJSON(errorString).pipe(
      Either.getOrElse(() => DurableObjectError.make({ message: errorString }, { disableValidation: true })),
    )

    return decodeError
  }

  static try<A>(fn: () => A): A {
    try {
      return fn()
    } catch (error: unknown) {
      throw unknownToDurableObjectError(error)
    }
  }

  static async promise<A>(fn: () => Promise<A> | A): Promise<A> {
    try {
      return await fn()
    } catch (error: unknown) {
      throw unknownToDurableObjectError(error)
    }
  }

  toString() {
    if (!this.cause) {
      return this.message
    }

    return `${this.message}\n${Cause.pretty(this.cause)}`
  }
}

export class DurableObjectIdentitySchema extends Schema.Class<DurableObjectIdentitySchema>('DurableObjectIdentity')({
  namespace: Schema.String,
  publicKey: Schema.String,
  userId: Schema.OptionFromNonEmptyTrimmedString,
  userEmail: Schema.OptionFromNonEmptyTrimmedString,
}) {
  static decode = Schema.decodeUnknown(DurableObjectIdentitySchema)

  static decodeSync = Schema.decodeUnknownEither(DurableObjectIdentitySchema)

  static parseId(id: string): boolean {
    const [a, b, c] = id.split(Separator)
    const pass = a && b && c

    if (pass) return true

    return false
  }

  id(): string {
    return getUserDurableId(
      this.namespace,
      Option.getOrElse(this.userId, () => ''),
      this.publicKey,
    )
  }

  static fromHeaders(headers: Headers) {
    const namespace = headers.get('x-namespace')
    const publicKey = headers.get('x-public-key')
    const userId = headers.get('x-user-id')
    const userEmail = headers.get('x-user-email')

    return DurableObjectIdentitySchema.decodeSync({ namespace, publicKey, userId, userEmail })
  }

  static fromRecord(record: Record<string, string>) {
    return DurableObjectIdentitySchema.decodeSync({
      namespace: record.namespace,
      publicKey: record.publicKey,
      userId: record.userId,
      userEmail: record.userEmail,
    })
  }

  toHeaders(): Headers {
    const headers = new Headers([
      ['x-namespace', this.namespace],
      ['x-public-key', this.publicKey],
      ['x-user-id', Option.getOrElse(this.userId, () => '')],
      ['x-user-email', Option.getOrElse(this.userEmail, () => '')],
      ['x-durable-object-identity', this.id()],
    ])

    return headers
  }

  assignTo(headers: Headers): Headers {
    const current = this.toHeaders()
    current.forEach((value, key) => {
      headers.set(key, value)
    })
    return headers
  }
}
export interface DurableObjectIdentity extends Schema.Schema.Type<typeof DurableObjectIdentitySchema> {}

export const DurableObjectIdentity = Context.GenericTag<DurableObjectIdentity>(
  '@xstack/event-log/Cloudflare/DurableObjectIdentity',
)

export const StorageObjectState = Context.GenericTag<DurableObjectState>(
  '@xstack/event-log/Cloudflare/StorageObjectState',
)

export const DoSqlStorage = Context.GenericTag<SqlStorage>('@xstack/event-log/Cloudflare/DoSqlStorage')
