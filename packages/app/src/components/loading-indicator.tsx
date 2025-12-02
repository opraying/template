import { useLayoutEffect } from 'react'

declare global {
  var forceClose: boolean
}

export function LoadingIndicator() {
  useLayoutEffect(() => {
    setTimeout(() => {
      if (!globalThis.forceClose) {
        // @ts-ignore
        window.showLoading()
      } else {
        // @ts-ignore
        window.hideLoading()
      }
    }, 200)
  }, [])

  return null
}

export function LoadingIndicatorElement() {
  return (
    <div className="loading-root">
      <div className="loading-container">
        <div className="loader2" />
        <div className="loader">
          <div className="loaderBar" />
        </div>
        <div className="loading-retry">
          <p>Please wait or try again.</p>
          <button type="button" className="loading-retry-button" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
