import type { EmailProviderSendOptions, EmailSendError } from '@xstack/server/emailer/schema'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { identity } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'

export interface EmailerProvider {
  readonly text: (options: EmailProviderSendOptions, content: string) => Effect.Effect<void, EmailSendError, never>
  readonly html: (options: EmailProviderSendOptions, content: string) => Effect.Effect<void, EmailSendError, never>
}
export const EmailerProvider = Context.GenericTag<EmailerProvider>('@server:emailer-provider')

export class EmailerMultiProvider extends Context.Tag('@server:emailer-multi-provider')<
  EmailerMultiProvider,
  {
    readonly use: (name: string, env: Record<string, any>) => Effect.Effect<EmailerProvider, never, never>
  }
>() {
  static make<T extends Record<string, Layer.Layer<EmailerProvider>>>(providers: T) {
    return Layer.succeed(EmailerMultiProvider, {
      use: (name: keyof T, env: Record<string, any>) =>
        Effect.provide(
          Effect.map(EmailerProvider, identity),
          Layer.merge(providers[name], Layer.setConfigProvider(ConfigProvider.fromJson(serializeEnvValue(env)))),
        ),
    })
  }
}

const serializeEnvValue = (env: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, Redacted.isRedacted(value) ? Redacted.value(value) : value]),
  )

// ----- Resend -----

// Status: 400
// Message: We found an error with one or more fields in the request.
// Suggested action: The message will contain more details about what field and error we found.
//
// missing_api_key
// Status: 401
// Message: Missing API key in the authorization header.
// Suggested action: Include the following header in the request: Authorization: Bearer YOUR_API_KEY.
//
// restricted_api_key
// Status: 401
// Message: This API key is restricted to only send emails.
// Suggested action: Make sure the API key has Full access to perform actions other than sending emails.
//
// validation_error
// Status: 403
// Message: You can only send testing emails to your own email address (youremail@domain.com).
// Suggested action: In Resend’s Domain page, add and verify a domain for which you have DNS access. This allows you to send emails to addresses beyond your own.
//
// not_found
// Status: 404
// Message: The requested endpoint does not exist.
// Suggested action: Change your request URL to match a valid API endpoint.
//
// invalid_attachment
// Status: 422
// Message: Attachment must have either a content or path.
// Suggested action: Attachments must either have a content (strings, Buffer, or Stream contents) or path to a remote resource (better for larger attachments).
//
// missing_required_field
// Status: 422
// Message: The request body is missing one or more required fields.
// Suggested action: Check the error message to see the list of missing fields.
//
// daily_quota_exceeded
// Status: 429
// Message: You have reached your daily email sending quota.
// Suggested action: Upgrade your plan to remove the daily quota limit or wait until 24 hours have passed to continue sending.
//
// rate_limit_exceeded
// Status: 429
// Message: Too many requests. Please limit the number of requests per second. Or contact support to increase rate limit.
// Suggested action: You should read the response headers and reduce the rate at which you request the API. This can be done by introducing a queue mechanism or reducing the number of concurrent requests per second. If you have specific requirements, contact support to request a rate increase.
//
// security_error
// Status: 451
// Message: We may have found a security issue with the request.
// Suggested action: The message will contain more details. Contact support for more information.
//
// application_error
// Status: 500
// Message: An unexpected error occurred.
// Suggested action: Try the request again later. If the error does not resolve, check our status page for service updates.

type ResendErrorResponse<T extends string, code extends number> = {
  name: T
  statusCode: code
  message: string
}

export type ResendError =
  | ResendErrorResponse<'validation_error', 400>
  | ResendErrorResponse<'missing_api_key', 401>
  | ResendErrorResponse<'restricted_api_key', 401>
  | ResendErrorResponse<'validation_error', 403>
  | ResendErrorResponse<'not_found', 404>
  | ResendErrorResponse<'invalid_attachment', 422>
  | ResendErrorResponse<'missing_required_field', 422>
  | ResendErrorResponse<'daily_quota_exceeded', 429>
  | ResendErrorResponse<'rate_limit_exceeded', 429>
  | ResendErrorResponse<'security_error', 451>
  | ResendErrorResponse<'application_error', 500>

/**
 * List of non-retryable email errors that should fail immediately
 */
const nonRetryableEmailErrors = [
  'template_notfound',

  // Non-retryable Resend API errors
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'not_found',
  'invalid_attachment',
  'missing_required_field',
  'daily_quota_exceeded',
  // Retryable Resend errors (commented out):
  // "rate_limit_exceeded",
  // "security_error",
  // "application_error",
]

export const isNonRetryableEmailError = (error: EmailSendError) => {
  const cause = error.cause

  if (cause instanceof Error && nonRetryableEmailErrors.some((errorName) => cause.name.includes(errorName))) {
    return true
  }

  return false
}
