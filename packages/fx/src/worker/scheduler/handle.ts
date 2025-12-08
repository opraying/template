import * as Effect from 'effect/Effect'
import type * as Request from 'effect/Request'
import type * as Schema from 'effect/Schema'
import * as String from 'effect/String'

/**
 *  定义命令handle (Give)
 * 从 event hub 中获取事件过滤当前定义的事件
 *  - 触发时机 （When)
 *  - 事件处理 (Then)
 */

/**
 * Plan 可以有两个执行时机函数
 * - 定义立即执行 (immediate)
 * - 定义后台任务 (background)
 */
export interface Plan {
  readonly name: string

  readonly commands: CommandRequestHandle<any>[]

  readonly events: EventRequestHandle<any>[]

  readonly immediate: Effect.Effect<void, any, any>

  readonly background: Effect.Effect<void, any, any>
}

// 定义表结构
// 定义远程资源 -> 本地表结构

// get: () => Local || Remote(sync) Parallel
// sync: () => RemoteResource -> Insert into table
// onModify: (resource: RemoteResource) => void

// cloudflare (worker) -> local first sync server (sqlite)
// receive event       -> insert into table

// UI -> local first sync server (sqlite)
// Event -> Cloudflare (worker)

type TableFields = Record<string, Schema.Schema<any>>

abstract class RemoteResource {
  readonly name: string
  constructor(
    name: string,
    // readonly remoteSchema: Schema<A, I>,
    // readonly localTable: any,
  ) {
    this.name = name
  }
}

export class ResourcePlan<
  A extends Effect.Effect<void, any, any>,
  B extends Effect.Effect<void, any, any>,
> implements Plan {
  readonly name: string
  readonly commands: CommandRequestHandle<any>[]
  readonly events: EventRequestHandle<any>[]
  readonly immediate: A
  readonly background: B

  constructor(
    name: string,

    options: {
      immediate?: A
      background?: B
      commands?: CommandRequestHandle<any>[]
      events?: EventRequestHandle<any>[]
    },
  ) {
    this.name = name

    this.commands = options.commands ?? []
    this.events = options.events ?? []
    this.immediate = options.immediate ?? (Effect.void as unknown as A)
    this.background = options.background ?? (Effect.void as unknown as B)
  }
}

type Contructor<T> = new (...args: any) => T
export type TaggedReq = Contructor<Request.Request<any, any> & { _tag: string }> & { _tag: string }
export type InferA<T extends TaggedReq> = T extends Contructor<Request.Request<infer A, infer E>> ? [A, E] : never
type InferAA<T extends TaggedReq> = InferA<T>[0]
type InferAI<T extends TaggedReq> = InferA<T>[1]

export const declareCommand = <
  Req extends TaggedReq,
  Fn extends (input: InstanceType<Req>) => Effect.Effect<InferAA<Req>, InferAI<Req>, any> = (
    input: InstanceType<Req>,
  ) => Effect.Effect<InferAA<Req>, InferAI<Req>, any>,
>(
  req: Req,
  handle: Fn,
) => {
  return { req, handle } as const
}

export const declareEvent = <
  Req extends TaggedReq,
  Fn extends (input: InstanceType<Req>) => Effect.Effect<any, InferAI<Req>, any> = (
    input: InstanceType<Req>,
  ) => Effect.Effect<any, InferAI<Req>, any>,
>(
  req: Req,
  handle: Fn,
) => {
  return { req, handle } as const
}

export type CommandRequest = InstanceType<TaggedReq>
export type CommandRequestHandle<T extends TaggedReq> = ReturnType<typeof declareCommand<T>>

export type EventRequest = InstanceType<TaggedReq>
export type EventRequestHandle<T extends TaggedReq> = ReturnType<typeof declareEvent<T>>

export class CommandHandle {
  private map: Map<string, CommandRequestHandle<any>>

  constructor() {
    this.map = new Map()
  }

  set(handle: CommandRequestHandle<any>): void {
    this.map.set(handle.req._tag, handle)
  }

  invoke<T extends CommandRequest, A, E>(request: T): Effect.Effect<A, E> {
    const tag = request._tag
    const handle = this.map.get(tag)
    if (!handle) {
      return Effect.void as unknown as Effect.Effect<A, E>
    }

    return handle.handle(request) as Effect.Effect<A, E>
  }
}

export class EventHandle {
  private list: EventRequestHandle<any>[]

  constructor() {
    this.list = []
  }

  set(handle: EventRequestHandle<any>): void {
    this.list.push(handle)
  }

  invoke<T extends EventRequest>(request: T): Effect.Effect<void> {
    const tasks = this.list.filter((_) => _.req._tag === request._tag)

    return Effect.forEach(
      tasks,
      (handle) =>
        handle.handle(request).pipe(Effect.withLogSpan(String.snakeToKebab(String.pascalToSnake(request._tag)))),
      {
        concurrency: 'unbounded',
        discard: true,
      },
    ).pipe(
      // don't fail if one of the event handler fails
      Effect.catchAllCause(Effect.logError),
    ) as Effect.Effect<void>
  }
}
