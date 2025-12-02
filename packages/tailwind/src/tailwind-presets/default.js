import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons'
import { fontFamily } from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
    iconsPlugin({
      // Select the icon collections you want to use
      // You can also ignore this option to automatically discover all icon collections you have installed
      collections: getIconCollections(['lucide', 'logos']),
    }),
    require('../tailwind-plugins/utopia')({
      useClamp: true,
    }),
    require('tailwindcss-animate'),
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        md: '1.6rem',
        sm: '1.2rem',
      },
    },
    extend: {
      boxShadow: {
        gradient: 'var(--bg-gradient-shadow)',
        gradient2: 'var(--bg-gradient-shadow2)',
      },
      lineHeight: {
        2: '0.625rem',
      },
      backgroundImage: {
        gradient: 'var(--bg-gradient)',
        gradient2: 'var(--bg-gradient2)',
        'rainbow-gradient':
          'linear-gradient(to bottom right, #b827fc 0%, #2c90fc 25%, #b8fd33 50%, #fec837 75%, #fd1892 100%)',
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 0.125rem)', // 2px
        DEFAULT: 'var(--radius)', // 4px
        md: 'calc(var(--radius) + 0.125rem)', // 6px
        lg: 'calc(var(--radius) + 0.25rem)', // 8px
        xl: 'calc(var(--radius) + 0.5rem)', // 12px
        '2xl': 'calc(var(--radius) + 0.75rem)', // 16px
        '3xl': 'calc(var(--radius) + 1.25rem)', // 24px
      },
      colors: {
        blue: {
          50: 'hsl(244 71.4% 95.9% / <alpha-value>)',
          100: 'hsl(240 72.2% 92.9% / <alpha-value>)',
          200: 'hsl(241.1 73.7% 85.1% / <alpha-value>)',
          300: 'hsl(240.7 73.2% 78% / <alpha-value>)',
          400: 'hsl(241.1 73.9% 70% / <alpha-value>)',
          500: 'hsl(240.9 73.4% 63.1% / <alpha-value>)',
          600: 'hsl(241 73.3% 50% / <alpha-value>)',
          700: 'hsl(240.8 73.2% 38% / <alpha-value>)',
          800: 'hsl(241.3 73.4% 25.1% / <alpha-value>)',
          900: 'hsl(241.2 72.7% 12.9% / <alpha-value>)',
          950: 'hsl(240 74.2% 6.1% / <alpha-value>)',
        },
        green: {
          50: 'hsl(136.7 69.2% 94.9% / <alpha-value>)',
          100: 'hsl(135.4 68.6% 90% / <alpha-value>)',
          200: 'hsl(135.2 69.1% 81% / <alpha-value>)',
          300: 'hsl(135 70.3% 71% / <alpha-value>)',
          400: 'hsl(135 70.1% 62% / <alpha-value>)',
          500: 'hsl(135.1 69.8% 52% / <alpha-value>)',
          600: 'hsl(135.2 70.1% 42% / <alpha-value>)',
          700: 'hsl(134.7 69.6% 31% / <alpha-value>)',
          800: 'hsl(135.2 70.1% 21% / <alpha-value>)',
          900: 'hsl(135.4 68.6% 10% / <alpha-value>)',
          950: 'hsl(133.3 69.2% 5.1% / <alpha-value>)',
        },
        yellow: {
          50: 'hsl(36 100% 96.1% / <alpha-value>)',
          100: 'hsl(36.7 100% 92.9% / <alpha-value>)',
          200: 'hsl(35.5 100% 85.1% / <alpha-value>)',
          300: 'hsl(35.9 100% 78% / <alpha-value>)',
          400: 'hsl(36.1 100% 70% / <alpha-value>)',
          500: 'hsl(36.2 100% 62.9% / <alpha-value>)',
          600: 'hsl(36 100% 50% / <alpha-value>)',
          700: 'hsl(35.9 100% 38% / <alpha-value>)',
          800: 'hsl(36.1 100% 25.1% / <alpha-value>)',
          900: 'hsl(36.4 100% 12.9% / <alpha-value>)',
          950: 'hsl(34.8 100% 6.1% / <alpha-value>)',
        },
        red: {
          50: 'hsl(351 100% 96.1% / <alpha-value>)',
          100: 'hsl(348.3 100% 92% / <alpha-value>)',
          200: 'hsl(349 100% 83.9% / <alpha-value>)',
          300: 'hsl(349.1 100% 75.1% / <alpha-value>)',
          400: 'hsl(348.9 100% 67.1% / <alpha-value>)',
          500: 'hsl(349.1 100% 59% / <alpha-value>)',
          600: 'hsl(349 100% 47.1% / <alpha-value>)',
          700: 'hsl(348.9 100% 35.1% / <alpha-value>)',
          800: 'hsl(349.2 100% 23.9% / <alpha-value>)',
          900: 'hsl(349.2 100% 12% / <alpha-value>)',
          950: 'hsl(348.4 100% 6.1% / <alpha-value>)',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        default: ['var(--font-system)', ...fontFamily.sans],
        mono: ['var(--font-mono)', ...fontFamily.mono],
        sans: ['var(--font-sans)', ...fontFamily.sans],
        serif: ['var(--font-serif)', ...fontFamily.serif],
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      transitionDuration: {
        DEFAULT: 'var(--transition-duration)',
        fast: 'var(--fast-transition-duration)',
        slow: 'var(--slow-transition-duration)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--transition-timing-function)',
      },
    },
  },
}
