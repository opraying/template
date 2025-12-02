import { i18nConfig } from '@shared/config'
import { installPwa } from '@xstack/app/pwa/install'
import { initI18n } from '@xstack/i18n/client'
import { init } from '@xstack/react-router/entry/client'

installPwa()
initI18n({ initOptions: i18nConfig, load: (lng, ns) => import(`@shared/locales/${lng}/${ns}.ts`) })
if (import.meta.env.MODE !== 'test') {
  init()
}
