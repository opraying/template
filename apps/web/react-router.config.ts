import type { Config } from '@react-router/dev/config'

export default {
  ssr: true,
  appDirectory: './',
  buildDirectory: '../../dist/template/web',
  future: {
    unstable_optimizeDeps: true,
    v8_splitRouteModules: 'enforce',
  },
} satisfies Config
