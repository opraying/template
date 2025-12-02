/**
 * 将不同来源和类型的错误转换为标准化格式，确保整个应用程序
 * 都能以一致的方式处理和展示错误信息。
 */
import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import * as SqlError from '@effect/sql/SqlError'
import { BadRequestError, InternalServerError } from '@xstack/errors/server'
import * as Cause from 'effect/Cause'
import * as ParseResult from 'effect/ParseResult'
import * as Predicate from 'effect/Predicate'
import * as SchemaAST from 'effect/SchemaAST'
import type { StandardError } from './domains'

/**
 * 检查是否为Effect ParseError
 */
export function isParseError(error: unknown): error is ParseResult.ParseError {
  return error != null && typeof error === 'object' && '_tag' in error && error._tag === 'ParseError'
}

/**
 * 检查是否为SQL错误
 */
export function isSqlError(error: unknown): error is SqlError.SqlError {
  return error != null && typeof error === 'object' && '_tag' in error && error._tag === 'SqlError'
}

/**
 * 检查是否为带标签的错误
 */
export function isTaggedError(error: unknown): error is { _tag: string; message: string; [key: string]: any } {
  return error != null && typeof error === 'object' && '_tag' in error && 'message' in error
}

export function isStandardError(error: unknown): error is StandardError {
  return error != null && typeof error === 'object' && '_tag' in error && 'message' in error && 'metadata' in error
}

/**
 * 格式化错误为标准格式
 */
export function encode(cause: any): StandardError {
  // @ts-ignore
  const isProduction = process.env.STAGE === 'production'

  // 如果已经是标准化错误
  if (isStandardError(cause)) {
    return cause
  }

  const renderCause = (cause: any): any => {
    if (!isProduction && cause && (cause.message || cause.stack)) {
      return {
        message: cause.message,
        stack: cause.stack,
      }
    }

    return {}
  }

  const renderStack = (error: any, cause: any) => {
    return isProduction
      ? undefined
      : (Cause.isCause(cause) && Cause.pretty(cause, { renderErrorCause: true })) || error.stack
  }

  const formatError = (error: unknown, cause?: Cause.Cause<any> | undefined): StandardError => {
    if (isTaggedError(error)) {
      if (isParseError(error)) {
        return {
          _tag: BadRequestError._tag,
          message: error.message || '',
          stack: renderStack(error, cause),
          cause: renderCause(error.cause),
          status: 400,
          issues: ParseResult.ArrayFormatter.formatErrorSync(error) as any,
          path: [],
        } satisfies StandardError
      }

      if (isSqlError(error)) {
        return {
          _tag: InternalServerError._tag,
          message: error.message || '',
          stack: renderStack(error, cause),
          cause: renderCause(error.cause),
          issues: [],
          path: [],
        } satisfies StandardError
      }

      let annotationStatus = error.status || error.code
      if (Predicate.hasProperty(error, 'constructor') && Predicate.hasProperty(error.constructor, 'ast')) {
        const ast = error.constructor.ast as SchemaAST.AST
        annotationStatus = HttpApiSchema.getStatus(ast, 500)
      }

      return {
        _tag: error._tag,
        message: error.message || '',
        status: annotationStatus,
        stack: renderStack(error, cause),
        cause: renderCause(error.cause),
        issues: error.issues ?? [],
        path: error.path ?? [],
      } satisfies StandardError
    }

    const err = error instanceof Error ? error : new Error(error as any)

    return {
      _tag: InternalServerError._tag,
      message: err.message || '',
      stack: renderStack(err, cause),
      cause: renderCause(err.cause),
      issues: [],
      path: [],
    } satisfies StandardError
  }

  return Cause.isCause(cause)
    ? Cause.match(cause, {
        onDie: (error) => formatError(error, cause),
        onFail: (error) => formatError(error, cause),
        onEmpty: formatError(new Error('Empty'), cause),
        onInterrupt: (fiberId) => formatError(new Error(`Interrupted by ${fiberId}`), cause),
        onParallel: (a, b) => a || b,
        onSequential: (a, b) => a || b,
      })
    : formatError(cause)
}
