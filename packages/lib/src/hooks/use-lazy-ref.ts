import { type MutableRefObject, useRef } from 'react'

export function useLazyRef<T>(initialValFunc: () => T) {
  const ref: MutableRefObject<T> = useRef(null as T)
  if (ref.current === null) {
    ref.current = initialValFunc()
  }

  return ref
}
