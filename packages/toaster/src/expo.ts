import { Alert } from 'react-native'
import type { ExternalToast, PromiseData, PromiseT, ToasterMethods, titleT } from './toaster'

// Simple counter for generating unique IDs
let toastIdCounter = 0

// Helper function to generate unique toast IDs
const generateToastId = (): number => {
  return ++toastIdCounter
}

// Helper function to convert titleT to string for native display
const convertTitleToString = (title: titleT): string => {
  if (typeof title === 'string') return title
  if (typeof title === 'function') return 'Toast Message'
  return 'Toast Message'
}

// Helper function to show native alert (fallback implementation)
const showNativeAlert = (
  title: titleT,
  message?: string,
  type: 'default' | 'success' | 'info' | 'warning' | 'error' = 'default',
): number => {
  const id = generateToastId()

  // Add emoji prefix based on type for better visual distinction
  const typeEmoji = {
    success: '✅ ',
    info: 'ℹ️ ',
    warning: '⚠️ ',
    error: '❌ ',
    default: '',
  }

  const titleStr = convertTitleToString(title)
  const displayTitle = `${typeEmoji[type]}${titleStr}`

  Alert.alert(displayTitle, message, [{ text: 'OK', style: 'default' }])

  return id
}

export const makeNativeToaster = (): ToasterMethods => {
  // Main toast function
  const toast = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description)
  }

  // Add all the variant methods
  toast.success = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description, 'success')
  }

  toast.info = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description, 'info')
  }

  toast.warning = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description, 'warning')
  }

  toast.error = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description, 'error')
  }

  toast.custom = (_jsx: (id: number | string) => React.ReactElement, data?: ExternalToast): string | number => {
    // For native, we can't render custom JSX in alerts, so we'll show a generic message
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert('Custom Toast', description)
  }

  toast.message = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(message, description)
  }

  toast.promise = <ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData>) => {
    const id = generateToastId()

    // Handle promise that might be a function
    const actualPromise = typeof promise === 'function' ? promise() : promise

    // Show loading message
    if (data?.loading) {
      const loadingMsg = typeof data.loading === 'string' ? data.loading : 'Loading...'
      showNativeAlert(loadingMsg)
    }

    // Handle promise resolution
    actualPromise
      .then((result) => {
        if (data?.success) {
          let successMsg = 'Success'
          if (typeof data.success === 'string') {
            successMsg = data.success
          } else if (typeof data.success === 'function') {
            const successResult = (data.success as any)(result)
            if (typeof successResult === 'string') {
              successMsg = successResult
            } else if (successResult && typeof successResult.then === 'function') {
              // Handle promise result
              successResult.then((resolved: any) => {
                const msg = typeof resolved === 'string' ? resolved : 'Success'
                showNativeAlert(msg, undefined, 'success')
              })
              return
            }
          }
          showNativeAlert(successMsg, undefined, 'success')
        }
        data?.finally?.()
      })
      .catch((error) => {
        if (data?.error) {
          let errorMsg = 'Error occurred'
          if (typeof data.error === 'string') {
            errorMsg = data.error
          } else if (typeof data.error === 'function') {
            const errorResult = (data.error as any)(error)
            if (typeof errorResult === 'string') {
              errorMsg = errorResult
            } else if (errorResult && typeof errorResult.then === 'function') {
              // Handle promise result
              errorResult.then((resolved: any) => {
                const msg = typeof resolved === 'string' ? resolved : 'Error occurred'
                showNativeAlert(msg, undefined, 'error')
              })
              return
            }
          }
          showNativeAlert(errorMsg, undefined, 'error')
        }
        data?.finally?.()
      })

    // Return a mock object that matches the expected interface
    const result = {
      unwrap: () => actualPromise,
    } as any

    return Object.assign(id, result)
  }

  toast.dismiss = (id?: number | string): string | number => {
    // React Native Alert doesn't support programmatic dismissal
    // Return the id for consistency
    return id || generateToastId()
  }

  toast.loading = (message: titleT, data?: ExternalToast): string | number => {
    const description =
      typeof data?.description === 'function'
        ? 'Description'
        : typeof data?.description === 'string'
          ? data.description
          : undefined
    return showNativeAlert(`⏳ ${convertTitleToString(message)}`, description)
  }

  return toast
}
