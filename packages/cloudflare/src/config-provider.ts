import * as ConfigProvider from 'effect/ConfigProvider'
import type { LazyArg } from 'effect/Function'

type Env = [string, any]

export const makeConfigProvider = (env: Record<string, any>, external: LazyArg<Array<Env>> = () => []) => {
  const builtin = [] as Array<Env>
  const normalEnv: Array<Env> = Object.entries(env)
    .filter(([_k, v]) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => [k, v] as Env)
  const envs = normalEnv.concat(external()).concat(builtin)

  return ConfigProvider.fromMap(new Map(envs))
}
