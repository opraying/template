import { fontFamily } from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        yellow: {
          DEFAULT: 'hsl(67, 91%, 55%)',
          50: 'hsl(60, 100%, 95%)',
          100: 'hsl(63, 100%, 89%)',
          200: 'hsl(65, 100%, 79%)',
          300: 'hsl(67, 99%, 67%)',
          400: 'hsl(67, 91%, 55%)',
          500: 'hsl(68, 95%, 44%)',
          600: 'hsl(69, 100%, 35%)',
          700: 'hsl(70, 91%, 27%)',
          800: 'hsl(71, 81%, 23%)',
          900: 'hsl(72, 71%, 20%)',
          950: 'hsl(73, 96%, 10%)',
        },
        neutral: {
          DEFAULT: 'hsl(0, 0%, 53%)',
          50: 'hsl(0, 0%, 96%)',
          100: 'hsl(0, 0%, 91%)',
          200: 'hsl(0, 0%, 82%)',
          300: 'hsl(0, 0%, 69%)',
          400: 'hsl(0, 0%, 53%)',
          500: 'hsl(0, 0%, 43%)',
          600: 'hsl(0, 0%, 39%)',
          700: 'hsl(0, 0%, 31%)',
          800: 'hsl(0, 0%, 27%)',
          900: 'hsl(0, 0%, 24%)',
          950: 'hsl(0, 0%, 15%)',
        },
        tangerine: {
          DEFAULT: 'hsl(22, 100%, 66%)',
          50: 'hsl(30, 100%, 96%)',
          100: 'hsl(31, 100%, 92%)',
          200: 'hsl(28, 100%, 83%)',
          300: 'hsl(26, 100%, 72%)',
          400: 'hsl(22, 100%, 66%)',
          500: 'hsl(20, 99%, 53%)',
          600: 'hsl(16, 94%, 48%)',
          700: 'hsl(13, 92%, 40%)',
          800: 'hsl(11, 83%, 34%)',
          900: 'hsl(11, 77%, 28%)',
          950: 'hsl(8, 84%, 15%)',
        },
      },
      utopia: {
        minSize: 16,
        maxSize: 20,
        minWidth: 375,
        maxWidth: 1500,
        fontSize: {
          // base 18
          xs: {
            value: 0.75, // 14
          },
          sm: {
            value: 0.875, // 16,
          },
          base: {
            value: 1, // 18,
          },
          lg: {
            value: 1.125, // 20
          },
          xl: {
            value: 1.25, // 22
          },
          '2xl': {
            value: 1.5, // 27
          },
          '3xl': {
            value: 1.875, // 34
          },
          '4xl': {
            value: 2.25, // 40
          },
          '5xl': {
            value: 3, // 54
          },
          '6xl': {
            value: 4, // 72
          },
          '7xl': {
            value: 5, // 96
          },
          '8xl': {
            value: 6, // 128
          },
        },
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
      },
      fontFamily: {
        default: ['var(--font-system)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
        sans: ['var(--font-sans)', ...fontFamily.sans],
        serif: ['var(--font-serif)', ...fontFamily.serif],

        koulen: ['Koulen', 'var(--font-sans)', ...fontFamily.sans],
        sora: ['Sora', 'var(--font-sans)', ...fontFamily.sans],
      },
      fontWeight: {
        normal: 'initial',
        medium: 'initial',
        semibold: 'initial',
        bold: 'initial',
        black: 'initial',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        '.font-normal': {
          'font-variation-settings': `'wght' 440`,
        },
        '.font-medium': {
          'font-variation-settings': `'wght' 540`,
        },
        '.font-semibold': {
          'font-variation-settings': `'wght' 600`,
        },
        '.font-bold': {
          'font-variation-settings': `'wght' 700`,
        },
        '.font-black': {
          'font-variation-settings': `'wght' 750`,
        },
      })
    }),
  ],
}
