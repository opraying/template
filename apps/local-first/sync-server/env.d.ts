import type * as LogLevel from 'effect/LogLevel'

declare global {
  var process: {
    env: {
      NODE_ENV: 'development' | 'production'
      STAGE: 'test' | 'staging' | 'production'
      LOG_LEVEL: LogLevel.Literal
    }
  }
}
