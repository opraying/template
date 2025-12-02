/**
 * Common utility functions for the app-kit package
 * These utilities provide shared functionality across different modules
 */

/**
 * Type for functions that can be debounced
 */
export type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void
  cancel(): void
  flush(): void
}

/**
 * Advanced debounce utility with cancellation and immediate execution support
 * @param func - Function to debounce
 * @param wait - Debounce delay in milliseconds
 * @param options - Debounce options
 * @returns Debounced function with additional methods
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {},
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null
  let lastCallTime: number | null = null
  let lastInvokeTime = 0
  let result: ReturnType<T>

  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs
    const thisArg = lastThis

    lastArgs = lastThis = null
    lastInvokeTime = time
    // @ts-ignore
    result = func.apply(thisArg, args)
    return result
  }

  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - (lastCallTime || 0)
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }

  function timerExpired(): ReturnType<T> | undefined {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }

    // Restart the timer
    const timeSinceLastCall = time - (lastCallTime || 0)
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall
    const remainingWait = maxWait === undefined ? timeWaiting : Math.min(timeWaiting, maxWait - timeSinceLastInvoke)

    timeoutId = setTimeout(timerExpired, remainingWait)
    return result
  }

  function trailingEdge(time: number): ReturnType<T> {
    timeoutId = null

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = lastThis = null
    return result
  }

  function leadingEdge(time: number): ReturnType<T> {
    lastInvokeTime = time
    timeoutId = setTimeout(timerExpired, wait)

    if (maxWait !== undefined) {
      maxTimeoutId = setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        trailingEdge(Date.now())
      }, maxWait)
    }

    return leading ? invokeFunc(time) : result
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId)
      maxTimeoutId = null
    }
    lastInvokeTime = 0
    lastArgs = lastThis = lastCallTime = null
  }

  function flush(): ReturnType<T> {
    if (timeoutId === null) {
      return result
    }
    return trailingEdge(Date.now())
  }

  function debounced(this: any, ...args: Parameters<T>): void {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime)
      }
      if (maxWait !== undefined) {
        timeoutId = setTimeout(timerExpired, wait)
        return invokeFunc(lastCallTime)
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait)
    }
  }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced as DebouncedFunction<T>
}

/**
 * Throttle utility for limiting function calls
 * @param func - Function to throttle
 * @param wait - Throttle interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(func: T, wait: number): DebouncedFunction<T> {
  return debounce(func, wait, { leading: true, trailing: true, maxWait: wait })
}

/**
 * Safe environment detection utilities
 */
export const environment = {
  /**
   * Check if we're in a browser environment
   */
  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  },

  /**
   * Check if we're in a Node.js environment
   */
  get isNode(): boolean {
    // @ts-ignore
    return typeof process !== 'undefined' && process.versions?.node != null
  },

  /**
   * Check if we're in a web worker
   */
  get isWebWorker(): boolean {
    // @ts-ignore
    return typeof self !== 'undefined' && typeof importScripts === 'function'
  },

  /**
   * Check if we're in a React Native environment
   */
  get isReactNative(): boolean {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
  },

  /**
   * Check if touch events are supported
   */
  get isTouchDevice(): boolean {
    if (!this.isBrowser) return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  /**
   * Check if we're on a mobile device (basic detection)
   */
  get isMobileDevice(): boolean {
    if (!this.isBrowser) return false
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  },
}

/**
 * Type guard utility functions
 */
export const typeGuards = {
  /**
   * Check if value is null or undefined
   */
  isNullish<T>(value: T | null | undefined): value is null | undefined {
    return value == null
  },

  /**
   * Check if value is not null or undefined
   */
  isNotNullish<T>(value: T | null | undefined): value is T {
    return value != null
  },

  /**
   * Check if value is a string
   */
  isString(value: unknown): value is string {
    return typeof value === 'string'
  },

  /**
   * Check if value is a number
   */
  isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  },

  /**
   * Check if value is a boolean
   */
  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean'
  },

  /**
   * Check if value is an object (not null, not array)
   */
  isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      value !== null &&
      typeof value === 'object' &&
      value.constructor === Object &&
      Object.getPrototypeOf(value) === Object.prototype
    )
  },

  /**
   * Check if value is an array
   */
  isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value)
  },

  /**
   * Check if value is a function
   */
  isFunction(value: unknown): value is (...args: any[]) => any {
    return typeof value === 'function'
  },

  /**
   * Check if value is a promise
   */
  isPromise<T>(value: unknown): value is Promise<T> {
    return (
      value instanceof Promise ||
      (value != null && typeof value === 'object' && typeof (value as any).then === 'function')
    )
  },
}

/**
 * Array utility functions
 */
