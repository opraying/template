import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as React from 'react'

// Types matching sonner's definitions
export type titleT = (() => React.ReactNode) | React.ReactNode

// Action interface matching sonner
export interface Action {
  label: React.ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  actionButtonStyle?: React.CSSProperties
}

// Toast classnames interface
export interface ToastClassnames {
  toast?: string
  title?: string
  description?: string
  loader?: string
  closeButton?: string
  cancelButton?: string
  actionButton?: string
  success?: string
  error?: string
  info?: string
  warning?: string
  loading?: string
  default?: string
  content?: string
  icon?: string
}

// Position type
export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'

// ExternalToast matching sonner's definition
export interface ExternalToast {
  id?: number | string
  icon?: React.ReactNode
  richColors?: boolean
  invert?: boolean
  closeButton?: boolean
  dismissible?: boolean
  description?: (() => React.ReactNode) | React.ReactNode
  duration?: number
  action?: Action | React.ReactNode
  cancel?: Action | React.ReactNode
  onDismiss?: (toast: any) => void
  onAutoClose?: (toast: any) => void
  cancelButtonStyle?: React.CSSProperties
  actionButtonStyle?: React.CSSProperties
  style?: React.CSSProperties
  unstyled?: boolean
  className?: string
  classNames?: ToastClassnames
  descriptionClassName?: string
  position?: Position
}

// Promise types matching sonner
export type PromiseT<Data = any> = Promise<Data> | (() => Promise<Data>)

interface PromiseExtendedResult extends ExternalToast {
  message: React.ReactNode
}

type PromiseExtendedResultFunction<Data = any> =
  | PromiseExtendedResult
  | ((data: Data) => PromiseExtendedResult | Promise<PromiseExtendedResult>)

type PromiseResult<Data = any> =
  | string
  | React.ReactNode
  | ((data: Data) => React.ReactNode | string | Promise<React.ReactNode | string>)

type PromiseExternalToast = Omit<ExternalToast, 'description'>

export interface PromiseData<ToastData = any> extends PromiseExternalToast {
  loading?: string | React.ReactNode
  success?: PromiseResult<ToastData> | PromiseExtendedResultFunction<ToastData>
  error?: PromiseResult | PromiseExtendedResultFunction
  description?: PromiseResult
  finally?: () => void | Promise<void>
}

// Core toaster interface - synchronous functions that can be used directly
export interface ToasterMethods {
  // Main toast function
  (message: titleT, data?: ExternalToast): string | number

  // Variant methods
  success: (message: titleT, data?: ExternalToast) => string | number
  info: (message: titleT, data?: ExternalToast) => string | number
  warning: (message: titleT, data?: ExternalToast) => string | number
  error: (message: titleT, data?: ExternalToast) => string | number
  custom: (jsx: (id: number | string) => React.ReactElement, data?: ExternalToast) => string | number
  message: (message: titleT, data?: ExternalToast) => string | number
  promise: <ToastData>(
    promise: PromiseT<ToastData>,
    data?: PromiseData<ToastData>,
  ) =>
    | (string & { unwrap: () => Promise<ToastData> })
    | (number & { unwrap: () => Promise<ToastData> })
    | { unwrap: () => Promise<ToastData> }
  dismiss: (id?: number | string) => string | number
  loading: (message: titleT, data?: ExternalToast) => string | number
}

// Effect-wrapped toaster interface for use with Effect system
export interface Toaster {
  // Main toast function
  (message: titleT, data?: ExternalToast): Effect.Effect<string | number>

  // Variant methods
  success: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
  info: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
  warning: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
  error: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
  custom: (jsx: (id: number | string) => React.ReactElement, data?: ExternalToast) => Effect.Effect<string | number>
  message: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
  promise: <ToastData>(
    promise: PromiseT<ToastData>,
    data?: PromiseData<ToastData>,
  ) => Effect.Effect<
    | (string & { unwrap: () => Promise<ToastData> })
    | (number & { unwrap: () => Promise<ToastData> })
    | { unwrap: () => Promise<ToastData> }
  >
  dismiss: (id?: number | string) => Effect.Effect<string | number>
  loading: (message: titleT, data?: ExternalToast) => Effect.Effect<string | number>
}

export const Toaster = Context.GenericTag<Toaster>('@toaster')
