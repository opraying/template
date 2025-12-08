import { Context, Data, Schema } from 'effect'
import { NodeEnv, Stage } from '../core/env'

export const BuildReactRouterSchema = Schema.Struct({
  _tag: Schema.Literal('BuildReactRouter'),
  runtime: Schema.Literal('cloudflare-workers'),
  options: Schema.Struct({
    isSpaMode: Schema.Boolean,
    isDesktop: Schema.Boolean,
  }),
  stage: Stage,
})
export interface BuildReactRouterTarget extends Schema.Schema.Type<typeof BuildReactRouterSchema> {}
export const BuildReactRouterTarget = Data.tagged<BuildReactRouterTarget>('BuildReactRouter')

export interface BuildReactRouterParameters {
  readonly nodeEnv: NodeEnv
  readonly target: BuildReactRouterTarget
  readonly env: Record<string, any>
}
export const BuildReactRouterParameters = Context.GenericTag<BuildReactRouterParameters>(
  '@thing:build-react-router-parameters',
)
