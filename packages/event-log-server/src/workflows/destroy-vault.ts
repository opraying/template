import { CloudflareLive } from '@xstack/cloudflare/context'
import { makeWorkflow, Workflow, type WorkflowInstance, Workflows } from '@xstack/cloudflare/workflows'
import * as DurableObjectStorage from '@xstack/event-log-server/cloudflare/DurableObjectStorage'
import { DestroyVault } from '@xstack/event-log-server/server/destroy-vault'
import * as Storage from '@xstack/event-log-server/server/storage'
import { getUserDurableId } from '@xstack/event-log-server/server/utils'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import { flow } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

const WorkflowPrefix = 'destroy-vault'

const make = Effect.gen(function* () {
  const workflow = yield* Workflows.getWorkflow<WorkflowsBinding>('DestroyVaultWorkflow')

  const makeId = ({ namespace, userId, publicKey }: { namespace: string; userId: string; publicKey: string }) => {
    const workflowId = `${WorkflowPrefix}-${getUserDurableId(namespace, userId, publicKey)}`

    return workflowId
  }

  /**
   * 获取正在删除的 workflow instance
   */
  const getInstance = Effect.fn('destroy-vault.getInstance')(function* ({
    namespace,
    userId,
    publicKey,
  }: {
    namespace: string
    userId: string
    publicKey: string
  }) {
    const workflowId = makeId({ namespace, userId, publicKey })
    const instance = yield* workflow.get(workflowId)
    const status = yield* Option.map(instance, (instance) => instance.status).pipe(Effect.transposeOption)

    if (Option.isSome(status) && status.value.status !== 'terminated') {
      return Option.none<WorkflowInstance>()
    }

    return instance
  })

  /**
   * 如果再次访问则尝试取消删除的 workflow
   */
  const access = Effect.fn('destroy-vault.access')(function* ({
    namespace,
    userId,
    publicKey,
  }: {
    namespace: string
    userId: string
    publicKey: string
  }) {
    const instance = yield* getInstance({ namespace, userId, publicKey })

    if (Option.isNone(instance)) {
      return
    }

    yield* instance.value.terminate
  })

  /**
   * 将删除 vault 行为放入 workflow 延时执行
   */
  const destroy = Effect.fn('destroy-vault.destroy')(function* ({
    namespace,
    userId,
    publicKey,
  }: {
    namespace: string
    userId: string
    publicKey: string
  }) {
    const now = yield* DateTime.now
    const deleteAfter = DateTime.add(now, { days: 1 })

    yield* workflow.create({
      params: DestroyVaultPayload.make({
        namespace,
        userId,
        publicKey,
        deleteAfter,
      }),
    })
  })

  return {
    get: getInstance,
    access,
    destroy,
  }
})

export class DestroyVaultPayload extends Schema.Struct({
  namespace: Schema.String,
  userId: Schema.String,
  publicKey: Schema.String,
  deleteAfter: Schema.DateTimeUtc,
}) {}

export const runWorkflow = Effect.fn('destroy-vault.runWorkflow')(function* ({
  namespace,
  userId,
  publicKey,
  deleteAfter,
}: typeof DestroyVaultPayload.Type) {
  const workflow = yield* Workflow
  const storage = yield* Storage.Storage

  yield* workflow.sleepUntil('wait', deleteAfter)

  yield* workflow.do('destroy', storage.destroy({ namespace, userId, publicKey }))
})

const WorkflowLive = DurableObjectStorage.Live.pipe(Layer.provide(CloudflareLive))

export const DestroyVaultWorkflow = makeWorkflow(
  { binding: 'DESTROY_VAULT_WORKFLOW', schema: DestroyVaultPayload },
  flow(runWorkflow, Effect.provide(WorkflowLive)),
)

export const Live = Layer.effect(DestroyVault, make).pipe(
  Layer.provide(Workflows.fromRecord(() => ({ DestroyVaultWorkflow }) satisfies Partial<WorkflowsBinding>)),
)
