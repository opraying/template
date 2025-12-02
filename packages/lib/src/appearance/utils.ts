// @ts-nocheck
import { converter, toGamut } from 'culori'

type HSL = `${number} ${number | string}% ${number | string}%`

export type ColorVars = {
  'background-sub': HSL
  background: HSL
  'background-step-1': HSL
  'background-step-2': HSL
  'background-step-3': HSL
  foreground: HSL
  card: HSL
  'card-foreground': HSL
  popover: HSL
  'popover-foreground': HSL
  primary: HSL
  'primary-foreground': HSL
  secondary: HSL
  'secondary-foreground': HSL
  muted: HSL
  'muted-foreground': HSL
  accent: HSL
  'accent-foreground': HSL
  destructive: HSL
  'destructive-foreground': HSL
  border: HSL
  input: HSL
  ring: HSL
}

type Color = {
  h: number
  s: number
  l: number
}
const defaults = {
  light: {
    background: '0 0% 100%',
    foreground: '240 10% 3.9%',
    card: '225 54.98% 97.34%',
    'card-foreground': '227 31.46% 10.27%',
    popover: '0 0% 100%',
    'popover-foreground': '240 10% 3.9%',
    primary: '219 88.07% 70.31%',
    'primary-foreground': '0 0% 100%',
    secondary: '240 4.8% 95.9%',
    'secondary-foreground': '240 5.9% 10%',
    muted: '240 4.8% 95.9%',
    'muted-foreground': '240 3.8% 46.1%',
    accent: '240 4.8% 95.9%',
    'accent-foreground': '240 5.9% 10%',
    destructive: '355 99.95% 70.14%',
    'destructive-foreground': '0 0% 100%',
    border: '240 5.9% 90%',
    input: '218 18.43% 96.81%',
    ring: '219 88.07% 70.31%',
  },
  dark: {
    background: '240 10% 3.9%',
    foreground: '0 0% 98%',
    card: '227 33.22% 12.69%',
    'card-foreground': '226 19.57% 14.88%',
    popover: '240 10% 3.9%',
    'popover-foreground': '0 0% 98%',
    primary: '218 55.03% 62.67%',
    'primary-foreground': '0 0% 98%',
    secondary: '240 3.7% 15.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '240 3.7% 15.9%',
    'muted-foreground': '240 5% 64.9%',
    accent: '240 3.7% 15.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '339 99.98% 58.64%',
    'destructive-foreground': '0 0% 98%',
    border: '240 3.7% 15.9%',
    input: '218 15.75% 14.18%',
    ring: '218 55.03% 62.67%',
  },
} satisfies { light: ColorVars; dark: ColorVars }

const blackColor: Color = {
  h: 0,
  s: 0,
  l: 0.01,
}
const whiteColor: Color = {
  h: 0,
  s: 0,
  l: 0.97,
}

export const toHsl = (color: object) => {
  const { h, s, l } = converter('hsl')(
    toGamut('okhsl')({
      mode: 'hsl',
      ...color,
    }),
  )

  return { h, s, l }
}

export const hslToString = (color: Color): HSL => {
  const { h, s, l } = toHsl({
    mode: 'okhsl',
    ...color,
  })

  return `${Math.trunc(h)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`
}

export const hexToHsl = (hex: string) => {
  const { h, s, l } = converter('hsl')(hex)

  return { h, s, l }
}

const _反转色 = (h) => {
  return h < 180 ? h + 180 : h - 180
}

