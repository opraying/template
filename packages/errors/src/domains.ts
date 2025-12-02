/**
 * 标准化错误类型
 */
export type StandardError = {
  _tag: string
  message: string
  status?: number | undefined
  stack?: string | undefined
  path?: string[] | undefined
  issues?: ReadonlyArray<{ _tag: string; message: string; path: ReadonlyArray<string> }> | undefined
  cause?:
    | {
        message: string
        stack?: string | undefined
      }
    | undefined
}
