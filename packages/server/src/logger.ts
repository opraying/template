import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'

let level_: LogLevel.LogLevel

export function getLogLevel(options: {
  NODE_ENV?: 'development' | 'production' | undefined
  STAGE?: 'test' | 'staging' | 'production' | undefined
  LOG_LEVEL?: LogLevel.Literal | undefined
}) {
  // @ts-ignore
  const nodeENv = options.NODE_ENV ?? process.env.NODE_ENV
  // @ts-ignore
  const logLevel = options.LOG_LEVEL ?? process.env.LOG_LEVEL
  // @ts-ignore
  const stage = options.STAGE ?? process.env.STAGE

  const level = logLevel
    ? LogLevel.fromLiteral(logLevel as LogLevel.Literal)
    : nodeENv === 'development' || (stage && stage !== 'production')
      ? LogLevel.All
      : LogLevel.Warning

  return level
}

export const LoggerLive = Logger.replace(
  Logger.defaultLogger,
  // @ts-ignore
  process.env.NODE_ENV === 'production'
    ? Logger.filterLogLevel(Logger.withLeveledConsole(Logger.structuredLogger), (level) => {
        if (!level_) {
          // @ts-ignore
          level_ = getLogLevel(process.env)
        }

        return LogLevel.lessThanEqual(level_, level)
      })
    : Logger.prettyLogger({ mode: 'tty', colors: true }),
)

export const withGlobalLogLevel = (options: Parameters<typeof getLogLevel>[0] = {}) =>
  Layer.suspend(() => {
    const level = getLogLevel(options)
    level_ = level

    return Logger.minimumLogLevel(level)
  })
