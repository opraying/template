import { DBLive } from '@server/db/make'
import { i18nConfig } from '@shared/config'
import { make, CloudflareLive } from '@xstack/preset-cloudflare/react-router'
import { CMSLive } from '@xstack/cms/fetch'

import { initI18n } from '@xstack/i18n/server'
import * as Layer from 'effect/Layer'

// @ts-ignore
globalThis.initI18n = initI18n({
  ...i18nConfig,
  loadResource(lng: (typeof i18nConfig)['supportedLngs'][number], _ns) {
    switch (lng) {
      case 'zh-Hans':
        // @ts-ignore
        return import('../shared/locales/zh-Hans/translation.js').then((module) => module.default as {})
      default:
        // @ts-ignore
        return import('../shared/locales/en/translation.js').then((module) => module.default as {})
    }
  },
})

const MainLive = Layer.mergeAll(CMSLive, DBLive, CloudflareLive)

export const contextBuilder = make(MainLive)
