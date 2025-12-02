import * as Redacted from 'effect/Redacted'

export const redactedRecordInspect = (x: Record<string, any>): Record<string, any> => {
  const inspect = (obj: Record<string, any>): Record<string, any> =>
    Object.fromEntries(
      Object.entries(obj).map(([key, value_]) => {
        const isRedacted = Redacted.isRedacted(value_)
        const value = isRedacted ? Redacted.value(value_) : value_

        if (typeof value === 'object' && value !== null) {
          return [key, inspect(value)]
        }

        console.log(key, value_, isRedacted)

        return [key, isRedacted ? '<redacted>' : value]
      }),
    )

  return inspect(x)
}

export const shouldNeverHappen = (msg?: string, ...args: any[]): never => {
  console.error(msg, ...args)

  // @ts-ignore
  if (process.env.NODE_ENV === 'development') {
  }

  throw new Error(`This should never happen: ${msg}`)
}
