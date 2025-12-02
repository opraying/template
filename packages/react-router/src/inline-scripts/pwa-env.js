const isInWebAppiOS = window.navigator.standalone === true
const isInWebAppChrome = window.matchMedia('(display-mode: standalone)').matches
const isInWebApp = isInWebAppiOS || isInWebAppChrome

window._isInWebApp = isInWebApp

if (isInWebApp) {
  document.body.classList.add('in-app')
}

// safari
const isInSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
window._isInSafari = isInSafari

if (isInSafari) {
  document.body.classList.add('in-safari')
}

// chrome
const isInChrome = /chrome/i.test(navigator.userAgent)
window._isInChrome = isInChrome

if (isInChrome) {
  document.body.classList.add('in-chrome')
}
