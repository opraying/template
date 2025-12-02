/**
 * PWA Error Categories for business logic handling
 */
export const PwaErrorCategory = {
  CACHE: 'CACHE',
  DATA: 'DATA',
  SERVER: 'SERVER',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN',
} as const

export type PwaErrorCategory = (typeof PwaErrorCategory)[keyof typeof PwaErrorCategory]

/**
 * Specific PWA Error Codes for fine-grained error handling
 */
export const PwaErrorCode = {
  // Network related errors
  NETWORK_REQUEST_FAILED: 'NETWORK_REQUEST_FAILED',

  // Server related errors
  SERVER_ERROR_4XX: 'SERVER_ERROR_4XX',
  SERVER_ERROR_5XX: 'SERVER_ERROR_5XX',
  SERVER_RESPONSE_INVALID: 'SERVER_RESPONSE_INVALID',

  // Cache related errors
  CACHE_WRITE_FAILED: 'CACHE_WRITE_FAILED',
  CACHE_READ_FAILED: 'CACHE_READ_FAILED',

  // Data related errors
  DATA_DECODE_FAILED: 'DATA_DECODE_FAILED',
  DATA_ENCODE_FAILED: 'DATA_ENCODE_FAILED',
  DATA_VALIDATION_FAILED: 'DATA_VALIDATION_FAILED',
  DATA_EMPTY: 'DATA_EMPTY',

  // Route related errors
  ROUTE_PARAMS_INVALID: 'ROUTE_PARAMS_INVALID',
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  // Fallback related
  FALLBACK_DATA_USED: 'FALLBACK_DATA_USED',
} as const

export type PwaErrorCode = (typeof PwaErrorCode)[keyof typeof PwaErrorCode]

/**
 * Error metadata for business logic processing
 */
export interface PwaErrorMetadata {
  category: PwaErrorCategory
  code: PwaErrorCode
  userMessage?: string | undefined
}

/**
 * Enhanced PWA error class with business logic encoding
 */
export class PwaError extends Error {
  public readonly metadata: PwaErrorMetadata
  public readonly originalError?: unknown
  public readonly timestamp: number
  public readonly context: string

  constructor(message: string, metadata: PwaErrorMetadata, context: string, originalError?: unknown) {
    super(message)
    this.name = 'PwaBusinessError'
    this.metadata = metadata
    this.originalError = originalError
    this.timestamp = Date.now()
    this.context = context
  }

