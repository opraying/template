# PWA 日志系统

## 概述

PWA 日志系统提供了统一的日志记录和调试功能，帮助开发者排查 PWA 相关问题。

## 启用日志

有两种方式启用 PWA 日志：

### 1. 通过 localStorage

```javascript
// 在浏览器控制台中执行
localStorage.setItem('pwa-debug', 'true')
```

### 2. 通过 URL 参数

```
https://your-app.com/?pwa-debug
```

## 日志级别

- `debug`: 详细的调试信息
- `info`: 一般信息
- `warn`: 警告信息
- `error`: 错误信息

## 日志分类

### 主线程日志

- `🔧 PWA [Install]`: PWA 安装相关
- `🔧 PWA [Installation]`: 安装提示相关
- `🔧 PWA [ServiceWorker]`: Service Worker 相关
- `🔧 PWA [Lifecycle]`: 应用生命周期相关

### Service Worker 日志

- `🔧 PWA [SW]`: Service Worker 核心功能
- `🔧 PWA [Handle]`: 请求处理相关

## 常见调试场景

### 1. PWA 安装问题

启用日志后，查看控制台中的以下日志：

```
🔧 PWA [Install]: PWA Installation Initialization
🔧 PWA [Installation]: PWA Install Prompt Handler Initialization
🔧 PWA [Requirements]: PWA Requirements Check
```

### 2. Service Worker 问题

查看 Service Worker 相关日志：

```
🔧 PWA [SW]: React Router PWA Initialization
🔧 PWA [SW]: Service Worker Registration (Production)
🔧 PWA [Handle]: Creating PWA handler
```

### 3. 缓存问题

查看缓存相关日志：

```
🔧 PWA [Handle] Cache: Cache hit for route root
🔧 PWA [Handle] Cache: Cache miss for route about, trying server
```

### 4. 网络问题

查看网络状态日志：

```
🔧 PWA [Handle] Network: Status (fetchRouteLoaderData): online (cached 1234ms ago)
🔧 PWA [Handle] Network: Device offline for route root, skipping server and trying fallback
```

## 关闭日志

```javascript
// 在浏览器控制台中执行
localStorage.removeItem('pwa-debug')
```

或者移除 URL 中的 `pwa-debug` 参数。

## 注意事项

1. 日志仅在启用时才会输出，对性能影响最小
2. 生产环境中建议谨慎使用，避免暴露敏感信息
3. Service Worker 中的日志需要在 Service Worker 的控制台中查看
4. 日志输出使用 console.group 进行分组，便于查看

## 示例调试流程

1. 启用日志：`localStorage.setItem('pwa-debug', 'true')`
2. 刷新页面
3. 查看控制台日志输出
4. 根据日志信息定位问题
5. 修复问题后关闭日志
