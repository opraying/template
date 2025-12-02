import { LoadingIndicatorElement } from '@xstack/app/components/loading-indicator'
import loadingScript from '@xstack/react-router/inline-scripts/loading.js?raw'
import pwaEnvScript from '@xstack/react-router/inline-scripts/pwa-env.js?raw'
import screenMeasureScript from '@xstack/react-router/inline-scripts/screen-measure.js?raw'
import themeSetScript from '@xstack/react-router/inline-scripts/theme-set.js?raw'
import { NavigationProvider } from '@xstack/router/noop'
import { ToasterProvider } from '@xstack/toaster/noop'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Links, Meta, Scripts } from 'react-router'
import { cn } from '@/lib/utils'

const commonMeta = (
  <>
    <meta charSet="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge;" />
    <meta
      name="viewport"
      content="width=device-width, user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0"
    />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
  </>
)

interface DocumentProps {
  htmlClassName?: string | undefined
  bodyClassName?: string | undefined
  lang?: string | undefined
  dir?: 'ltr' | 'rtl' | undefined
  meta?: ReactNode | undefined
  links?: ReactNode | undefined
  scripts?: ReactNode | undefined
  children?: ReactNode
}

function ShellDocument({ htmlClassName, bodyClassName, lang, dir, meta, links, scripts, children }: DocumentProps) {
  return (
    <html suppressHydrationWarning className={htmlClassName} lang={lang} dir={dir}>
      <head>
        {commonMeta}
        {meta}
        {links}
        {/* <meta id="__react_pwa_meta" /> */}
        <meta id="__react_pwa_modulepreload" />
        <meta id="__react_pwa_links" />
        {scripts}
      </head>
      <body className={bodyClassName}>
        {children}
        <div id="__react_pwa_hydrate_data" />
        <script id="__react_pwa_context" />
        <script id="__react_pwa_route_modules" />
      </body>
    </html>
  )
}

function HydrateDocument({ htmlClassName, bodyClassName, lang, dir, scripts, meta, links, children }: DocumentProps) {
  return (
    <html suppressHydrationWarning className={htmlClassName} lang={lang} dir={dir}>
      <head>
        {commonMeta}
        {meta}
        {links}
        <Meta />
        <Links />
        {scripts}
      </head>
      <body suppressHydrationWarning className={bodyClassName}>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

const stringToStyleObj = (style: string) => {
  return style.split(';').reduce(
    (acc, item) => {
      const [key, value] = item.split(':')
      if (key && value) {
        // value: padding-right to paddingRight
        const keyArr = key.split('-')
        if (keyArr.length > 1) {
          keyArr.forEach((item, index) => {
            if (index > 0) {
              keyArr[index] = item.charAt(0).toUpperCase() + item.slice(1)
            }
          })
          acc[keyArr.join('')] = value.trim()
        } else {
          acc[key] = value.trim()
        }
      }
      return acc
    },
    {} as Record<string, string>,
  )
}

function ClientRenderDocument({ htmlClassName, bodyClassName, lang, dir, meta, links, children }: DocumentProps) {
  const documentExist = typeof document !== 'undefined'
  const originHtmlClass = documentExist ? document.documentElement.className : ''
  const originHtmlStyle = documentExist ? document.documentElement.style.cssText : ''
  const originHtmlLang = documentExist ? document.documentElement.lang : ''
  const originBodyClass = documentExist ? document.body.className : ''

  // @ts-ignore
  const hydrateData = globalThis.__react_pwa_hydrate_data

  if (!import.meta.env.DEV && !hydrateData) {
    throw new Error('react router pwa hydrate data not found')
  }

  const modulepreload = hydrateData?.modulepreload?.map((item: any) => {
    if (item.type === 'script') {
      return <link key={item.href} rel="modulepreload" href={item.href} as="script" crossOrigin="" />
    }

    return <link key={item.href} rel="modulepreload" href={item.href} />
  })

  const originHtmlStyleObj = originHtmlStyle ? stringToStyleObj(originHtmlStyle) : {}

  return (
    <html
      suppressHydrationWarning
      className={cn(htmlClassName, originHtmlClass)}
      lang={lang || originHtmlLang}
      dir={dir}
      style={originHtmlStyleObj}
    >
      <head>
        {commonMeta}
        {meta}
        {/* {links} */}
        <Meta />
        {/* <Links /> */}
        {modulepreload}
      </head>
      <body className={cn(bodyClassName, originBodyClass)}>{children}</body>
    </html>
  )
}

const HeadScripts = memo(({ children, websiteId }: { children: ReactNode; websiteId?: string | undefined }) => {
  return (
    <>
      {websiteId && (
        <script
          defer
          src="https://insight.opraying.com/script.js"
          crossOrigin="anonymous"
          data-website-id={websiteId}
        />
      )}
      <script dangerouslySetInnerHTML={{ __html: screenMeasureScript }} />
      {children}
      <script dangerouslySetInnerHTML={{ __html: themeSetScript }} />
      <script dangerouslySetInnerHTML={{ __html: loadingScript }} />
    </>
  )
})

const BodyScripts = memo(
  ({ includeScript, something }: { includeScript?: boolean | undefined; something?: ReactNode | undefined }) => {
    return (
      <>
        {includeScript && (
          <>
            {something}
            <script dangerouslySetInnerHTML={{ __html: pwaEnvScript }} />
          </>
        )}
      </>
    )
  },
)

interface RootHTMLProps extends DocumentProps {
  something?: ReactNode | undefined
  isShell?: boolean | undefined
  websiteId?: string | undefined
}

export function RootHTML({
  htmlClassName,
  bodyClassName,
  meta,
  links,
  scripts,
  something,
  children,
  isShell,
  websiteId,
}: RootHTMLProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  // const dir = i18n.dir()

  const hasHydrateMode = import.meta.env.SSR
    ? true
    : // @ts-ignore
      typeof globalThis !== 'undefined' && globalThis.__react_pwa_render_mode === 'hydrate'
  const Doc = isShell ? ShellDocument : hasHydrateMode ? HydrateDocument : ClientRenderDocument
  const includeScript = isShell || hasHydrateMode

  return (
    <Doc
      htmlClassName={htmlClassName}
      bodyClassName={bodyClassName}
      lang={lang}
      // dir={dir}
      meta={meta}
      links={links}
      scripts={<HeadScripts websiteId={import.meta.env.PROD ? websiteId : undefined}>{scripts}</HeadScripts>}
    >
      <BodyScripts something={something} includeScript={includeScript} />
      <LoadingIndicatorElement />
      <div className="root-layout" data-content="main" id="root-layout">
        <NavigationProvider>
          <ToasterProvider>{!isShell && children}</ToasterProvider>
        </NavigationProvider>
      </div>
    </Doc>
  )
}
