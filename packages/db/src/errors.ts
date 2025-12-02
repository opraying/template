import * as Data from 'effect/Data'
import type { ParseError } from 'effect/ParseResult'

export class QueryParseError extends Data.TaggedError('@db:query-parse-error')<{
  message: string
  cause: ParseError
}> {}

export class QueryError extends Data.TaggedError('@db:query-error')<{
  message: string
  cause: Error
}> {}

export class NotFoundError extends Data.TaggedError('@db:notfound-error')<{
  message: string
  cause: Error
}> {}

export type DatabaseError = QueryParseError | QueryError | NotFoundError
