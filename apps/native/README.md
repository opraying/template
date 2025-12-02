# XStack Mobile Template

A modern React Native mobile app built with Expo Router, Effect, NativeWind, and local-first architecture.

## 🚀 Features

- **Expo Router**: File-based routing with tabs navigation
- **NativeWind**: TailwindCSS for React Native with platform-consistent styling
- **Effect**: Functional programming with Effect-TS
- **Local-first**: Event log system with offline-first data storage
- **SwiftUI Components**: Native iOS components via @expo/ui
- **Real-time Sync**: Automatic data synchronization when online
- **TypeScript**: Full type safety throughout the application

## 📱 App Structure

The app uses Expo Router with a tab-based navigation structure:

### Tabs

1. **Home** (`/`) - Welcome screen with app overview
2. **Components** (`/components`) - Showcase of SwiftUI components
3. **Sync** (`/sync`) - Event log and synchronization status
4. **Settings** (`/settings`) - App configuration and preferences
5. **Test** (`/test`) - Testing page for navigation and interactive components

## 🎨 Styling with NativeWind

This app uses NativeWind (TailwindCSS for React Native) with platform-consistent design:

### iOS-Style Design System

- **Colors**: Custom iOS system colors (`ios-blue`, `ios-green`, etc.)
- **Typography**: System fonts (`font-system`, `font-mono`)
- **Spacing**: iOS-standard spacing values
- **Shadows**: iOS-style shadow utilities (`shadow-ios`)
- **Border Radius**: iOS corner radius (`rounded-ios`, `rounded-ios-lg`)

### Key Design Principles

1. **Platform Consistency**: Uses iOS system colors and spacing
2. **Accessibility**: Proper contrast ratios and touch targets
3. **Modern UI**: Clean, minimal design with subtle shadows
4. **Responsive**: Adapts to different screen sizes

### Custom Tailwind Classes

```css
/* iOS System Colors */
bg-ios-blue, text-ios-blue
bg-ios-green, text-ios-green
bg-ios-red, text-ios-red
bg-ios-gray-50 to bg-ios-gray-900

/* System Backgrounds */
bg-system-background
bg-secondary-background

/* iOS Styling */
rounded-ios, rounded-ios-lg, rounded-ios-xl
shadow-ios, shadow-ios-lg
font-system, font-mono
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or physical device

### Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

### Project Structure

```
app/
├── _layout.tsx          # Root layout with tabs
├── index.tsx            # Home page
├── components.tsx       # UI components showcase
├── sync.tsx             # Sync status and event log
├── settings.tsx         # App settings
├── test.tsx             # Testing page
├── agent.ts             # Effect agent setup
└── global.css           # NativeWind styles

tailwind.config.js       # Tailwind configuration
nativewind-env.d.ts      # NativeWind type definitions
```

## 🎯 Key Technologies

- **Expo Router**: File-based routing system
- **NativeWind**: TailwindCSS for React Native
- **Effect**: Functional programming library
- **@expo/ui**: SwiftUI components for React Native
- **React Native Safe Area Context**: Safe area handling
- **TypeScript**: Type safety and developer experience

## 📚 Styling Guidelines

### Using NativeWind Classes

```tsx
// Platform-consistent styling
<View className="bg-system-background p-5 rounded-ios-lg shadow-ios">
  <Text className="text-ios-gray-900 font-system text-lg font-semibold">Title</Text>
  <Text className="text-ios-gray-600 font-system text-sm">Description</Text>
</View>
```

### Status Indicators

```tsx
// Dynamic status styling
<View className={`p-4 rounded-ios ${getStatusBgColor(status)}`}>
  <Text className={`font-semibold ${getStatusColor(status)}`}>{status.toUpperCase()}</Text>
</View>
```

## 🔧 Configuration

### Tailwind Config

The `tailwind.config.js` includes:

- iOS system colors
- Platform-consistent spacing
- iOS-style shadows and border radius
- System font families

### NativeWind Setup

1. Global CSS imported in `_layout.tsx`
2. Type definitions in `nativewind-env.d.ts`
3. Preset configuration in `tailwind.config.js`

## 📱 Platform Consistency

The app follows iOS design guidelines:

- System colors and typography
- Standard spacing and layout patterns
- Native-feeling interactions
- Proper accessibility support

This ensures the app feels native on iOS while maintaining cross-platform compatibility.
