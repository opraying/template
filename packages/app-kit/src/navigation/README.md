# 多层级下钻导航组件

一个类似iOS原生设置应用的多层级导航系统，支持流畅的滑动动画和触摸友好的交互。

## 功能特性

- 🏗️ **层级导航** - 支持无限层级的导航结构
- 🎯 **触摸友好** - 优化的移动端触摸体验
- 🎨 **CSS动画** - 平滑的滑入滑出动画效果
- 📱 **响应式设计** - 自适应移动端和桌面端
- 🔄 **状态管理** - 内置导航状态管理
- 🧩 **组件化** - 提供丰富的预设组件
- 🔧 **可定制** - 灵活的配置选项

## 快速开始

### 基本用法

```tsx
import { DrillDownNavigator, createNavigationItem, openMobileNavigationDialog } from '@xstack/app-kit/navigation'

// 创建导航结构
const navigationLevel = {
  title: 'Settings',
  items: [
    createNavigationItem('account', 'Account')
      .subtitle('Manage your account')
      .icon(<i className="i-lucide-user size-5" />)
      .onPress(() => console.log('Account pressed'))
      .build(),

    createNavigationItem('notifications', 'Notifications')
      .subtitle('Push, email, desktop')
      .icon(<i className="i-lucide-bell size-5" />)
      .children([
        createNavigationItem('push', 'Push Notifications')
          .onPress(() => console.log('Push notifications'))
          .build(),
        createNavigationItem('email', 'Email Notifications')
          .onPress(() => console.log('Email notifications'))
          .build(),
      ])
      .build(),
  ],
}

// 在对话框中打开
function MyComponent() {
  const handleOpenSettings = () => {
    openMobileNavigationDialog({
      initialLevel: navigationLevel,
      showBreadcrumb: true,
    })
  }

  return <button onClick={handleOpenSettings}>Open Settings</button>
}
```

### 使用自定义组件

```tsx
import { SettingToggle, SettingSection, SettingButton } from '@xstack/app-kit/navigation'

const NotificationSettings = () => (
  <div className="space-y-4">
    <SettingSection title="Push Notifications">
      <SettingToggle
        title="Enable Notifications"
        description="Receive push notifications"
        checked={enabled}
        onCheckedChange={setEnabled}
      />
    </SettingSection>

    <SettingSection>
      <SettingButton
        title="Clear All Notifications"
        description="Remove all pending notifications"
        icon={<i className="i-lucide-trash size-5" />}
        onPress={clearNotifications}
      />
    </SettingSection>
  </div>
)

// 在导航中使用
createNavigationItem('notifications', 'Notifications')
  .component(<NotificationSettings />)
  .build()
```

## 核心组件

### DrillDownNavigator

主导航容器组件，管理导航状态和层级切换。

```tsx
<DrillDownNavigator initialLevel={navigationLevel} className="h-screen">
  {/* 可选的额外内容，如面包屑 */}
  <NavigationBreadcrumb />
</DrillDownNavigator>
```

### MobileNavigationDialog

在对话框中显示导航的便捷组件。

```tsx
// 直接调用函数打开
openMobileNavigationDialog({
  initialLevel: navigationLevel,
  showBreadcrumb: true,
  className: 'custom-style',
})
```

### NavigationItemBuilder

用于构建导航项的建造者模式API。

```tsx
createNavigationItem('id', 'Title')
  .subtitle('Optional subtitle')
  .icon(<CustomIcon />)
  .badge('New')
  .rightIcon(<ChevronRight />)
  .onPress(() => handlePress())
  .children([...childItems])
  .component(<CustomComponent />)
  .build()
```

## 预设组件

### SettingToggle - 开关设置

```tsx
<SettingToggle
  title="Enable Feature"
  description="Toggle this feature on/off"
  checked={isEnabled}
  onCheckedChange={setIsEnabled}
  disabled={false}
/>
```

### SettingSection - 设置分组

```tsx
<SettingSection title="General Settings">
  <SettingToggle {...} />
  <SettingButton {...} />
</SettingSection>
```

### SettingButton - 设置按钮

```tsx
<SettingButton
  title="Reset Settings"
  description="Reset all settings to default"
  icon={<ResetIcon />}
  rightText="Default"
  variant="destructive"
  onPress={handleReset}
/>
```

### SettingInput - 设置输入框

```tsx
<SettingInput
  title="Display Name"
  description="Your display name"
  value={name}
  onValueChange={setName}
  placeholder="Enter name"
  type="text"
/>
```

### StatusBadge - 状态指示器

```tsx
<StatusBadge status="online" /> // online, offline, syncing, error
```

## 导航钩子

### useNavigation

在导航组件内部访问导航状态和控制方法。

```tsx
function CustomNavigationComponent() {
  const {
    state, // 当前导航状态
    pushLevel, // 推入新层级
    popLevel, // 返回上一层级
    goToLevel, // 跳转到指定层级
    canGoBack, // 是否可以返回
  } = useNavigation()

  return (
    <div>
      <span>Current Level: {state.currentLevelIndex}</span>
      {canGoBack && <button onClick={popLevel}>Back</button>}
    </div>
  )
}
```

## 类型定义

### NavigationItem

```tsx
interface NavigationItem {
  id: string
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: string | number
  rightIcon?: ReactNode
  onPress?: () => void
  children?: NavigationItem[]
  component?: ReactNode
}
```

### NavigationLevel

```tsx
interface NavigationLevel {
  title: string
  items: NavigationItem[]
  component?: ReactNode
}
```

## 样式定制

组件使用 Tailwind CSS 类，可以通过 `className` 属性进行定制：

```tsx
<DrillDownNavigator
  className="custom-navigation-style"
  initialLevel={level}
/>

<SettingSection
  className="custom-section-style"
  title="My Settings"
>
  ...
</SettingSection>
```

## 最佳实践

1. **层级结构** - 保持导航层级不要过深（建议不超过4-5层）
2. **图标一致性** - 使用统一的图标库（如Lucide）
3. **交互反馈** - 为重要操作提供确认对话框
4. **加载状态** - 对于异步操作显示加载状态
5. **错误处理** - 为网络错误等情况提供友好的错误信息

## 完整示例

查看 `examples/settings-navigation-example.tsx` 获取完整的设置页面示例，展示了如何构建复杂的导航结构。

## 与现有系统集成

这个导航系统设计为与现有的 xstack 生态系统无缝集成：

- 使用 `@xstack/app-kit/lib/screen-utils` 进行响应式检测
- 集成现有的对话框系统
- 支持国际化 (i18n)
- 兼容现有的主题系统
