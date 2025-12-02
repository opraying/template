const screens = {
  '2xl': false,
  lg: false,
  xl: false,
  md: false,
  sm: false,
  xs: false,
}
if (window.matchMedia('(min-width: 1536px)').matches) {
  screens['2xl'] = true
} else if (window.matchMedia('(min-width: 1280px)').matches) {
  screens.xl = true
} else if (window.matchMedia('(min-width: 1024px)').matches) {
  screens.lg = true
} else if (window.matchMedia('(min-width: 768px)').matches) {
  screens.md = true
} else if (window.matchMedia('(min-width: 640px)').matches) {
  screens.sm = true
} else if (window.matchMedia('(min-width: 480px)').matches) {
  screens.xs = true
}

window.__x_screen = screens
