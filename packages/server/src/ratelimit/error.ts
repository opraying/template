import * as Data from 'effect/Data'

export class RatelimitError extends Data.TaggedError('RatelimitError')<{
  readonly reason: 'RemainingLimitExceeded' | 'UnknownError'
  readonly message: string
  readonly headers: {
    remaining?: number | undefined
    limit?: number | undefined
    reset?: number | undefined
  }
  readonly cause?: Error | unknown | undefined
}> {
  readonly code = 429
}
