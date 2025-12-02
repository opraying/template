import { DBLive } from '@server/db/make'
import { i18nConfig } from '@shared/config'
import { make, CloudflareLive } from '@xstack/preset-cloudflare/react-router'
import { CMSLive } from '@xstack/cms/dev'

import { initI18n } from '@xstack/i18n/server'
import * as Layer from 'effect/Layer'

// @ts-ignore
globalThis.initI18n = initI18n({
  ...i18nConfig,
  loadResource: (lng, ns) =>
    /* @vite-ignore */
    import(`@shared/locales/${lng}/${ns}.ts`).then((module) => module.default as {}),
})

const MainLive = Layer.mergeAll(CMSLive, DBLive, CloudflareLive)

export const contextBuilder = make(MainLive)
