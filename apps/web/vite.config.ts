import { reactRouter } from '../../packages/vite/src/vite-config'

export default reactRouter(import.meta.dirname, {
  port: 5420,
  vite: {
    publicDir: '../shared/public',
  },
})
