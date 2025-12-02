export interface OtelWebEventTypes {
  'global-attributes-changed': {
    attributes: any
  }
  'session-changed': {
    sessionId: string
  }
}

type EventListener<type extends keyof OtelWebEventTypes> = (event: { payload: OtelWebEventTypes[type] }) => void

export class InternalEventTarget {
  protected events: Partial<{ [T in keyof OtelWebEventTypes]: EventListener<T>[] }> = {}

  addEventListener<T extends keyof OtelWebEventTypes>(type: T, listener: EventListener<T>): void {
    if (!this.events[type]) {
      this.events[type] = []
    }
    ;(this.events[type] as EventListener<T>[]).push(listener)
  }

  emit<T extends keyof OtelWebEventTypes>(type: T, payload: OtelWebEventTypes[T]): void {
    const listeners = this.events[type]
    if (!listeners) {
      return
    }

    listeners.forEach((listener) => {
      // Run it as promise so any broken code inside listener doesn't break the agent
      void Promise.resolve({ payload }).then(listener)
    })
  }

  removeEventListener<T extends keyof OtelWebEventTypes>(type: T, listener: EventListener<T>): void {
    if (!this.events[type]) {
      return
    }

    const i = (this.events[type] as EventListener<T>[]).indexOf(listener)

    if (i >= 0) {
      this.events[type].splice(i, 1)
    }
  }
}
