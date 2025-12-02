import * as Schema from 'effect/Schema'

export class InvalidMnemonicError extends Schema.TaggedError<InvalidMnemonicError>()('InvalidMnemonicError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class InvalidPrivateKeyError extends Schema.TaggedError<InvalidPrivateKeyError>()('InvalidPrivateKeyError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class InvalidPublicKeyError extends Schema.TaggedError<InvalidPublicKeyError>()('InvalidPublicKeyError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class EncryptionError extends Schema.TaggedError<EncryptionError>()('EncryptionError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class DecryptionError extends Schema.TaggedError<DecryptionError>()('DecryptionError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class EncryptedDEKError extends Schema.TaggedError<EncryptedDEKError>()('EncryptedDEKError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class DecryptDEKError extends Schema.TaggedError<DecryptDEKError>()('DecryptDEKError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class ToManyRequests extends Schema.TaggedError<ToManyRequests>()('ToManyRequests', {
  message: Schema.String,
}) {}

export class WriteTimeoutError extends Schema.TaggedError<WriteTimeoutError>()('WriteTimeoutError', {
  message: Schema.String,
}) {}

export const RemoteMessageError = Schema.Union(ToManyRequests)

export const RemoteWriteError = Schema.Union(ToManyRequests, WriteTimeoutError)

export class WriteUnknownError extends Schema.TaggedError<WriteUnknownError>()('WriteUnknownError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
