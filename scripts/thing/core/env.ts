import { Schema } from 'effect'

export const Stage = Schema.Literal('production', 'staging', 'test')
export type Stage = typeof Stage.Type

export const NodeEnv = Schema.Literal('development', 'production')
export type NodeEnv = typeof NodeEnv.Type
