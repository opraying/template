/**
 * 解码任意错误为标准化错误
 *
 * 这是错误边界的主要解码方法，能够处理各种类型的错误
 */
import { isStandardError } from '@xstack/errors/encoder'
import { type StandardError } from './domains'

export function decodeError(error: any): StandardError {
  if (isStandardError(error)) {
    return error
  }

  return {
    _tag: error._tag,
    message: error.message ?? '',
    cause: error.cause,
    status: error.code,
    issues: error.issues ?? [],
    path: error.path ?? [],
    stack: error.stack,
  } satisfies StandardError
}
