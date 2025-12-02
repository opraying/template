# @xstack/toaster

A cross-platform toast notification system with unified API for web and React Native, built with Effect system integration and **full sonner compatibility**.

## Features

- 🌐 **Cross-platform**: Works on web (using sonner) and React Native (using Alert)
- 🔄 **Unified API**: Identical interface across all platforms with **100% sonner compatibility**
- ⚡ **Effect Integration**: Built-in Effect system support for functional programming
- 🎯 **Multiple Usage Patterns**: Direct usage, React providers, Effect layers, and HOCs
- 📱 **React Native Ready**: Graceful fallbacks for platform limitations
- 🎨 **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🔧 **Flexible**: Use with or without Effect system

## Installation

```bash
npm install @xstack/toaster sonner
# or
yarn add @xstack/toaster sonner
# or
pnpm add @xstack/toaster sonner
```

## Sonner Compatibility

This package provides **100% API compatibility** with [sonner](https://sonner.emilkowal.ski/), including:

- ✅ All toast methods (`success`, `error`, `info`, `warning`, `loading`, `custom`, `message`, `promise`, `dismiss`)
- ✅ Complete `ExternalToast` interface with all sonner options
- ✅ Full `PromiseData` support for promise-based toasts
- ✅ `titleT` type supporting strings, functions, and React nodes
- ✅ All styling options (`className`, `classNames`, `style`, etc.)
- ✅ Action and cancel button support
- ✅ Rich colors, positioning, and duration controls
- ✅ Custom icons and descriptions

You can use this package as a drop-in replacement for sonner with additional cross-platform support.

## Usage Patterns

### 1. Direct Usage (Make Functions)

```typescript
import { makeWebToaster, makeNativeToaster } from '@xstack/toaster'

// Web platform
const toast = makeWebToaster()

// Native platform
const toast = makeNativeToaster()

// Usage (identical API across platforms)
toast.success('Operation completed!')
toast.error('Something went wrong', {
  description: 'Please try again later',
  action: {
    label: 'Retry',
    onClick: () => console.log('Retrying...'),
  },
})

// Promise toast
toast.promise(
  fetch('/api/data').then((res) => res.json()),
  {
    loading: 'Loading data...',
    success: (data) => `Loaded ${data.items.length} items`,
    error: 'Failed to load data',
  },
)
```

### 2. React Provider Pattern

```tsx
// App.tsx
import { ToasterProvider } from '@xstack/toaster'
import { Toaster } from 'sonner' // For web

function App() {
  return (
    <ToasterProvider>
      <Toaster /> {/* Only needed for web */}
      <YourApp />
    </ToasterProvider>
  )
}

// Component.tsx
import { useToaster } from '@xstack/toaster'

function MyComponent() {
  const toast = useToaster()

  return <button onClick={() => toast.success('Hello!')}>Show Toast</button>
}
```

### 3. Effect System Integration

```typescript
import { Effect, Layer } from 'effect'
import { Toaster, WebToaster } from '@xstack/toaster'

const program = Effect.gen(function* () {
  const toast = yield* Toaster

  yield* toast.success('Effect-powered toast!')

  yield* toast.promise(
    Effect.promise(() => fetch('/api/data')),
    {
      loading: 'Loading...',
      success: 'Data loaded!',
      error: 'Failed to load',
    },
  )
})

// Run with web toaster
Effect.runPromise(program.pipe(Layer.provide(WebToaster)))
```

### 4. Higher-Order Component

```tsx
import { withToaster, WithToasterProps } from '@xstack/toaster'

interface Props extends WithToasterProps {
  message: string
}

function MyComponent({ message, toast }: Props) {
  return <button onClick={() => toast.info(message)}>Show Message</button>
}

export default withToaster(MyComponent)
```

## API Reference

### Toast Methods

All methods return `string | number` (toast ID) and accept the same parameters as sonner:

```typescript
// Basic toast
toast(message: titleT, data?: ExternalToast): string | number

// Variant methods
toast.success(message: titleT, data?: ExternalToast): string | number
toast.error(message: titleT, data?: ExternalToast): string | number
toast.info(message: titleT, data?: ExternalToast): string | number
toast.warning(message: titleT, data?: ExternalToast): string | number
toast.loading(message: titleT, data?: ExternalToast): string | number
toast.message(message: titleT, data?: ExternalToast): string | number

// Custom JSX toast (web only, fallback on native)
toast.custom(jsx: (id: string | number) => React.ReactElement, data?: ExternalToast): string | number

// Promise toast
toast.promise<T>(
  promise: Promise<T> | (() => Promise<T>),
  data?: PromiseData<T>
): string | number & { unwrap: () => Promise<T> }

// Dismiss toasts
toast.dismiss(id?: string | number): string | number
```

### Types

```typescript
// Title can be string, function, or React node (same as sonner)
type titleT = (() => React.ReactNode) | React.ReactNode

// Full sonner-compatible ExternalToast interface
interface ExternalToast {
  id?: number | string
  duration?: number
  position?: Position
  dismissible?: boolean
  icon?: React.ReactNode
  richColors?: boolean
  invert?: boolean
  closeButton?: boolean
  description?: (() => React.ReactNode) | React.ReactNode
  className?: string
  classNames?: ToastClassnames
  descriptionClassName?: string
  style?: React.CSSProperties
  unstyled?: boolean
  action?: Action | React.ReactNode
  cancel?: Action | React.ReactNode
  onDismiss?: (toast: any) => void
  onAutoClose?: (toast: any) => void
  // ... and more
}

// Promise toast configuration
interface PromiseData<ToastData = any> {
  loading?: string | React.ReactNode
  success?: PromiseResult<ToastData> | PromiseExtendedResultFunction<ToastData>
  error?: PromiseResult | PromiseExtendedResultFunction
  description?: PromiseResult
  finally?: () => void | Promise<void>
  // ... plus all ExternalToast fields
}
```

## Platform Differences

### Web (using sonner)

- ✅ Full feature support
- ✅ Custom JSX components
- ✅ Rich styling and animations
- ✅ Positioning and stacking
- ✅ Swipe to dismiss

### React Native (using Alert)

- ✅ Basic toast functionality
- ✅ Success/error/info/warning variants with emoji
- ✅ Promise toast support
- ⚠️ Custom JSX → Generic message
- ⚠️ Limited styling (native Alert constraints)
- ⚠️ No positioning or animations

## Migration from Sonner

This package is designed as a drop-in replacement for sonner with additional cross-platform support:

```typescript
// Before (sonner only)
import { toast } from 'sonner'

// After (cross-platform)
import { makeWebToaster } from '@xstack/toaster'
const toast = makeWebToaster()

// API remains exactly the same!
toast.success('Hello world!')
```

## Examples

### Basic Usage

```typescript
// Simple success toast
toast.success('File saved successfully!')

// Error with description and action
toast.error('Upload failed', {
  description: 'The file size exceeds the limit',
  action: {
    label: 'Retry',
    onClick: () => retryUpload(),
  },
})
```

### Promise Toast

```typescript
// API call with loading states
const uploadId = toast.promise(uploadFile(file), {
  loading: 'Uploading file...',
  success: (result) => `File uploaded: ${result.filename}`,
  error: (error) => `Upload failed: ${error.message}`,
  finally: () => setUploading(false),
})

// Access the underlying promise
const result = await uploadId.unwrap()
```

### Custom Styling

```typescript
// Custom styled toast (web)
toast('Custom notification', {
  className: 'my-toast',
  classNames: {
    title: 'font-bold text-blue-600',
    description: 'text-gray-500',
  },
  style: {
    background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
  },
})
```

## License

MIT
