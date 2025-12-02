import * as HttpApiError from '@effect/platform/HttpApiError'
import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import * as Schema from 'effect/Schema'

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
  'InternalServerError',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Something went wrong', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 500,
  }),
) {}

export class BadRequestError extends Schema.TaggedError<BadRequestError>('BadRequestError')(
  'BadRequestError',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Something went wrong', exact: true })),
    path: Schema.Array(Schema.String).pipe(
      Schema.optionalWith({
        default: () => [],
      }),
    ),
    issues: Schema.Array(HttpApiError.Issue).pipe(
      Schema.optionalWith({
        default: () => [],
      }),
    ),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>('UnauthorizedError')(
  'UnauthorizedError',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Something went wrong', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 401,
  }),
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>('ForbiddenError')(
  'ForbiddenError',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Something went wrong', exact: true })),
    path: Schema.String.pipe(Schema.optionalWith({ default: () => '', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 403,
  }),
) {}

export class NotFoundError extends Schema.TaggedError<NotFoundError>('NotFoundError')(
  'NotFoundError',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Something went wrong', exact: true })),
    path: Schema.String.pipe(Schema.optionalWith({ default: () => '', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class RatelimitError extends Schema.TaggedError<RatelimitError>()(
  'RatelimitError',
  {
    reason: Schema.Literal('RemainingLimitExceeded', 'UnknownError'),
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Too many requests', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 429,
  }),
) {}
