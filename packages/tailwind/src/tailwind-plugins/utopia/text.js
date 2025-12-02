import { calcValue, clampValue } from './utils'

export const defaults = {
  xs: 'inherit',
  sm: 'inherit',
  base: 1.2,
  lg: 1.33,
  xl: 1.2,
  '2xl': 1.11,
  '3xl': 1,
  '4xl': 1,
}

export function customProperties(theme, options) {
  const { fontSize, maxWidth, minWidth } = theme('utopia')
  const props = {}

  Object.keys(fontSize).forEach((name) => {
    if (options.useClamp) {
      const [min, max] = minMax(name, theme, options)

      props[`--${options.prefix}${name}`] = clampValue(min, max, minWidth, maxWidth)
    } else {
      let [min, max] = minMax(name, theme, options)
      min = typeof min.toFixed === 'function' ? min.toFixed(2) : min
      max = typeof max.toFixed === 'function' ? max.toFixed(2) : max

      props[`--${options.prefix}${name}-min`] = min.toString()
      props[`--${options.prefix}${name}-max`] = max.toString()
      props[`--${options.prefix}${name}`] = calcValue(
        `var(--${options.prefix}${name}-min)`,
        `var(--${options.prefix}${name}-max)`,
      )
    }
  })

  return props
}

export function sizes(theme, options) {
  const { fontSize } = theme('utopia')
  const names = Object.keys(fontSize)

  return Object.fromEntries(
    names.map((name) => {
      const { lineHeight } = configFor(name, theme, options)
      return [`${options.prefix}${name}`, [`var(--${options.prefix}${name})`, lineHeight]]
    }),
  )
}

function configFor(name, theme, options) {
  const { fontSize } = theme('utopia')
  const value = fontSize[name]
  let lineHeight
  let min
  let max

  if (typeof value === 'object') {
    lineHeight = value.lineHeight || value['line-height']
    min = value.min
    max = value.max
  } else {
    lineHeight = value
  }

  return {
    lineHeight: lineHeight || defaults[name],
    min: min || `var(--${options.prefix}${name}-min)`,
    max: max || `var(--${options.prefix}${name}-max)`,
  }
}

function minMax(name, theme, options) {
  const { fontSize, minSize, maxSize, minScale, maxScale } = theme('utopia')
  const { min: customMin, max: customMax } = fontSize[name]

  const names = Object.keys(fontSize)
  const baseIndex = names.indexOf(options.baseKey)
  const step = names.indexOf(name) - baseIndex
  const absStep = Math.abs(step)
  let min = minSize
  let max = maxSize

  if (step !== 0) {
    const minFactor = minScale ** absStep
    const maxFactor = maxScale ** absStep

    if (step < 0) {
      min = minSize / minFactor
      max = maxSize / maxFactor
    } else {
      min = minSize * minFactor
      max = maxSize * maxFactor
    }
  }
  return [customMin || min, customMax || max]
}
