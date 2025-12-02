import { useLayoutEffect, useState } from 'react'

export function useAsync(fn: () => Promise<void>) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()

  useLayoutEffect(() => {
    fn()
      .then(() => setLoading(false))
      .catch(setError)
  }, [])

  return { loading, error }
}
