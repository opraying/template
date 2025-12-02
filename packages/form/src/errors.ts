import { parseIssues } from '@xstack/form/resolver/standard-schema'
import { toNestErrors } from '@xstack/form/utils'
import * as Effect from 'effect/Effect'
import * as ParseResult from 'effect/ParseResult'

export const makeFormErrors = <T extends Record<string, ParseResult.ParseIssue>>(errors: T) => {
  const issues: ParseResult.ParseIssue[] = Object.entries(errors).map(([key, value]) => {
    return new ParseResult.Pointer(key, value.actual, value)
  })

  const arrayIssues = Effect.runSync(Effect.all(issues.map((_) => ParseResult.ArrayFormatter.formatIssue(_)))).flat(1)

  const fieldErrors = parseIssues(arrayIssues, false)

  return toNestErrors<{ [key in keyof T]: string }>(fieldErrors, {} as any)
}
