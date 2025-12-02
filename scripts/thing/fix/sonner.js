export const Toaster = () => null

export const toast = () => {
  const noop = () => ''
  return {
    success: noop,
    info: noop,
    warning: noop,
    error: noop,
    custom: noop,
    message: noop,
    promise: () => Promise.resolve(''),
    dismiss: noop,
    loading: noop,
    getHistory: () => [],
  }
}
