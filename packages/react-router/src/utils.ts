import { findCookieByName } from '@xstack/react-router/cookie'
import type { ReactRouterData } from '@xstack/react-router/response'
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunction,
  LoaderFunctionArgs,
  MetaDescriptor,
} from 'react-router'
import { type Location, matchPath, type Params, type ShouldRevalidateFunction } from 'react-router'

export type ActionType<T extends (args: ActionFunctionArgs) => any> =
  ReturnType<T> extends Promise<infer A> ? (args: ActionFunctionArgs) => Promise<A> : never

export type LoaderType<T extends (args: LoaderFunctionArgs) => any> =
  ReturnType<T> extends Promise<infer A> ? (args: LoaderFunctionArgs) => Promise<A> : never

export interface MetaArgs<
  Loader extends (args: LoaderFunctionArgs) => Promise<ReactRouterData.Data<any, any>> | any = any,
  _MatchLoaders extends Record<string, LoaderFunction | unknown> = Record<string, unknown>,
> {
  data: ReactRouterData.ReduceError<ReactRouterData.SafeData<Loader>> | undefined
  params: Params
  location: Location
  matches: any
  error?: unknown
}

export type MetaFunction<
  Loader extends (args: LoaderFunctionArgs) => Promise<ReactRouterData.Data<any, any>> | any = any,
  MatchLoaders extends Record<string, LoaderFunction | unknown> = Record<string, unknown>,
> = (args: MetaArgs<Loader, MatchLoaders>) => MetaDescriptor[] | undefined

// "HeadersFunction", "ShouldRevalidateFunction"
export type { HeadersFunction, ShouldRevalidateFunction }

export { useLanguageChangeRevalidator } from '@xstack/react-router/hooks/use-react-router-utils'
export {
  useActionData,
  useFetcherData,
  useLoaderData,
  useRouteLoaderData,
} from '@xstack/react-router/hooks/use-safe-response'

export const key = 'x-app-flag'
export const appDisable = '0'
export const appEnable = '1'

// @ts-ignore
const isDesktop = () => typeof globalThis.isDesktop !== 'undefined' && globalThis.isDesktop

export const appEnableCookie = `${key}=${appEnable}; Max-Age=31536000; Path=/; SameSite=Strict`

export const appDisableCookie = `${key}=${appDisable}; Max-Age=31536000; Path=/; SameSite=Strict`

export const NOTIFY_APP_STATUS_CHANGE = 'notify-app-status-change'

const notifyAppStatusChange = (status: boolean) => {
  try {
    dispatchEvent(new CustomEvent(NOTIFY_APP_STATUS_CHANGE, { detail: status }))
  } catch {}
}

export const appStatusUtils = {
  /**
   * 将 cookie 中的 flag 设置为 true
   */
  enableApp() {
    if (!isDesktop()) {
      document.cookie = appEnableCookie
    }
    notifyAppStatusChange(true)
  },

  /**
   * 将 cookie 中的 flag 设置为 false
   */
  disableApp() {
    if (!isDesktop()) {
      document.cookie = appDisableCookie
    }
    notifyAppStatusChange(false)
  },

  /**
   * 判断 cookie 中的 flag 是否为 true
   */
  isAppEnabled(cookie?: string) {
    const documentCookie = typeof globalThis.document !== 'undefined' ? globalThis.document.cookie : ''
    const str = cookie ?? documentCookie
    const value = findCookieByName(key, str)
    if (isDesktop()) {
      return true
    }
    return value === appEnable.toString()
  },

  /**
   * 判断 cookie 中的 flag 是否为 false
   */
  isAppDisabled(cookie?: string) {
    const documentCookie = typeof globalThis.document !== 'undefined' ? globalThis.document.cookie : ''
    const str = cookie ?? documentCookie
    const value = findCookieByName(key, str)

    if (isDesktop()) {
      return false
    }

    return value === appDisable.toString()
  },
}

export function isAppRoute(pattern: Array<string>, pathname: string) {
  return pattern.some((pattern) => matchPath(pattern, pathname))
}
