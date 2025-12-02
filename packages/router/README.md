# @xstack/router

一个统一的导航接口，兼容 expo-router 和 react-router，确保在多平台环境中提供一致的导航体验。

## 特性

- 🔄 **跨平台兼容**: 同一套 API 在 Web (react-router) 和 Mobile (expo-router) 上工作
- 🎯 **类型安全**: 完整的 TypeScript 支持，包括参数类型检查
- 🚀 **Effect 集成**: 基于 Effect 库构建，提供强大的错误处理和组合能力
- 📱 **平台特定优化**: 自动处理平台差异，优化用户体验
- 🔧 **灵活配置**: 支持平台特定的导航选项
- 🎣 **多种使用方式**: 支持直接调用、Effect 系统、React Hooks 等多种使用模式
- 🤖 **自动平台检测**: Metro bundler 自动选择正确的平台实现

## 安装

```bash
npm install @xstack/router
```

## 使用方式

### 方式一：React Provider + Hooks（推荐）

这是最简单的使用方式，利用 React Native 的平台特定文件后缀机制，Metro bundler 会自动选择正确的实现。

#### 基本设置

```typescript
import { NavigationProvider } from '@xstack/router'

// Web 应用
function WebApp() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  )
}

// React Native 应用（相同的导入，不同的实现）
function MobileApp() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  )
}
```

#### 在组件中使用

```typescript
import { useNavigate, useQueryParams, useModalNavigation } from '@xstack/router'

function AppContent() {
  const navigate = useNavigate()
  const queryParams = useQueryParams<{ tab: string; filter: string }>()
  const modalNav = useModalNavigation()

  const handleNavigation = () => {
    // 基本导航
    navigate.goTo('/dashboard')

    // 带参数导航
    navigate.push({ pathname: '/user/profile', params: { id: '123' } })

    // 检查导航状态
    if (navigate.canNavigateBack) {
      navigate.back()
    }

    // 构建 URL
    const profileUrl = navigate.buildUrl('/user/profile', { id: '123', tab: 'settings' })

    // 更新查询参数
    queryParams.updateParams({ tab: 'settings', filter: 'active' })

    // 模态导航（移动端更相关）
    if (modalNav.canDismissModal) {
      modalNav.closeModal()
    }
  }

  return (
    <div>
      <button onClick={handleNavigation}>Navigate</button>
    </div>
  )
}
```

### 方式二：直接使用 make 函数

```typescript
import { makeReactRouterNavigate, makeExpoRouterNavigate } from '@xstack/router'

// 获取导航方法 - 可以直接在 React hooks 中使用
const webNavigate = makeReactRouterNavigate()
const mobileNavigate = makeExpoRouterNavigate()

// 直接使用，无需 Effect 系统
webNavigate.navigate('/about')
webNavigate.push({ pathname: '/user/profile', params: { id: '123' } })

// 检查能力
if (webNavigate.canGoBack()) {
  webNavigate.back()
}
```

### 方式三：使用 Effect 系统（用于复杂异步流程）

```typescript
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { Navigate, ReactRouterNavigate, ExpoRouterNavigate } from '@xstack/router'

const navigationFlow = Effect.gen(function* () {
  const navigate = yield* Navigate

  // 基本导航
  yield* navigate.navigate('/about')

  // 带参数导航
  yield* navigate.navigate({
    pathname: '/user/profile',
    params: { id: '123', tab: 'settings' },
  })

  // 推入新路由
  yield* navigate.push('/dashboard')

  // 替换当前路由
  yield* navigate.replace('/login')

  // 返回
  yield* navigate.back()
})

// 运行导航流程
const webApp = Layer.provide(navigationFlow, ReactRouterNavigate)
const mobileApp = Layer.provide(navigationFlow, ExpoRouterNavigate)
```

## 平台特定实现原理

### 文件结构

```
src/
├── provider.ts        # Web 实现 (React Router)
├── provider.native.ts # React Native 实现 (Expo Router)
└── useNavigate.ts     # 跨平台 Hooks
```

### 自动平台选择

当您导入 `NavigationProvider` 时：

- **Web 环境**: Metro/Webpack 会选择 `provider.ts`，使用 React Router
- **React Native 环境**: Metro bundler 会选择 `provider.native.ts`，使用 Expo Router

