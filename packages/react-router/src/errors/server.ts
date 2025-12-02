import * as Data from 'effect/Data'
import * as ParseResult from 'effect/ParseResult'
import * as Cause from 'effect/Cause'
import type { ParseError } from 'effect/ParseResult'
import {
  InternalServerError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RatelimitError,
} from '@xstack/errors/server'

type ReactRouterParserDataError =
  | ReactRouterSearchParamsParseError
  | ReactRouterFormDataParseError
  | ReactRouterBodyParseError
  | ReactRouterParamsParseError
  | ParseError

export class ReactRouterFormDataParseError extends Data.TaggedError('@react-router:form-data-parse-error')<{
  cause: ParseResult.ParseError
}> {}

export class ReactRouterBodyParseError extends Data.TaggedError('@react-router:body-parse-error')<{
  cause: ParseResult.ParseError
}> {}

export class ReactRouterSearchParamsParseError extends Data.TaggedError('@react-router:search-params-parse-error')<{
  cause: ParseResult.ParseError
}> {}

export class ReactRouterParamsParseError extends Data.TaggedError('@react-router:params-parse-error')<{
  cause: ParseResult.ParseError
}> {}

type ReactRouterInternalError =
  | ReactRouterParserDataError
  | InternalServerError
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | RatelimitError

export function transformReactRouterError(cause: Cause.Cause<ReactRouterInternalError>) {
  if (cause._tag !== 'Fail') {
    return cause
  }

  if (
    cause.error._tag === 'ParseError' ||
    (cause.error._tag.indexOf('@react-router') > -1 && cause.error._tag.indexOf('parse-error') > -1)
  ) {
    const parseError = cause.error._tag === 'ParseError' ? cause.error : (cause.error.cause as ParseResult.ParseError)
    const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError)

    return Cause.fail(
      BadRequestError.make({
        message: 'Invalid request',
        issues,
        cause: cause.error,
      }),
    )
  }

  return cause
}
