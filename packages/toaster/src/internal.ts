import * as Effect from 'effect/Effect'
import type { Toaster, ToasterMethods } from './toaster'

// Helper function to wrap synchronous toaster methods with Effect.sync
export const wrapWithEffect = (methods: ToasterMethods): Toaster => {
  // Create the main toast function with Effect wrapper
  const toast = (message: any, data?: any) => Effect.sync(() => methods(message, data))

  // Add all the variant methods wrapped with Effect
  toast.success = (message: any, data?: any) => Effect.sync(() => methods.success(message, data))
  toast.info = (message: any, data?: any) => Effect.sync(() => methods.info(message, data))
  toast.warning = (message: any, data?: any) => Effect.sync(() => methods.warning(message, data))
  toast.error = (message: any, data?: any) => Effect.sync(() => methods.error(message, data))
  toast.custom = (jsx: any, data?: any) => Effect.sync(() => methods.custom(jsx, data))
  toast.message = (message: any, data?: any) => Effect.sync(() => methods.message(message, data))
  toast.promise = (promise: any, data?: any) => Effect.sync(() => methods.promise(promise, data))
  toast.dismiss = (id?: any) => Effect.sync(() => methods.dismiss(id))
  toast.loading = (message: any, data?: any) => Effect.sync(() => methods.loading(message, data))

  return toast as Toaster
}