这意味着您只需要一次导入，平台会自动选择正确的实现：

```typescript
// 这个导入在两个平台上都有效，但会使用不同的实现
import { NavigationProvider } from '@xstack/router'
```

## API 参考

### React Hooks

#### useNavigate()

主要的导航 Hook，提供所有导航功能：

```typescript
const navigate = useNavigate()

// 基本导航方法
navigate.navigate(href, options?)
navigate.push(href, options?)
navigate.replace(href, options?)
navigate.back(delta?)

// 状态检查
navigate.canNavigateBack: boolean
navigate.canDismissModal: boolean

// 工具方法
navigate.buildUrl(pathname, params?)
navigate.isCurrentPath(path)
```

### 核心接口

#### NavigationMethods (同步方法)

```typescript
interface NavigationMethods {
  readonly back: () => void
  readonly canDismiss: () => boolean
  readonly canGoBack: () => boolean
  readonly dismiss: () => void
  readonly dismissAll: () => void
  readonly dismissTo: (href: Href, options?: NavigationOptions) => void
  readonly navigate: (href: Href, options?: NavigationOptions) => void
  readonly prefetch: (name: Href) => void
  readonly push: (href: Href, options?: NavigationOptions) => void
  readonly replace: (href: Href, options?: NavigationOptions) => void
  readonly setParams: <T = any>(params: Partial<RouteInputParams<T>>) => void
}
```

### 类型定义

#### Href

```typescript
type Href =
  | string
  | {
      pathname: string
      params?: Record<string, string>
    }
```

#### NavigationOptions

```typescript
interface NavigationOptions {
  // 通用选项
  replace?: boolean

  // Expo Router 特定选项
  relativeToDirectory?: boolean
  withAnchor?: boolean

  // React Router 特定选项
  preventScrollReset?: boolean
  relative?: 'route' | 'path'
  state?: any
  viewTransition?: boolean
  flushSync?: boolean
}
```

## 平台差异处理

### 参数处理

- **React Router**: 参数作为 URL 查询字符串处理
- **Expo Router**: 参数转换为字符串格式，数组用逗号连接

### 导航选项

- **跨平台选项**: `replace` 在两个平台都支持
- **平台特定选项**: 在不支持的平台上会被忽略

### 功能差异

| 功能           | React Router       | Expo Router       |
| -------------- | ------------------ | ----------------- |
| `canDismiss()` | 总是返回 `false`   | 检查实际状态      |
| `dismiss()`    | 等同于 `back()`    | 原生 dismiss 行为 |
| `dismissAll()` | 返回到根路由       | 关闭所有模态      |
| `prefetch()`   | 创建 link prefetch | 原生预加载        |

## 最佳实践

### 1. 选择合适的使用方式

- **React Provider + Hooks**: 适用于大多数 React 应用，推荐使用
- **直接使用 make 函数**: 适用于需要更多控制的场景
- **Effect 系统**: 适用于复杂的异步导航流程、错误处理

### 2. 利用平台特定文件

```typescript
// 无需手动检测平台，Metro bundler 会自动选择
import { NavigationProvider } from '@xstack/router'

// 在 Web 上使用 provider.ts (React Router)
// 在 React Native 上使用 provider.native.ts (Expo Router)
```

### 3. 类型安全

```typescript
// 定义路由参数类型
type UserParams = {
  id: string
  tab?: 'profile' | 'settings'
}

// 使用类型安全的参数设置
const queryParams = useQueryParams<UserParams>()
queryParams.updateParams({ id: 'user123', tab: 'settings' })
```

### 4. 错误处理

```typescript
function SafeNavigationComponent() {
  const navigate = useNavigate()

  const handleNavigation = () => {
    try {
      if (navigate.canNavigateBack) {
        navigate.back()
      } else {
        navigate.goTo('/home')
      }
    } catch (error) {
      console.error('Navigation failed:', error)
    }
  }

  return <button onClick={handleNavigation}>Safe Navigate</button>
}
```

## 示例项目

查看 `example.ts` 文件获取完整的使用示例，包括：

- React Provider 集成
- 各种 Hook 的使用
- 平台特定功能
- Effect 系统集成
- 类型安全导航
- 高级组件示例

## 许可证

MIT