  /**
   * Enhanced error formatter for better debugging and logging
   */
  format(): string {
    const lines = [
      `[${this.metadata.category}:${this.metadata.code}] ${this.message}`,
      `Context: ${this.context}`,
      `Timestamp: ${new Date(this.timestamp).toISOString()}`,
    ]

    if (this.metadata.userMessage && this.metadata.userMessage !== this.message) {
      lines.push(`User Message: ${this.metadata.userMessage}`)
    }

    if (this.originalError) {
      const errorInfo = this.formatOriginalError()
      if (errorInfo) {
        lines.push(`Original Error: ${errorInfo}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Format original error for inclusion in logs
   */
  private formatOriginalError(): string {
    if (!this.originalError) return ''

    if (this.originalError instanceof Error) {
      return `${this.originalError.name}: ${this.originalError.message}${
        this.originalError.stack ? `\n${this.originalError.stack}` : ''
      }`
    }

    if (typeof this.originalError === 'string') {
      return this.originalError
    }

    try {
      return JSON.stringify(this.originalError, null, 2)
    } catch {
      return String(this.originalError)
    }
  }

  /**
   * Create stack trace information for business error
   */
  private createStackTrace(): string {
    const stackLines = [
      `PWA Error Stack:`,
      `  Category: ${this.metadata.category}`,
      `  Code: ${this.metadata.code}`,
      `  Context: ${this.context}`,
      `  Timestamp: ${new Date(this.timestamp).toISOString()}`,
    ]

    if (this.originalError instanceof Error && this.originalError.stack) {
      stackLines.push(`  Original Stack:`)
      const originalStackLines = this.originalError.stack.split('\n')
      originalStackLines.forEach((line) => {
        if (line.trim()) {
          stackLines.push(`    ${line.trim()}`)
        }
      })
    } else if (this.originalError) {
      stackLines.push(`  Original Error: ${String(this.originalError)}`)
    }

    return stackLines.join('\n')
  }

  toStandardError() {
    // Create comprehensive error message that includes context and debug info
    let enhancedMessage = this.message

    // Append user-friendly message if different from technical message
    if (this.metadata.userMessage && this.metadata.userMessage !== this.message) {
      enhancedMessage += ` (User: ${this.metadata.userMessage})`
    }

    // Create detailed cause message following standard format: "CATEGORY CODE in context | Debug: {...}"
    let causeMessage = `${this.metadata.category} ${this.metadata.code} in ${this.context}`

    const result = {
      _tag: 'InternalServerError',
      message: enhancedMessage,
      stack: this.createStackTrace(),
      cause: {
        message: causeMessage,
      },
    }
    return result
  }
}

/**
 * Error factory for creating categorized PWA errors
 */
export class PwaErrorFactory {
  /**
   * Generic error creation method to reduce boilerplate
   */
  private static createError(
    category: PwaErrorCategory,
    code: PwaErrorCode,
    context: string,
    details?: Record<string, any>,
    originalError?: unknown,
  ): PwaError {
    const metadata: PwaErrorMetadata = {
      category,
      code,
      userMessage: this.getUserMessage(code),
    }

    return new PwaError(this.getErrorMessage(code, context), metadata, context, originalError)
  }

  /**
   * Create server-related error
   */
  static createServerError(
    code: PwaErrorCode,
    context: string,
    details?: { status?: number; statusText?: string; hasCache?: boolean },
    originalError?: unknown,
  ): PwaError {
    return this.createError(PwaErrorCategory.SERVER, code, context, details, originalError)
  }

  /**
   * Create cache-related error
   */
  static createCacheError(
    code: PwaErrorCode,
    context: string,
    details?: { operation?: string; cacheName?: string },
    originalError?: unknown,
  ): PwaError {
    return this.createError(PwaErrorCategory.CACHE, code, context, details, originalError)
  }

  /**
   * Create data-related error
   */
  static createDataError(
    code: PwaErrorCode,
    context: string,
    details?: { dataType?: string; hasCache?: boolean },
    originalError?: unknown,
  ): PwaError {
    return this.createError(PwaErrorCategory.DATA, code, context, details, originalError)
  }

  /**
   * Create validation-related error
   */
  static createValidationError(
    code: PwaErrorCode,
    context: string,
    details?: { field?: string; expected?: string; actual?: string },
    originalError?: unknown,
  ): PwaError {
    return this.createError(PwaErrorCategory.VALIDATION, code, context, details, originalError)
  }

  /**
   * Create unknown error
   */
  static createUnknownError(context: string, originalError?: unknown): PwaError {
    return this.createError(
      PwaErrorCategory.UNKNOWN,
      PwaErrorCode.UNKNOWN_ERROR,
      context,
      { originalError: String(originalError) },
      originalError,
    )
  }

  /**
   * Create fallback data usage info (treated as warning, not error)
   */
  static createFallbackUsed(context: string, reason: string): PwaError {
    return this.createError(PwaErrorCategory.DATA, PwaErrorCode.FALLBACK_DATA_USED, context, { reason })
  }

  /**
   * Get error message for code
   */
  private static getErrorMessage(code: PwaErrorCode, context: string): string {
    const messages: Record<PwaErrorCode, string> = {
      [PwaErrorCode.NETWORK_REQUEST_FAILED]: `Network request failed in ${context}`,
      [PwaErrorCode.SERVER_ERROR_4XX]: `Client error from server in ${context}`,
      [PwaErrorCode.SERVER_ERROR_5XX]: `Server error in ${context}`,
      [PwaErrorCode.SERVER_RESPONSE_INVALID]: `Invalid server response in ${context}`,
      [PwaErrorCode.CACHE_WRITE_FAILED]: `Failed to write to cache in ${context}`,
      [PwaErrorCode.CACHE_READ_FAILED]: `Failed to read from cache in ${context}`,
      [PwaErrorCode.DATA_DECODE_FAILED]: `Failed to decode data in ${context}`,
      [PwaErrorCode.DATA_ENCODE_FAILED]: `Failed to encode data in ${context}`,
      [PwaErrorCode.DATA_VALIDATION_FAILED]: `Data validation failed in ${context}`,
      [PwaErrorCode.DATA_EMPTY]: `Data is empty in ${context}`,
      [PwaErrorCode.ROUTE_PARAMS_INVALID]: `Invalid route parameters in ${context}`,
      [PwaErrorCode.UNKNOWN_ERROR]: `Unknown error in ${context}`,
      [PwaErrorCode.FALLBACK_DATA_USED]: `Using fallback data in ${context}`,
    }

    return messages[code] || `Unknown error code ${code} in ${context}`
  }

  /**
   * Get user-friendly message for code
   */
  private static getUserMessage(code: PwaErrorCode): string {
    const userMessages: Record<PwaErrorCode, string> = {
      [PwaErrorCode.NETWORK_REQUEST_FAILED]: 'Unable to connect to the server. Please check your connection.',
      [PwaErrorCode.SERVER_ERROR_4XX]: 'There was a problem with your request. Please try again.',
      [PwaErrorCode.SERVER_ERROR_5XX]: 'The server encountered an error. Please try again later.',
      [PwaErrorCode.SERVER_RESPONSE_INVALID]: 'Received invalid data from the server. Please try again.',
      [PwaErrorCode.CACHE_WRITE_FAILED]: 'Unable to save content for offline use.',
      [PwaErrorCode.CACHE_READ_FAILED]: 'Unable to load cached content.',
      [PwaErrorCode.DATA_DECODE_FAILED]: 'Unable to process the received data.',
      [PwaErrorCode.DATA_ENCODE_FAILED]: 'Unable to prepare data for transmission.',
      [PwaErrorCode.DATA_VALIDATION_FAILED]: 'The data received is invalid.',
      [PwaErrorCode.DATA_EMPTY]: 'No data available.',
      [PwaErrorCode.ROUTE_PARAMS_INVALID]: 'Invalid page parameters.',
      [PwaErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
      [PwaErrorCode.FALLBACK_DATA_USED]: 'Using offline fallback data.',
    }

    return userMessages[code] || 'An error occurred. Please try again.'
  }
}

export class ServiceUnavailableError {
  readonly _tag: 'ServiceUnavailableError'
  readonly name: string
  readonly message: string

  constructor(message: string) {
    this._tag = 'ServiceUnavailableError'
    this.name = 'ServiceUnavailableError'
    this.message = message
  }
}