function limit(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

const _colorUtils = {
  mix: (color1: Color, color2: Color, ratio: number) => {
    const { h, s, l } = color1
    const { h: hh, s: ss, l: ll } = color2

    const hh_ = hh * ratio
    const ss_ = ss * ratio
    const ll_ = ll * ratio

    return {
      h: hh_,
      s: ss_,
      l: ll_,
    }
  },
  // 调整颜色
  adjust: (color: Color, { h, s, l }: Partial<Color>) => {
    return {
      h: limit(color.h + (h ?? 0), 0, 360),
      s: limit(color.s + (s ?? 0), 0, 0.37),
      l: limit(color.l + (l ?? 0), 0, 100),
    }
  },
  /**
   * 调整到指定的颜色
   */
  adjustTo: (color: Color, to: Partial<Color>) => {
    return {
      h: limit(to.h ?? color.h, 0, 360),
      s: limit(to.s ?? color.s, 0, 0.37),
      l: limit(to.l ?? color.l, 0, 100),
    }
  },
}

const _flipWhiteOrBlack = (color: Color) => {
  // black  to white
  if (color.l < 0.5) {
    return {
      h: color.h,
      s: color.s,
      l: 0.97,
    }
  }
  return {
    h: color.h,
    s: color.s,
    l: 0.01,
  }
}

export const generateTheme = (
  {
    accentHue,
    background: background2,
    chroma,
    lightness,
  }: {
    accentHue: number
    chroma: number
    lightness: number

    background: { h: number; s: number; l: number }
  },
  isDark?: boolean,
): ColorVars => {
  const defaultColors = isDark ? defaults.dark : defaults.light
  const darkLightness = isDark ? 0.15 : 0.97
  const _isBlackOrWhite = (color: number) => color > 0.9 || color < 0.08
  const calculateContrast = (baseColor: Color) => (baseColor.s + 0.05) / (baseColor.h / 255 + 0.05)

  const base = toHsl(background2)
  const _isBlack = base.l < 0.08
  const _isWhite = base.l > 0.9
  const _contrast = calculateContrast(base)

  const isLight2 = base.l > 0.5

  const _isBaseLight = base.l > 0.5
  const textColor =
    // mroe dark
    base.l > 0.5 ? blackColor : whiteColor

  // 色相 hue

  const backgroundHsl: Color = {
    h: base.h,
    s: base.s,
    l: base.l,
  }
  if (isDark) {
    backgroundHsl.l = backgroundHsl.l * 0.7
  }
  // 如果 background 是黑色，则更加黯否则更加亮
  const backgroundSubHsl: Color = {
    h: backgroundHsl.h,
    s: isLight2 ? backgroundHsl.s * 0.93 : backgroundHsl.s,
    l: isLight2 ? backgroundHsl.l * 0.97 : backgroundHsl.l * (1 - 0.01),
  }

  /**
   * 浅色： chroma 不变， lightness 增加更亮
   * 深色： chroma 减少更加暗淡， lightness 增加更亮
   */
  const backgroundStep1Hsl: Color = {
    h: backgroundHsl.h,
    s: isLight2 ? backgroundHsl.s : backgroundHsl.s * 0.96,
    l: backgroundHsl.l * (1 + 0.1),
  }
  const backgroundStep2Hsl: Color = {
    h: backgroundHsl.h,
    s: isLight2 ? backgroundHsl.s : backgroundHsl.s * 0.95,
    l: backgroundHsl.l * (1 + 0.2),
  }
  const backgroundStep3Hsl: Color = {
    h: backgroundHsl.h,
    s: isLight2 ? backgroundHsl.s : backgroundHsl.s * 0.94,
    l: backgroundHsl.l * (1 + 0.3),
  }

  const foregroundHsl: Color = {
    ...textColor,
  }

  const primaryHsl: Color = {
    h: accentHue,
    s: chroma,
    l: limit(lightness, 0.01, 0.99),
  }
  const primaryForegroundHsl: Color = {
    // 混合 text color hue 和 primary hue
    h: accentHue,
    s: lightness > 0.5 ? chroma * 0.4 : chroma * 0.4,
    l: lightness > 0.5 ? 0.1 + chroma * 0.1 : 0.97,
  }

  const secondaryHsl: Color = {
    ...primaryHsl,
    s: primaryHsl.s * 0.1,
    l: primaryHsl.l * 0.99,
  }
  const secondaryForegroundHsl: Color = {
    ...secondaryHsl,
    s: primaryHsl.s * 0.4,
    l: lightness > 0.5 ? 0.1 + chroma * 0.1 : 0.97,
  }

  const accentHsl: Color = {
    h: primaryHsl.h,
    s: primaryHsl.s * 0.9,
    l: primaryHsl.l * 0.96,
  }
  const accentForegroundHsl: Color = {
    ...accentHsl,
    s: primaryHsl.s * 0.4,
    l: lightness > 0.5 ? 0.1 + chroma * 0.1 : 0.97,
  }

  const mutedHsl: Color = {
    ...primaryHsl,
    s: primaryHsl.s * 0.6,
    l: primaryHsl.l * 0.8,
  }
  const mutedForegroundHsl: Color = {
    ...primaryForegroundHsl,
  }

  let destructive: Color
  let destructiveFg: Color
  if (primaryHsl.h > 300 || primaryHsl.h < 60) {
    destructive = {
      h: Math.random() * 30,
      s: 1,
      l: darkLightness,
    }
    destructiveFg = { h: Math.random() * 30, s: 1, l: primaryHsl.l }
  } else {
    destructive = { h: Math.random() * 30, s: 1, l: primaryHsl.l }
    destructiveFg = primaryForegroundHsl
  }

  /**
   * 生成 Card 的颜色
   * - 接近 primary 色相的 card 色相, 往 primary 色相上下移动 10度
   */

  const cardHue = primaryHsl.h + 10
  const cardChoma = primaryHsl.s * 0.6 // 较低的饱和度
  const cardLightness = isDark ? 0.12 : 0.97 // 在 Dark
  const card: Color = {
    h: cardHue,
    s: cardChoma,
    l: cardLightness,
  }
  const cardFg: Color = {
    h: cardHue,
    s: cardChoma * 0.6, // 稍微增加饱和度以提高对比度，但仍然保持较低
    l: cardLightness > 0.7 ? 0.1 : 0.97, // 对比 card 的亮度进行调整
  }

  /**
   * 生成 input 相关的颜色，较为中性色
   */
  const inputColor = {
    h: primaryHsl.h,
    s: 0.15,
    l: darkLightness,
  }

  const borderHsl: Color = {
    h: backgroundHsl.h,
    s: backgroundHsl.s * 0.9,
    l: backgroundHsl.l * 0.9,
  }

  return {
    ...defaultColors,

    foreground: hslToString(foregroundHsl),

    'background-sub': hslToString(backgroundSubHsl), // 更加深
    background: hslToString(backgroundHsl),
    'background-step-1': hslToString(backgroundStep1Hsl), // 更加浅
    'background-step-2': hslToString(backgroundStep2Hsl), // 更加浅
    'background-step-3': hslToString(backgroundStep3Hsl), // 更加浅

    primary: hslToString(primaryHsl),
    'primary-foreground': hslToString(primaryForegroundHsl),

    secondary: hslToString(secondaryHsl),
    'secondary-foreground': hslToString(secondaryForegroundHsl),

    // 用户选择
    accent: hslToString(accentHsl),
    'accent-foreground': hslToString(accentForegroundHsl),

    muted: hslToString(mutedHsl),
    'muted-foreground': hslToString(mutedForegroundHsl),

    destructive: hslToString(destructive),
    'destructive-foreground': hslToString(destructiveFg),

    // 生成出来的
    card: hslToString(card),
    'card-foreground': hslToString(cardFg),

    popover: hslToString(card),
    'popover-foreground': hslToString(cardFg),

    input: hslToString(inputColor),
    border: hslToString(borderHsl),

    ring: hslToString(primaryHsl),
  }
}

export const chromaGradient = (h: number, l: number) => {
  const left = toHsl({ mode: 'okhsl', h, s: 0, l })
  const right = toHsl({ mode: 'okhsl', h, s: 1, l })
  return `linear-gradient(90deg, hsl(${left}) 0%, hsl(${right}) 100%)`
}

export const lightnessGradient = (h: number, s: number) => {
  const left = toHsl({ mode: 'okhsl', h, s, l: 0.01 })
  const right = toHsl({ mode: 'okhsl', h, s, l: 0.99 })
  return `linear-gradient(90deg, hsl(${left}) 0%, hsl(${right}) 100%)`
}

export const randomHue = () => Math.trunc(Math.random() * 360)
export const randomLightness = () => Math.trunc(Math.random() * 10) + 50
export const randomDarkLightness = () => Math.trunc(Math.random() * 5) + 50
export const DefaultChoma = 100
