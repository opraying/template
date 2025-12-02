// 定义不同订阅级别的配额限制
export const TIER_LIMITS = {
  Basic: {
    maxPerStorageBytes: 50 * 1024 * 1024, // 50MB
    maxDevices: 1,
    maxVaults: 1,
  },
  Pro: {
    maxPerStorageBytes: 500 * 1024 * 1024, // 500MB
    maxDevices: 5,
    maxVaults: 3,
  },
} as const

export const namespaceSessionApi: Record<string, { dev: string; prod: string }> = {
  template: {
    dev: 'http://localhost:5440/api/session',
    prod: 'https://template.opraying.com/api/session',
  },
  opraying: {
    dev: 'http://localhost:3440/api/session',
    prod: 'https://studio.opraying.com/api/session',
  },
  verx: {
    dev: 'http://localhost:4440/api/session',
    prod: 'https://verx.app/api/session',
  },
}
