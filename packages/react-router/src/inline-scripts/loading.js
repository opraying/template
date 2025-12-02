globalThis.forceClose = false

const maxWaitTimer = 5000
const minShowTime = 400
let timer = null
let showStartTime = null

window.showLoading = () => {
  if (globalThis.forceClose) {
    return
  }
  const startTime = Date.now()
  showStartTime = startTime
  let retryVisible = false

  if (timer) {
    clearTimeout(timer)
  }

  const loadingRoot = document.querySelector('.loading-root')
  if (loadingRoot) {
    loadingRoot.style.display = 'block'
    requestAnimationFrame(() => {
      loadingRoot.style.opacity = '1'
    })
  }

  checkIfLoaded()

  function checkIfLoaded() {
    const currentTime = Date.now()
    if (currentTime - startTime > maxWaitTimer) {
      const loadingRetry = document.querySelector('.loading-retry')

      if (!retryVisible && loadingRetry) {
        loadingRetry.style.pointerEvents = 'auto'
        loadingRetry.style.opacity = '1'
        loadingRetry.style.transform = 'translateY(0)'
        retryVisible = true
      }
    } else {
      timer = setTimeout(checkIfLoaded, 30)
    }
  }
}

window.hideLoading = () => {
  globalThis.forceClose = true

  const now = Date.now()
  const elapsedTime = now - showStartTime

  if (elapsedTime < minShowTime) {
    setTimeout(() => {
      doHideLoading()
    }, minShowTime - elapsedTime)
  } else {
    doHideLoading()
  }
}

function doHideLoading() {
  const loadingRoot = document.querySelector('.loading-root')
  const retryControl = document.querySelector('.loading-retry')

  if (timer) {
    clearTimeout(timer)
  }

  if (loadingRoot) {
    loadingRoot.style.opacity = '0'
    loadingRoot.addEventListener(
      'transitionend',
      () => {
        loadingRoot.style.display = 'none'
      },
      { once: true },
    )
  }

  if (retryControl) {
    retryControl.style.opacity = '0'
    retryControl.style.transform = 'translateY(20px) scale(0.95)'
    retryControl.style.pointerEvents = 'none'
  }
}
