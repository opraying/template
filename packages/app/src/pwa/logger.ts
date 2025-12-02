/**
 * PWA Logger System
 * Provides unified logging for PWA functionality with configurable output levels
 */

export interface PwaLoggerConfig {
  enabled: () => boolean
  level: 'debug' | 'info' | 'warn' | 'error'
  prefix: string
  groupCollapsed: boolean
}

const DEFAULT_CONFIG: PwaLoggerConfig = {
  enabled: () => {
    return (
      (typeof window !== 'undefined' && window.localStorage?.getItem('pwa-debug') === 'true') ||
      new URLSearchParams(window.location?.search || '').has('pwa-debug')
    )
  },
  level: 'info',
  prefix: '🔧 PWA',
  groupCollapsed: false,
}

export class PwaLogger {
  private config: PwaLoggerConfig

  constructor(config: Partial<PwaLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private shouldLog(level: string): boolean {
    if (!this.config.enabled()) return false

    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)

    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(level: string, context: string, message: string): string {
    const emoji =
      {
        debug: '🔍',
        info: '📋',
        warn: '⚠️',
        error: '❌',
      }[level] || '📝'

    return `${this.config.prefix} ${emoji} ${context}: ${message}`
  }

  debug(context: string, message: string, data?: any): void {
    if (!this.shouldLog('debug')) return
    console.debug(this.formatMessage('debug', context, message), data || '')
  }

  info(context: string, message: string, data?: any): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatMessage('info', context, message), data || '')
  }

  warn(context: string, message: string, data?: any): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage('warn', context, message), data || '')
  }

  error(context: string, message: string, data?: any): void {
    if (!this.shouldLog('error')) return
    console.error(this.formatMessage('error', context, message), data || '')
  }

  group(context: string, message: string): void {
    if (!this.shouldLog('info')) return
    if (this.config.groupCollapsed) {
      console.groupCollapsed(this.formatMessage('info', context, message))
    } else {
      console.group(this.formatMessage('info', context, message))
    }
  }

  groupEnd(): void {
    if (!this.shouldLog('info')) return
    console.groupEnd()
  }

  table(context: string, message: string, data: any): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatMessage('info', context, message))
    console.table(data)
  }
}
