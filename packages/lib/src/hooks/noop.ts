export type Noop = (...args: Array<any>) => any

/** @see https://foxact.skk.moe/noop */
export const noop: Noop = () => {
  /* noop */
}
