import { exec, execSync } from 'node:child_process'
import { Data, Effect } from 'effect'
import {} from '@effect/platform'
import shellac from 'shellac'

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

export function shellEnv(pwd: string, env: Record<string, any>) {
  return (s: TemplateStringsArray, ...interps: Array<ShellacInterpolations>) =>
    Effect.tryPromise({
      try: () => shellac.env(env).in(pwd)(s, ...interps),
      catch: (error: any) =>
        new ShellExecuteError({
          cause: error,
        }),
    }).pipe(Effect.orDie)
}

export function shellInPath(path: string) {
  return (s: TemplateStringsArray, ...interps: Array<ShellacInterpolations>) =>
    Effect.tryPromise({
      try: () => shellac.in(path)(s, ...interps),
      catch: (error: any) =>
        new ShellExecuteError({
          cause: error,
        }),
    }).pipe(Effect.orDie)
}

/**
 * Execute a command using spawnSync with stdio inheritance
 * This allows interactive processes like vitest to receive stdin properly
 */
export function execProcess(command: string, args: string[], cwd?: string) {
  return Effect.async<any, any>((resume, signal) => {
    const result = exec(
      `${command} ${args.join(' ')}`,
      {
        cwd,
        signal,
      },
      (error) => {
        if (error) {
          resume(
            Effect.fail(
              new ProcessExecuteError({
                command,
                args,
                exitCode: 1,
                cause: error,
              }),
            ),
          )
        }

        return resume(Effect.void)
      },
    )

    result.addListener('message', (data) => {
      console.log(data.toString())
    })

    return Effect.sync(() => result.kill())
  })
}
