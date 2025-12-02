const root = document.documentElement
const localStorageAppearance = localStorage.getItem('ui-appearance') || 'system'
const _localStorageTheme = localStorage.getItem('ui-theme') || 'default'

if (localStorageAppearance === 'system') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  root.classList.add(mediaQuery.matches ? 'dark' : 'light')
} else {
  root.classList.add(localStorageAppearance)
}
