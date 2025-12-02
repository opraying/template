export function pair(array) {
  return array
    .map((v, i) =>
      array.slice(i + 1).map((w) => [
        [v, w],
        [w, v],
      ]),
    )
    .flat(2)
}

const toRem = (value, fractionDigits = 4) => (value / 16).toFixed(fractionDigits)
const toPx = (value, fractionDigits = 4) => (value * 16).toFixed(fractionDigits)

const _isRem = (value) => typeof value === 'string' || value.endsWith('rem')

export function calcValue(min, max, fractionDigits = 4) {
  const isNumber = typeof min === 'number' && typeof max === 'number'

  if (isNumber) {
    const minValueRem = isNumber ? toRem(min, fractionDigits) : min

    return `calc(${minValueRem}rem + ${(max - min).toFixed(fractionDigits)} * var(--fluid-bp))`
  }

  return `calc(((${min} / 16) * 1rem) + (${max} - ${min}) * var(--fluid-bp))`
}

export function clampValue(minValue, maxValue, minViewport, maxViewport, unit = 'px', fractionDigits = 4) {
  const isRem = unit === 'rem'
  const minValuePx = isRem ? toPx(minValue, fractionDigits) : minValue
  const maxValuePx = isRem ? toPx(maxValue, fractionDigits) : maxValue

  const variablePart = (maxValuePx - minValuePx) / (maxViewport - minViewport)
  const constant = Number.parseFloat(((maxValuePx - maxViewport * variablePart) / 16).toFixed(fractionDigits))

  return `clamp(${toRem(minValuePx, fractionDigits)}rem,${constant ? ` ${constant}rem +` : ''} ${Number.parseFloat(
    (100 * variablePart).toFixed(fractionDigits),
  )}vw, ${toRem(maxValuePx, fractionDigits)}rem)`
}

export function clampSpacingValue(min, max, fractionDigits = 4) {
  return `clamp(${toRem(min, fractionDigits)}rem, 0vw, ${toRem(max, fractionDigits)}rem)`
}
