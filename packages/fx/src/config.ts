import * as ConfigProvider from 'effect/ConfigProvider'
import type { LazyArg } from 'effect/Function'
import * as Layer from 'effect/Layer'

type Env = [string, any]

const make = (env: Record<string, any>, external: LazyArg<Array<Env>> = () => []) => {
  const builtin = [] as Array<Env>
  const normalEnv: Array<Env> = Object.entries(env)
    .filter(([_k, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => [k, v] as Env)
  const envs = normalEnv.concat(external()).concat(builtin)

  return ConfigProvider.fromMap(new Map(envs))
}

export const providerGlobalEnv =
  (env: Record<string, any>, external: LazyArg<Array<Env>> = () => []) =>
  <A, E, R>(layer: Layer.Layer<A, E, R>) =>
    Layer.provide(layer, Layer.setConfigProvider(make(env, external)))
