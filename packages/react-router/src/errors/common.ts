import type { SqlError } from '@effect/sql/SqlError'
import type {
  InternalServerError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RatelimitError,
} from '@xstack/errors/server'
import type {
  ReactRouterSearchParamsParseError,
  ReactRouterFormDataParseError,
  ReactRouterBodyParseError,
  ReactRouterParamsParseError,
} from '@xstack/react-router/errors/server'
import type { ParseError } from 'effect/ParseResult'

export {
  InternalServerError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RatelimitError,
} from '@xstack/errors/server'

export type ExcludeInternalError<T> = T extends ReactRouterInternalError ? never : T

export type ReactRouterParserDataError =
  | ReactRouterSearchParamsParseError
  | ReactRouterFormDataParseError
  | ReactRouterBodyParseError
  | ReactRouterParamsParseError
  | ParseError

export type ReactRouterInternalError =
  | ReactRouterParserDataError
  | InternalServerError
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | RatelimitError

export type FormatInternalError<T> = T extends ReactRouterParserDataError
  ? BadRequestError
  : T extends SqlError
    ? InternalServerError
    : T

export type ReactRouterServerError =
  | InternalServerError
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | RatelimitError

/**
 * 默认的服务端错误
 */
export type ImplicitServerError = InternalServerError | RatelimitError

export type FilterReactRouterServerError<T> = (T extends ReactRouterServerError ? T : never) | ImplicitServerError

const ReactRouterErrorTags = [
  'InternalServerError',
  'BadRequestError',
  'UnauthorizedError',
  'ForbiddenError',
  'NotFoundError',
  'RatelimitError',
  'ServiceUnavailableError',
]

const InternalErrorTags = ['@react-router', '@db', '@user-kit']

const EffectErrorTags = [
  'RuntimeException',
  'InterruptedException',
  'IllegalArgumentException',
  'NoSuchElementException',
  'InvalidPubSubCapacityException',
  'ExceededCapacityException',
  'TimeoutException',
  'UnknownException',
]

export const isServerError = (error: any): error is ReactRouterServerError => {
  if (error && '_tag' in error) {
    return (
      ReactRouterErrorTags.includes(error._tag) ||
      InternalErrorTags.some((tag) => error._tag.startsWith(tag)) ||
      (EffectErrorTags.some((tag) => error._tag === tag) && error.status)
    )
  }

  return false
}

export const isReactRouterServerError = (error: any): error is ReactRouterServerError => {
  if (error && '_tag' in error) {
    return error._tag.startsWith('@react-router:')
  }

  return false
}
