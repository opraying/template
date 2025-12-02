import { toast as sonnerToast } from 'sonner'
import type { ExternalToast, PromiseData, PromiseT, ToasterMethods, titleT } from './toaster'

// Helper function to convert our ExternalToast to sonner's format
const convertToSonnerOptions = (data?: ExternalToast) => {
  if (!data) return undefined

  // Filter out undefined values and convert to sonner's expected format
  const options: any = {}

  if (data.id !== undefined) options.id = data.id
  if (data.duration !== undefined) options.duration = data.duration
  if (data.position !== undefined) options.position = data.position
  if (data.dismissible !== undefined) options.dismissible = data.dismissible
  if (data.icon !== undefined) options.icon = data.icon
  if (data.richColors !== undefined) options.richColors = data.richColors
  if (data.description !== undefined) options.description = data.description
  if (data.className !== undefined) options.className = data.className
  if (data.classNames !== undefined) options.classNames = data.classNames
  if (data.descriptionClassName !== undefined) options.descriptionClassName = data.descriptionClassName
  if (data.style !== undefined) options.style = data.style
  if (data.closeButton !== undefined) options.closeButton = data.closeButton
  if (data.invert !== undefined) options.invert = data.invert
  if (data.unstyled !== undefined) options.unstyled = data.unstyled
  if (data.action !== undefined) options.action = data.action
  if (data.cancel !== undefined) options.cancel = data.cancel
  if (data.cancelButtonStyle !== undefined) options.cancelButtonStyle = data.cancelButtonStyle
  if (data.actionButtonStyle !== undefined) options.actionButtonStyle = data.actionButtonStyle
  if (data.onDismiss !== undefined) options.onDismiss = data.onDismiss
  if (data.onAutoClose !== undefined) options.onAutoClose = data.onAutoClose

  return Object.keys(options).length > 0 ? options : undefined
}

// Helper function to extract ExternalToast compatible fields from PromiseData
const extractExternalToastFromPromiseData = (data: PromiseData<any>): ExternalToast => {
  const { loading, success, error, description, finally: finallyFn, ...externalToastFields } = data

  return externalToastFields
}

// Core web toaster implementation - synchronous functions
export const makeWebToaster = (): ToasterMethods => {
  // Main toast function
  const toast = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast(message, convertToSonnerOptions(data))
  }

  // Add all the variant methods
  toast.success = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.success(message, convertToSonnerOptions(data))
  }

  toast.info = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.info(message, convertToSonnerOptions(data))
  }

  toast.warning = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.warning(message, convertToSonnerOptions(data))
  }

  toast.error = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.error(message, convertToSonnerOptions(data))
  }

  toast.custom = (jsx: (id: number | string) => React.ReactElement, data?: ExternalToast): string | number => {
    return sonnerToast.custom(jsx, convertToSonnerOptions(data))
  }

  toast.message = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.message(message, convertToSonnerOptions(data))
  }

  toast.promise = <ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData>) => {
    const convertedData: any = data
      ? {
          loading: data.loading,
          success: data.success,
          error: data.error,
          description: data.description,
          finally: data.finally,
        }
      : undefined

    // Add the base options if they exist
    if (data) {
      const externalToastFields = extractExternalToastFromPromiseData(data)
      const baseOptions = convertToSonnerOptions(externalToastFields)
      if (baseOptions) {
        Object.assign(convertedData, baseOptions)
      }
    }

    return sonnerToast.promise(promise, convertedData) as any
  }

  toast.dismiss = (id?: number | string): string | number => {
    return sonnerToast.dismiss(id)
  }

  toast.loading = (message: titleT, data?: ExternalToast): string | number => {
    return sonnerToast.loading(message, convertToSonnerOptions(data))
  }

  return toast
}
