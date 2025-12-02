import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import * as Schema from 'effect/Schema'

export class SyncError extends Schema.TaggedError<SyncError>()('SyncError', {}) {}

export class ImportError extends Schema.TaggedError<ImportError>()('ImportError', {
  message: Schema.String,
  results: Schema.Array(
    Schema.Struct({
      statement: Schema.String,
      success: Schema.Boolean,
      error: Schema.String.pipe(Schema.optional),
    }),
  ),
}) {}

export class ExportError extends Schema.TaggedError<ExportError>()('ExportError', {
  message: Schema.String,
}) {}

export class VaultNotFoundError extends Schema.TaggedError<VaultNotFoundError>()(
  'VaultNotFoundErr',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}
