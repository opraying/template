import * as Arr from 'effect/Array'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export const ProviderEnvConfig = Config.all({
  name: Config.literal('local', 'resend')('name'),
  apiKey: Config.redacted('apiKey'),
}).pipe(Effect.orDie)

export const EmailerConfig = Config.all({
  namespace: Config.string('NAMESPACE'),
  provider: Config.all({
    name: Config.literal('local', 'resend')('PROVIDER').pipe(Config.withDefault('local')),
    apiKey: Config.redacted('API_KEY').pipe(Config.option),
    // smtp..
  }).pipe(Config.nested('EMAILER')),
  emailer: Config.all({
    from: Config.string('FROM').pipe(Config.option),
  }).pipe(Config.nested('EMAILER')),
})

const ArraySchema = Schema.Array(Schema.NonEmptyString).pipe(Schema.minItems(1))

const To = Schema.transform(Schema.Union(Schema.NonEmptyString, ArraySchema), ArraySchema, {
  decode(fa) {
    return Arr.ensure(fa)
  },
  encode(ti) {
    return ti
  },
  strict: true,
})

export const EmailSendOptions = Schema.Struct({
  from: Schema.NonEmptyString.pipe(Schema.optionalWith({ exact: true })),
  to: To,
  subject: Schema.NonEmptyString,
  bcc: ArraySchema.pipe(Schema.optionalWith({ exact: true })),
  cc: ArraySchema.pipe(Schema.optionalWith({ exact: true })),
  scheduledAt: Schema.Date.pipe(Schema.optionalWith({ exact: true })),
})
export type EmailSendOptions = typeof EmailSendOptions.Type
export type EmailSendOptionsEncoded = typeof EmailSendOptions.Encoded

export const EmailMessageSchema = Schema.Union(
  Schema.TaggedStruct('text', {
    options: EmailSendOptions,
    content: Schema.String,
  }),
  Schema.TaggedStruct('html', {
    options: EmailSendOptions,
    content: Schema.String,
  }),
)
export type EmailMessage = typeof EmailMessageSchema.Type
export type EmailMessageEncoded = typeof EmailMessageSchema.Encoded
export const decodeEmailMessage = Schema.decodeUnknown(EmailMessageSchema)

const PrimitiveType = Schema.Union(Schema.String, Schema.Number)
const PrimitiveVariable = Schema.Union(Schema.Redacted(PrimitiveType), ...PrimitiveType.members)
const NestedVariable = Schema.Record({ key: Schema.String, value: PrimitiveVariable })

const TemplateVariables = Schema.Record({
  key: Schema.String,
  value: Schema.Union(...PrimitiveVariable.members, NestedVariable),
})

export const EmailTemplateMessageSchema = Schema.Struct({
  options: EmailSendOptions,
  variables: TemplateVariables,
})
export type EmailTemplateMessage = typeof EmailTemplateMessageSchema.Type
export type EmailTemplateMessageEncoded = typeof EmailTemplateMessageSchema.Encoded
export const decodeTemplateEmailMessage = Schema.decodeUnknown(EmailTemplateMessageSchema)

// ----- Email Payload -----

export const EmailProviderSendOptions = Schema.Struct({
  ...EmailSendOptions.fields,
  from: Schema.NonEmptyString,
})
export type EmailProviderSendOptions = typeof EmailProviderSendOptions.Type
export const encodeEmailSendOptions = Schema.encode(EmailProviderSendOptions)

const EmailProvider = Schema.Literal('local', 'resend')

export const EmailSendPayload = Schema.Struct({
  namespace: Schema.String,
  provider: Schema.Struct({
    name: EmailProvider,
    apiKey: Schema.Redacted(Schema.String),
  }),
  message: Schema.Union(
    Schema.TaggedStruct('text', {
      options: EmailProviderSendOptions,
      content: Schema.String,
    }),
    Schema.TaggedStruct('html', {
      options: EmailProviderSendOptions,
      content: Schema.String,
    }),
  ),
})
export const EmailSendTaggedPayload = Schema.TaggedStruct('Send', {
  ...EmailSendPayload.fields,
})

export const EmailTemplateSendPayload = Schema.Struct({
  namespace: Schema.String,
  provider: Schema.Struct({
    name: EmailProvider,
    apiKey: Schema.Redacted(Schema.String),
  }),
  template: Schema.String,
  message: Schema.Struct({
    options: EmailProviderSendOptions,
    variables: TemplateVariables,
  }),
})
export const EmailTemplateSendTaggedPayload = Schema.TaggedStruct('Template', {
  ...EmailTemplateSendPayload.fields,
})

// ----- Errors -----

export class EmailSendError extends Schema.TaggedError<EmailSendError>('EmailSendError')('EmailSendError', {
  message: Schema.String,
  cause: Schema.Defect.pipe(Schema.optionalWith({ exact: true })),
}) {}
