import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import { UserId } from '@xstack/user-kit/schema'
import * as Data from 'effect/Data'
import * as Schema from 'effect/Schema'

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  '@userkit:unauthorized',
  {
    actorId: UserId,
    entity: Schema.String,
    action: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 401,
  }),
) {
  get message() {
    return `Actor (${this.actorId}) is not authorized to perform action "${this.action}" on entity "${this.entity}"`
  }
}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  '@userkit:forbidden',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Forbidden', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 403,
  }),
) {}

export class NotFound extends Schema.TaggedError<NotFound>()(
  '@userkit:not-found',
  {
    message: Schema.String.pipe(Schema.optionalWith({ default: () => 'Not found', exact: true })),
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class LoginError extends Schema.TaggedError<LoginError>()(
  '@userkit:login-error',
  {
    message: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}

export class VerifyError extends Schema.TaggedError<VerifyError>()(
  '@userkit:verify-error',
  {
    message: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}

export class OAuthInternalError extends Data.TaggedError('@userkit:oauth-internal-error')<{
  message: string
  cause?: Error | unknown | undefined
}> {}

export type OAuthErrorLiteral =
  | 'access-denied'
  | 'invalid-code'
  | 'invalid-state'
  | 'denied'
  | 'unsupported'
  | 'internal-error'

export class OAuthAppError extends Data.TaggedError('@userkit:oauth-app-error')<{
  message: string
  reason: OAuthErrorLiteral
  cause?: Error | unknown | undefined
}> {}

export class OAuthError extends Schema.TaggedError<OAuthError>()(
  '@userkit:oauth-error',
  {
    message: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}
