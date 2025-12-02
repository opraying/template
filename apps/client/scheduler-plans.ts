import type { ResourcePlan } from '@xstack/fx/worker/scheduler/handle'
import type * as Effect from 'effect/Effect'

export const plans: ResourcePlan<Effect.Effect<void, never, never>, Effect.Effect<void, never, never>>[] = []
