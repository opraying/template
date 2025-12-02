import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array<ArrayBufferLike>): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function generateRandomBytes(length: number): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(length)).buffer
}

export function areArrayBuffersEqual(
  buf1: ArrayBuffer | Uint8Array<ArrayBufferLike>,
  buf2: ArrayBuffer | Uint8Array<ArrayBufferLike>,
): boolean {
  if (buf1.byteLength !== buf2.byteLength) return false
  const dv1 = buf1 instanceof Int8Array ? buf1 : new Int8Array(buf1)
  const dv2 = buf2 instanceof Int8Array ? buf2 : new Int8Array(buf2)
  for (let i = 0; i < buf1.byteLength; i++) {
    if (dv1[i] !== dv2[i]) return false
  }
  return true
}

export function toUint8Array(data: string | ArrayBuffer | Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return data
}

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

  toStream<T>(event: string) {
    return Stream.async<T>((emit) => {
      const handle = (e: any) => {
        emit.single(e)
      }
      this.on(event, handle)
      return Effect.sync(() => this.off(event, handle))
    })
  }
}

export const whenTags = (
  tags: string[],
  matchs: Array<
    [
      // tags
      string[],
      // fn
      () => Promise<void>,
    ]
  >,
) => {
  const tagsSet = new Set(tags)
  for (const [tags, fn] of matchs) {
    if (tags.some((_) => tagsSet.has(_))) {
      return fn()
    }
  }
  return Promise.resolve()
}

/**
 * 直接从用户代理字符串中检测设备类型和操作系统，不依赖第三方库
 * @param userAgent 用户代理字符串
 * @returns 包含设备类型和操作系统的对象和浏览器
 */
export function detectDevice(userAgent: string): { type: string; os: string; browser: string } {
  const ua = userAgent.toLowerCase()

  let deviceType = 'desktop'
  let osName = 'other'
  let browserName = 'other'

  // OS Detection (order matters)
  if (/windows nt/.test(ua)) {
    osName = 'windows'
  } else if (/iphone|ipad|ipod/.test(ua)) {
    osName = 'ios'
    deviceType = /ipad/.test(ua) ? 'tablet' : 'mobile'
  } else if (/mac os x|macintosh/.test(ua)) {
    osName = 'macos'
    // Check for iPadOS masquerading as macOS
    if (ua.includes('like mac os x') && ua.includes('mobile')) {
      osName = 'ios' // Correct OS for iPadOS 13+
      deviceType = 'tablet'
    }
  } else if (/android/.test(ua)) {
    osName = 'android'
    deviceType = /mobile/.test(ua) ? 'mobile' : 'tablet'
  } else if (/linux/.test(ua)) {
    osName = 'linux'
  }

  // Browser Detection (order matters for browsers based on others, e.g., Edge on Chromium)
  if (/edg/.test(ua)) {
    // Edge (Chromium based)
    browserName = 'edge'
  } else if (/opr|opera/.test(ua)) {
    // Opera
    browserName = 'opera'
  } else if (/chrome/.test(ua) && !/chromium/.test(ua)) {
    // Chrome (ensure not Chromium)
    browserName = 'chrome'
  } else if (/firefox|fxios/.test(ua)) {
    // Firefox (and Firefox iOS)
    browserName = 'firefox'
  } else if (/safari/.test(ua) && osName === 'ios') {
    // Safari on iOS
    browserName = 'safari'
  } else if (/safari/.test(ua) && osName === 'macos') {
    // Safari on macOS
    browserName = 'safari'
  } else if (/trident|msie/.test(ua)) {
    // IE
    browserName = 'ie'
  }

  // Refine Tablet detection for ambiguous cases (e.g., some Android devices)
  if (deviceType === 'desktop' && (ua.includes('tablet') || ua.includes('playbook'))) {
    deviceType = 'tablet'
  }

  // Final mobile check for less common UAs
  if (
    deviceType === 'desktop' &&
    (ua.includes('mobile') || ua.includes('windows phone') || ua.includes('blackberry'))
  ) {
    deviceType = 'mobile'
  }

  return {
    type: deviceType,
    os: osName,
    browser: browserName,
  }
}