export const arrayUtils = {
  /**
   * Remove duplicates from array based on identity or key function
   */
  unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
    if (!keyFn) {
      return [...new Set(array)]
    }

    const seen = new Set()
    return array.filter((item) => {
      const key = keyFn(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  },

  /**
   * Group array items by a key function
   */
  groupBy<T, K extends string | number | symbol>(array: T[], keyFn: (item: T) => K): Record<K, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item)
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(item)
        return groups
      },
      {} as Record<K, T[]>,
    )
  },

  /**
   * Split array into chunks of specified size
   */
  chunk<T>(array: T[], size: number): T[][] {
    if (size <= 0) {
      throw new Error('Chunk size must be positive')
    }

    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  },

  /**
   * Get random item from array
   */
  sample<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined
    return array[Math.floor(Math.random() * array.length)]
  },

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  },
}

/**
 * Object utility functions
 */
export const objectUtils = {
  /**
   * Deep clone an object (handles circular references)
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    // Handle Date
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any
    }

    // Handle Array
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as any
    }

    // Handle Object
    if (typeof obj === 'object') {
      const cloned = {} as any
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = this.deepClone((obj as any)[key])
        }
      }
      return cloned
    }

    return obj
  },

  /**
   * Pick specific keys from object
   */
  pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key]
      }
    }
    return result
  },

  /**
   * Omit specific keys from object
   */
  omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj } as any
    for (const key of keys) {
      delete result[key]
    }
    return result
  },

  /**
   * Get nested value from object using dot notation
   */
  get<T>(obj: any, path: string, defaultValue?: T): T {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
      if (result == null || typeof result !== 'object') {
        return defaultValue as T
      }
      result = result[key]
    }

    return result === undefined ? (defaultValue as T) : result
  },

  /**
   * Check if object has nested property
   */
  has(obj: any, path: string): boolean {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return false
      }
      current = current[key]
    }

    return true
  },
}

/**
 * String utility functions
 */
export const stringUtils = {
  /**
   * Capitalize first letter of string
   */
  capitalize(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  },

  /**
   * Convert string to camelCase
   */
  camelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => (index === 0 ? word.toLowerCase() : word.toUpperCase()))
      .replace(/\s+/g, '')
  },

  /**
   * Convert string to kebab-case
   */
  kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  },

  /**
   * Convert string to snake_case
   */
  snakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
  },

  /**
   * Truncate string with ellipsis
   */
  truncate(str: string, length: number, suffix = '...'): string {
    if (str.length <= length) return str
    return str.slice(0, length - suffix.length) + suffix
  },

  /**
   * Generate random string
   */
  random(length: number = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },
}

/**
 * Number utility functions
 */
export const numberUtils = {
  /**
   * Clamp number between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  },

  /**
   * Round number to specific decimal places
   */
  round(value: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  },

  /**
   * Check if number is in range (inclusive)
   */
  inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max
  },

  /**
   * Format number with thousands separator
   */
  format(value: number, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale).format(value)
  },

  /**
   * Generate random number between min and max
   */
  random(min: number = 0, max: number = 1): number {
    return Math.random() * (max - min) + min
  },

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
}

/**
 * Error handling utilities
 */
export const errorUtils = {
  /**
   * Create error with additional context
   */
  createError(message: string, context?: Record<string, any>): Error {
    const error = new Error(message)
    if (context) {
      Object.assign(error, { context })
    }
    return error
  },

  /**
   * Safely execute function and return result or error
   */
  tryCatch<T, E = Error>(fn: () => T, onError?: (error: E) => T): T | E {
    try {
      return fn()
    } catch (error) {
      if (onError) {
        return onError(error as E)
      }
      return error as E
    }
  },

  /**
   * Async version of tryCatch
   */
  async asyncTryCatch<T, E = Error>(fn: () => Promise<T>, onError?: (error: E) => T | Promise<T>): Promise<T | E> {
    try {
      return await fn()
    } catch (error) {
      if (onError) {
        return await onError(error as E)
      }
      return error as E
    }
  },
}

/**
 * Performance measurement utilities
 */
export const performanceUtils = {
  /**
   * Measure execution time of a function
   */
  measure<T>(name: string, fn: () => T): T {
    if (!environment.isBrowser || !performance.mark) {
      return fn()
    }

    const startMark = `${name}-start`
    const endMark = `${name}-end`
    const measureName = `${name}-measure`

    performance.mark(startMark)
    const result = fn()
    performance.mark(endMark)
    performance.measure(measureName, startMark, endMark)

    return result
  },

  /**
   * Async version of measure
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!environment.isBrowser || !performance.mark) {
      return await fn()
    }

    const startMark = `${name}-start`
    const endMark = `${name}-end`
    const measureName = `${name}-measure`

    performance.mark(startMark)
    const result = await fn()
    performance.mark(endMark)
    performance.measure(measureName, startMark, endMark)

    return result
  },
}
