/** @type {import('tailwindcss').Config} */
const { platformSelect, platformColor, hairlineWidth, fontScale, roundToNearestPixel } = require('nativewind/theme')

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./app/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Platform-specific iOS system colors
        'ios-blue': platformSelect({
          ios: platformColor('systemBlue'),
          default: '#007AFF',
        }),
        'ios-green': platformSelect({
          ios: platformColor('systemGreen'),
          default: '#34C759',
        }),
        'ios-red': platformSelect({
          ios: platformColor('systemRed'),
          default: '#FF3B30',
        }),
        'ios-orange': platformSelect({
          ios: platformColor('systemOrange'),
          default: '#FF9500',
        }),
        'ios-purple': platformSelect({
          ios: platformColor('systemPurple'),
          default: '#AF52DE',
        }),
        'ios-pink': platformSelect({
          ios: platformColor('systemPink'),
          default: '#FF2D92',
        }),
        'ios-teal': platformSelect({
          ios: platformColor('systemTeal'),
          default: '#5AC8FA',
        }),
        'ios-yellow': platformSelect({
          ios: platformColor('systemYellow'),
          default: '#FFCC00',
        }),
        // Platform-specific system grays
        'ios-gray': {
          50: platformSelect({
            ios: platformColor('systemGray6'),
            default: '#F2F2F7',
          }),
          100: platformSelect({
            ios: platformColor('systemGray5'),
            default: '#E5E5EA',
          }),
          200: platformSelect({
            ios: platformColor('systemGray4'),
            default: '#D1D1D6',
          }),
          300: platformSelect({
            ios: platformColor('systemGray3'),
            default: '#C7C7CC',
          }),
          400: platformSelect({
            ios: platformColor('systemGray2'),
            default: '#AEAEB2',
          }),
          500: platformSelect({
            ios: platformColor('systemGray'),
            default: '#8E8E93',
          }),
          600: platformSelect({
            ios: platformColor('label'),
            default: '#636366',
          }),
          700: platformSelect({
            ios: platformColor('secondaryLabel'),
            default: '#48484A',
          }),
          800: platformSelect({
            ios: platformColor('tertiaryLabel'),
            default: '#3A3A3C',
          }),
          900: platformSelect({
            ios: platformColor('quaternaryLabel'),
            default: '#1C1C1E',
          }),
        },
        // Platform-specific background colors
        'system-background': platformSelect({
          ios: platformColor('systemBackground'),
          default: '#FFFFFF',
        }),
        'secondary-background': platformSelect({
          ios: platformColor('secondarySystemBackground'),
          default: '#F2F2F7',
        }),
        'tertiary-background': platformSelect({
          ios: platformColor('tertiarySystemBackground'),
          default: '#FFFFFF',
        }),
        'grouped-background': platformSelect({
          ios: platformColor('systemGroupedBackground'),
          default: '#F2F2F7',
        }),
        'secondary-grouped-background': platformSelect({
          ios: platformColor('secondarySystemGroupedBackground'),
          default: '#FFFFFF',
        }),
      },
      fontFamily: {
        // Platform-specific system fonts
        system: platformSelect({
          ios: ['-apple-system', 'SF Pro Display'],
          android: ['Roboto', 'sans-serif'],
          default: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'Arial', 'sans-serif'],
        }),
        mono: platformSelect({
          ios: ['SF Mono'],
          android: ['Roboto Mono'],
          default: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
        }),
      },
      fontSize: {
        // Responsive font sizes using fontScale
        'xs-responsive': fontScale(12),
        'sm-responsive': fontScale(14),
        'base-responsive': fontScale(16),
        'lg-responsive': fontScale(18),
        'xl-responsive': fontScale(20),
        '2xl-responsive': fontScale(24),
        '3xl-responsive': fontScale(30),
      },
      spacing: {
        // iOS standard spacing with pixel-perfect values
        4.5: roundToNearestPixel(18),
        5.5: roundToNearestPixel(22),
        6.5: roundToNearestPixel(26),
        7.5: roundToNearestPixel(30),
        8.5: roundToNearestPixel(34),
        9.5: roundToNearestPixel(38),
        // Pixel ratio based spacing
        // "pixel-1": pixelRatio(1),
        // "pixel-2": pixelRatio(2),
        // "pixel-4": pixelRatio(4),
      },
      borderWidth: {
        // Platform-specific hairline width
        hairline: hairlineWidth(),
        // Pixel ratio based borders
        // "pixel-1": pixelRatio(1),
        // "pixel-2": pixelRatio(2),
      },
      borderRadius: {
        // Platform-specific corner radius
        ios: platformSelect({
          ios: 10,
          android: 8,
          default: 10,
        }),
        'ios-lg': platformSelect({
          ios: 16,
          android: 12,
          default: 16,
        }),
        'ios-xl': platformSelect({
          ios: 20,
          android: 16,
          default: 20,
        }),
      },
      opacity: {
        // Platform-specific opacity values
        disabled: platformSelect({
          ios: 0.3,
          android: 0.38,
          default: 0.3,
        }),
      },
    },
  },
  plugins: [],
}
