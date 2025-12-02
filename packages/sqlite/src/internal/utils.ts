export class EventEmitter {
  private listeners: Map<string, Set<(message: any) => void>> = new Map()

  on(event: string, listener: (message: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(listener)
  }

  emit(event: string, message: any) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(message))
    }
  }

  off(event: string, listener: (message: any) => void) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  clear() {
    this.listeners.clear()
  }
}
