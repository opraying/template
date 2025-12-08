import { spawn } from 'node:child_process'
import { Data, Effect } from 'effect'
import shellac from 'shellac'
import { CommandDescriptor } from '@effect/cli'

declare type ShellacValueInterpolation = string | boolean | undefined | number | null
declare type ShellacInterpolations =
  | ShellacValueInterpolation
  | Promise<ShellacValueInterpolation>
  | ((a: string) => void)
  | ((a: string) => Promise<void>)
  | (() => Promise<ShellacValueInterpolation>)

export class ShellExecuteError extends Data.TaggedError('ShellExecuteError')<{
  cause?: Error | undefined
}> {}

export class ProcessExecuteError extends Data.TaggedError('ProcessExecuteError')<{
  command: string
  args: string[]
  exitCode: number
  cause?: Error | undefined
}> {}

export function shell(s: TemplateStringsArray, ...interps: Array<ShellacInterpolations>) {
  return Effect.tryPromise({
    try: () => shellac(s, ...interps),
    catch: (error: any) =>
      new ShellExecuteError({
        cause: error,
      }),
  }).pipe(Effect.orDie)
}

export function shellInPath(path: string, env?: Record<string, any> | undefined, silent?: boolean | undefined) {
  return (s: TemplateStringsArray, ...interps: Array<ShellacInterpolations>) =>
    Effect.tryPromise({
      try: () => shellac.env(env ?? {}).in(path)(s, ...interps),
      catch: (error: any) =>
        new ShellExecuteError({
          cause: silent ? new Error(`shell in ${path}`) : error,
        }),
    }).pipe(Effect.orDie)
}

/**
 * Execute a command using spawnSync with stdio inheritance
 * This allows interactive processes like vitest to receive stdin properly
 */
export function execProcess(command: string, args: string[], cwd?: string) {
  return Effect.async<any, any>((resume, signal) => {
    const result = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'inherit', 'inherit'],
      signal,
    })

    return Effect.sync(() => {
      console.log('kill ')
      return result.kill()
    })
  })
}
