/**
 * 恢复操作结果
 */
export interface RecoveryResult {
  success: boolean
  message: string
  nextAction?: RecoveryAction
  retryAfter?: number // 毫秒
}

/**
 * 恢复操作定义
 */
export interface RecoveryAction {
  id: string
  type: 'automatic' | 'manual' | 'guided'
  label: string
  description: string
  handler: () => Promise<RecoveryResult>
}

// ==================== 内置恢复操作 ====================

/**
 * 刷新页面
 */
export const refreshPageAction: RecoveryAction = {
  id: 'refresh-page',
  type: 'automatic',
  label: 'Refresh',
  description: 'Reload the current page to reset the application state',
  handler: async () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
      return { success: true, message: 'Page refreshed successfully' }
    }
    return { success: false, message: 'Cannot refresh page in this environment' }
  },
}

/**
 * 清除缓存并重新加载
 */
export const clearCacheAndReloadAction: RecoveryAction = {
  id: 'clear-cache-reload',
  type: 'automatic',
  label: 'Clear Cache',
  description: 'Clear browser cache and reload the page',
  handler: async () => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))

        // 清除本地存储
        localStorage.clear()
        sessionStorage.clear()

        window.location.reload()
        return { success: true, message: 'Cache cleared and page reloaded' }
      } catch (error) {
        return { success: false, message: 'Failed to clear cache' }
      }
    }
    return { success: false, message: 'Cache API not available' }
  },
}

/**
 * 返回首页
 */
export const goToHomeAction: RecoveryAction = {
  id: 'go-home',
  type: 'manual',
  label: 'Go Home',
  description: 'Navigate to the home page',
  handler: async () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
      return { success: true, message: 'Navigated to home page' }
    }
    return { success: false, message: 'Cannot navigate in this environment' }
  },
}
