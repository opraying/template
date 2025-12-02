import { useCallback, useRef, useState } from 'react'
import { noop } from '@/lib/hooks/noop'
import { useStableHandler } from '@/lib/hooks/use-stable-handler'

export class UseClipboardError extends Error {}

interface UseClipboardOption {
  timeout?: number
  usePromptAsFallback?: boolean
  promptFallbackText?: string
  onCopyError?: (error: Error) => void
}

/** @see https://foxact.skk.moe/use-clipboard */
export function useClipboard({
  timeout = 1000,
  usePromptAsFallback = false,
  promptFallbackText = 'Failed to copy to clipboard automatically, please manually copy the text below.',
  onCopyError,
}: UseClipboardOption = {}) {
  const [error, setError] = useState<Error | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)

  const stablizedOnCopyError = useStableHandler<[e: Error], undefined>(onCopyError || noop)

  const handleCopyResult = useCallback(
    (isCopied: boolean) => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      if (isCopied) {
        copyTimeoutRef.current = window.setTimeout(() => setCopied(false), timeout)
      }
      setCopied(isCopied)
    },
    [timeout],
  )

  const handleCopyError = useCallback(
    (e: Error) => {
      setError(e)
      stablizedOnCopyError(e)
    },
    [stablizedOnCopyError],
  )

  const copy = useCallback(
    async (valueToCopy: string) => {
      try {
        if ('clipboard' in navigator) {
          await navigator.clipboard.writeText(valueToCopy)
          handleCopyResult(true)
        } else {
          throw new UseClipboardError('[foxact/use-clipboard] navigator.clipboard is not supported')
        }
      } catch (e) {
        if (usePromptAsFallback) {
          try {
            window.prompt(promptFallbackText, valueToCopy)
          } catch (e2) {
            handleCopyError(e2 as Error)
          }
        } else {
          handleCopyError(e as Error)
        }
      }
    },
    [handleCopyResult, promptFallbackText, handleCopyError, usePromptAsFallback],
  )

  const reset = useCallback(() => {
    setCopied(false)
    setError(null)
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  return { copy, reset, error, copied }
}
