import * as CMSQueries from '@cms/queries'
import { toPlainText } from '@portabletext/react'
import { Api } from '@server/api-client'
import { ContactSendError } from '@server/errors'
import { ContactFormSchema } from '@server/schema'
import { changelogConfig, siteConfig } from '@shared/config'
import * as I18n from '@xstack/i18n/i18n'
import * as RR from '@xstack/react-router/effect'
import type { ActionType, LoaderType } from '@xstack/react-router/utils'
import { DiscordNotification } from '@xstack/server/notification/discord'
import * as Ratelimit from '@xstack/server/ratelimit'
import { RSSBuilder, type RSSItem } from '@xstack/server/rss'
import { type ISitemapField, SitemapBuilder } from '@xstack/server/sitemap'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

const DefaultRatelimit = () => ({
  algorithm: Ratelimit.native(),
})

export const sitemapLoader = RR.loader(
  Effect.gen(function* () {
    const baseURL = siteConfig.url
    const builder = new SitemapBuilder()

    // url
    const baseUrl = ['', '/home', '/pricing', '/changelog', '/about', '/contact', '/terms', '/privacy', '/rss.xml']
    const urls: ISitemapField[] = baseUrl.map(
      (url) =>
        ({
          loc: `${baseURL}${url}`,
          trailingSlash: true,
          changefreq: 'weekly',
          priority: 0.8,
        }) satisfies ISitemapField,
    )

    const { totalPages } = yield* CMSQueries.changelogCount({ size: changelogConfig.size })

    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        urls.push({
          loc: `${baseURL}/changelog?page=${i}`,
          lastmod: new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.8,
        })
      }
    }

    const content = builder.buildSitemapXml([...urls])

    const bytes = new TextEncoder().encode(content).byteLength

    return new Response(content, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': bytes.toString(),
      },
    })
  }),
  {
    name: 'sitemap.generate',
    ratelimit: () => ({
      algorithm: Ratelimit.native('tier_8'),
    }),
  },
)

export const rssLoader = RR.loader(
  Effect.gen(function* () {
    const baseURL = siteConfig.url
    const builder = new RSSBuilder()

    const { initial } = yield* CMSQueries.changelogs({ language: 'en', page: 1, size: 999 })

    // every page display 4 changelogs
    const changelogItems: RSSItem[] = initial.data.changelogs.map((changelog, index) => {
      const page = Math.floor(index / 2) + 1
      const url = `${baseURL}/changelog${page === changelogConfig.startPage ? '' : `?page=${page}`}`

      return {
        title: changelog.title,
        description: toPlainText(changelog.body),
        guid: url,
        link: url,
        pubDate: new Date(changelog.publishedAt).toUTCString(),
        author: changelog.author.name,
      } satisfies RSSItem
    })

    const content = builder.build({
      title: 'Changelog',
      description: 'Changelog',
      link: `${baseURL}/changelog`,
      copyright: siteConfig.copyright,
      generator: siteConfig.name,
      language: 'en',
      webMaster: siteConfig.email,
      items: changelogItems,
      lastBuildDate: new Date().toUTCString(),
    })

    const bytes = new TextEncoder().encode(content).byteLength

    return new Response(content, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': bytes.toString(),
      },
    })
  }),
  {
    name: 'rss.generate',
    ratelimit: () => ({
      algorithm: Ratelimit.native('tier_8'),
    }),
  },
)

const ChangelogSearchSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => changelogConfig.startPage }),
  size: Schema.optionalWith(Schema.NumberFromString, { default: () => changelogConfig.size }),
  raw: Schema.optional(Schema.BooleanFromUnknown),
})

export const homeLoader = RR.loader(
  Effect.gen(function* () {
    const api = yield* Api

    const pricing = yield* api.plans.list()

    return { pricing }
  }).pipe(Effect.provide(Api.Default)),
  {
    name: 'home',
    ratelimit: DefaultRatelimit,
  },
)
export type HomeLoader = LoaderType<typeof homeLoader>

export const pricingLoader = RR.loader(
  Effect.gen(function* () {
    const api = yield* Api
    const results = yield* api.plans.list2()

    return results
  }).pipe(Effect.provide(Api.Default)),
  {
    name: 'pricing',
    ratelimit: DefaultRatelimit,
  },
)
export type PricingLoader = LoaderType<typeof pricingLoader>

export const changelogLoader = RR.loader(
  Effect.gen(function* () {
    const { page, size, raw } = yield* RR.getSearchParams(ChangelogSearchSchema)
    const language = yield* I18n.language
    const changelogs = yield* CMSQueries.changelogs({
      language,
      page,
      size,
    })

    if (raw) {
      return new Response(JSON.stringify(changelogs)) as any
    }

    return { changelogs }
  }),
  {
    name: 'changelogs',
    ratelimit: DefaultRatelimit,
  },
)
export type ChangelogLoader = LoaderType<typeof changelogLoader>

// ----- Contact -----

export const contactAction = RR.action(
  Effect.gen(function* () {
    const formData = yield* RR.getFormData(ContactFormSchema)

    yield* DiscordNotification.embers({
      color: DiscordNotification.Colors.blue,
      title: 'New Contact Form Submission',
      username: `${siteConfig.namespace} Contact Form`,
      fields: [
        { name: 'Name', value: formData.name, inline: false },
        { name: 'Email', value: formData.email, inline: false },
        { name: 'Message', value: formData.message },
      ],
      avatarUrl: siteConfig.logo,
    }).pipe(
      Effect.catchAll((error) => new ContactSendError({ message: 'Error sending contact form', cause: error })),
      Effect.withSpan('contact.send-discord'),
    )
  }).pipe(
    Effect.provide(DiscordNotification.Live),
    Effect.catchTags({
      '@react-router:form-data-parse-error': (error) =>
        new ContactSendError({ message: 'Invalid form data', cause: error }),
    }),
  ),
  {
    name: 'contact',
    ratelimit: () => ({
      algorithm: Ratelimit.native('tier_8'),
    }),
  },
)
export type ContactAction = ActionType<typeof contactAction>
