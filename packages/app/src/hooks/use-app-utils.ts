import { appStatusUtils, NOTIFY_APP_STATUS_CHANGE } from '@xstack/react-router/utils'
import { useNavigate } from '@xstack/router'
import { useSyncExternalStore } from 'react'
import { useRouteLoaderData } from 'react-router'

export const useSetAppStatusEnable = () => {
  const navigate = useNavigate()

  return (reload?: boolean) => {
    appStatusUtils.enableApp()

    if (reload) {
      setTimeout(() => {
        window.location.assign('/')
      }, 10)
    } else {
      navigate.replace('/')
    }
  }
}

export const useSetAppStatusDisable = () => {
  const navigate = useNavigate()

  return (reload?: boolean) => {
    appStatusUtils.disableApp()
    if (reload) {
      setTimeout(() => {
        window.location.assign('/')
      }, 10)
    } else {
      navigate.replace('/')
    }
  }
}

const useLocalAppEnable = () =>
  useSyncExternalStore(
    (callback) => {
      if (typeof document !== 'undefined') {
        document.addEventListener(NOTIFY_APP_STATUS_CHANGE, callback)
      }
      return () => {
        if (typeof document !== 'undefined') {
          document.removeEventListener(NOTIFY_APP_STATUS_CHANGE, callback)
        }
      }
    },
    () => appStatusUtils.isAppEnabled(),
    () => undefined,
  )

type RootLoaderData = {
  success: boolean
  result: {
    isAppEnable: boolean
  }
}

export const useAppEnable = () => {
  const routerResult = useRouteLoaderData('root') as RootLoaderData
  // @ts-ignore
  const isDesktop: boolean = (globalThis.isDesktop ||
    (typeof window !== 'undefined' && '__TAURI__' in window)) as boolean
  const data = isDesktop ? { success: true, result: { isAppEnable: true } } : routerResult

  const local = useLocalAppEnable()
  const remote = data.success ? data.result.isAppEnable : undefined

  return local ?? remote
}
