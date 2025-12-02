export const getRuntime = () => {
  const isDesktop: boolean = false
  // @ts-ignore
  const isWebWorker: boolean = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope

  return {
    isDesktop: isDesktop,
    isWebWorker,
  }
}

export const getRuntimeName = (name: string) => {
  const { isDesktop, isWebWorker } = getRuntime()

  if (isDesktop) {
    return `${name}-tauri`
  }

  if (isWebWorker) {
    return `${name}-worker`
  }

  return name
}

export interface OtelMessage {
  type: 'traces' | 'logs' | 'metrics' | 'dev-logs'
  params: any
  data: Uint8Array<ArrayBufferLike>
}

export type GlobalSend = (type: OtelMessage['type'], params: any, body: Uint8Array<ArrayBufferLike>) => void

export const hasGlobalSend = (global: any): global is { externalReport: (...args: any) => void } => {
  return typeof global?.externalReport === 'function'
}

export type ExportError = any
