// https://github.com/domchristie/tailwind-utopia

import plugin from 'tailwindcss/plugin'
import { clampValue } from './utils'
import * as spacing from './spacing'
import * as text from './text'

const defaultOptions = {
  useClamp: false,
  prefix: 'fl-',
  baseKey: 'base',
}

const gridDefaults = {
  columns: 12,
  minSize: 18,
  maxSize: 40,
  maxWidth: 60,
}

export default plugin.withOptions(
  // 增加 css 内容
  (options) => {
    return ({ addBase, theme }) => {
      const customOptions = Object.assign({}, defaultOptions, options)

      const { minWidth, maxWidth, grid } = theme('utopia')

      const prefix = customOptions.prefix

      addBase({
        ':root': {
          [`--${prefix}min-width`]: minWidth.toString(),
          [`--${prefix}max-width`]: maxWidth.toString(),
          [`--${prefix}screen`]: '100vw',
        },
      })

      if (!customOptions.useClamp) {
        addBase({
          ':root': {
            [`--${prefix}bp`]: `calc((var(--${prefix}screen) - var(--${prefix}min-width) / 16 * 1rem) / (var(--${prefix}max-width) - var(--${prefix}min-width)))`,
          },

          [`@media (min-width: ${maxWidth}px)`]: {
            ':root': {
              [`--${prefix}screen`]: `calc(var(--${prefix}max-width) * 1px)`,
            },
          },
        })
      }

      addBase({
        ':root': text.customProperties(theme, customOptions),
      })

      const gutterCount = grid.columns + 1
      const containerMaxWidth = grid.maxSize * gutterCount + grid.maxWidth * grid.columns
      const containerMinWidth = minWidth

      addBase({
        ':root': {
          [`--${prefix}grid-max-width`]: `${(maxWidth / 16).toFixed(2)}rem`,
          [`--${prefix}grid-gutter`]: `${clampValue(grid.minSize, grid.maxSize, containerMinWidth, containerMaxWidth)}`,
          [`--${prefix}grid-columns`]: grid.columns.toString(),
        },
        '.wrap': {
          'margin-left': 'auto',
          'margin-right': 'auto',
          'padding-left': `var(--${prefix}grid-gutter)`,
          'padding-right': `var(--${prefix}grid-gutter)`,
          'max-width': `calc(var(--${prefix}max-width) * 1px)`,
        },
        '.u-container': {
          'max-width': `calc(var(--${prefix}max-width) * 1px)`,
          'padding-inline': `var(--${prefix}grid-gutter)`,
          'margin-inline': 'auto',
        },
        '.u-grid': {
          display: 'grid',
          gap: `var(--${prefix}grid-gutter)`,
          'grid-template-columns': `repeat(var(--${prefix}grid-columns), 1fr)`,
        },
      })
    }
  },
  // 增加 tailwind 配置
  (options) => {
    const customOptions = Object.assign({}, defaultOptions, options)

    return {
      theme: {
        extend: {
          fontSize: (theme) => text.sizes(theme, customOptions),
          spacing: (theme) => spacing.sizes(theme, customOptions),
        },
        utopia: {
          minSize: 18,
          maxSize: 20,
          minScale: 1.2,
          maxScale: 1.25,
          minWidth: 375,
          // 在大于等于 maxWidth 宽带下，宽度为 maxWidth，否则为 100vw
          maxWidth: 1240,
          spacing: spacing.defaults,
          fontSize: text.defaults,
          grid: gridDefaults,
        },
      },
    }
  },
)
