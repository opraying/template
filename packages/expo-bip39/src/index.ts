// Reexport the native module. On web, it will be resolved to ExpoBip39Module.web.ts
// and on native platforms ExpoBip39Module.ts

export * from './ExpoBip39.types.js'
export { default } from './ExpoBip39Module.js'
