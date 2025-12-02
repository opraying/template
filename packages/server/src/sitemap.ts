type MaybeUndefined<T> = T | undefined
type MaybePromise<T> = T | Promise<T>

type Changefreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

/**
 * Robot.txt policy options
 */
export interface IRobotPolicy {
  /**
   * User agent name
   */
  userAgent: string

  /**
   * Disallow option(s)
   */
  disallow?: string | Array<string> | undefined

  /**
   * Allow option(s)
   */
  allow?: string | Array<string> | undefined

  /**
   * Crawl delay
   */
  crawlDelay?: number | undefined
}

/**
 * robots.txt Options
 */
export interface IRobotsTxt {
  /**
   * Crawl policies
   */
  policies?: Array<IRobotPolicy> | undefined

  /**
   * Additional sitemaps which need to be added to robots
   */
  additionalSitemaps?: Array<string> | undefined

  /**
   * From v2.4x onwards, generated `robots.txt` will only contain url of `index sitemap` and custom provided endpoints from `robotsTxtOptions.additionalSitemaps`
   *
   * This is to prevent duplicate url submission (once through index-sitemap -> sitemap-url and once through robots.txt -> HOST)
   *
   * Set this option `true` to add all generated sitemap endpoints to `robots.txt`
   * @default false
   */
  includeNonIndexSitemaps?: boolean | undefined

  /**
   * Custom robots.txt transformer
   */
  transformRobotsTxt?: ((config: IConfig, robotsTxt: string) => Promise<string>) | undefined
}

/**
 * Sitemap configuration
 */
export interface IConfig {
  /**
   * Base url of your website
   */
  siteUrl: string

  /**
   * Change frequency.
   * @default 'daily'
   */
  changefreq?: Changefreq | undefined

  /**
   * The type of build output.
   * @see https://nextjs.org/docs/pages/api-reference/next-config-js/output
   */
  output?: 'standalone' | 'export' | undefined

  /**
   * Priority
   * @default 0.7
   */
  priority?: any | undefined

  /**
   * The name of the generated sitemap file before the file extension.
   * @default "sitemap"
   */
  sitemapBaseFileName?: string | undefined

  /**
   * next.js build directory.
   * @default .next
   */
  sourceDir?: string | undefined

  /**
   * All the generated files will be exported to this directory.
   * @default public
   */
  outDir?: string | undefined

  /**
   * Split large sitemap into multiple files by specifying sitemap size.
   * @default 5000
   */
  sitemapSize?: number | undefined

  /**
   * Generate a robots.txt file and list the generated sitemaps.
   * @default false
   */
  generateRobotsTxt?: boolean | undefined

  /**
   * robots.txt options
   */
  robotsTxtOptions?: IRobotsTxt | undefined

  /**
   * Add <lastmod/> property.
   * @default true
   */
  autoLastmod?: boolean | undefined

  /**
   * Array of relative paths (wildcard pattern supported) to exclude from listing on sitemap.xml or sitemap-*.xml.
   * Apart from this option next-sitemap also offers a custom transform option which could be used to exclude urls that match specific patterns
   * @example ['/page-0', '/page-*', '/private/*']
   */
  exclude?: Array<string> | (() => Promise<Array<string>>) | undefined

  alternateRefs?: Array<IAlternateRef> | undefined

  /**
   * A transformation function, which runs for each relative-path in the sitemap. Returning null value from the transformation function will result in the exclusion of that specific path from the generated sitemap list.
   * @link https://github.com/iamvishnusankar/next-sitemap#custom-transformation-function
   */
  transform?: ((config: IConfig, url: string) => MaybePromise<MaybeUndefined<ISitemapField>>) | undefined

  /**
   * A function that returns a list of additional paths to be added to the generated sitemap list.
   * @link https://github.com/iamvishnusankar/next-sitemap#additional-paths-function
   */
  additionalPaths?: ((config: AdditionalPathsConfig) => MaybePromise<Array<MaybeUndefined<ISitemapField>>>) | undefined

  /**
   * Include trailing slash
   */
  trailingSlash?: boolean | undefined

  /**
   * Boolean to enable/disable index sitemap generation
   * If enabled next-sitemap will generate sitemap-*.xml and sitemap.xml (index sitemap)
   * @default true
   */
  generateIndexSitemap?: boolean | undefined
}

export type AdditionalPathsConfig = Readonly<
  IConfig & {
    transform: NonNullable<IConfig['transform']>
  }
>

export type IAlternateRef = {
  href: string
  hreflang: string
  hrefIsAbsolute?: boolean | undefined
}

export type IGoogleNewsEntry = {
  title: string
  date: Date | string
  publicationName: string
  publicationLanguage: string
}

export type IImageEntry = {
  loc: URL | string
  caption?: string | undefined
  geoLocation?: string | undefined
  title?: string | undefined
  license?: URL | undefined
}

export type IRestriction = {
  relationship: 'allow' | 'deny'
  content: string
}

export type IVideoEntry = {
  title: string
  thumbnailLoc: URL
  description: string
  contentLoc?: URL | undefined
  playerLoc?: URL | undefined
  duration?: number | undefined
  expirationDate?: Date | string | undefined
  rating?: number | undefined
  viewCount?: number | undefined
  publicationDate?: Date | string | undefined
  familyFriendly?: boolean | undefined
  restriction?: IRestriction | undefined
  platform?: IRestriction | undefined
  requiresSubscription?: boolean | undefined
  uploader?:
    | {
        name: string
        info?: URL
      }
    | undefined
  live?: boolean | undefined
  tag?: string | undefined
}

export type ISitemapField = {
  loc: string
  lastmod?: string | undefined
  changefreq?: Changefreq | undefined
  priority?: number | undefined
  alternateRefs?: Array<IAlternateRef> | undefined
  trailingSlash?: boolean | undefined

  news?: IGoogleNewsEntry | undefined
  images?: Array<IImageEntry> | undefined
  videos?: Array<IVideoEntry> | undefined
}

/**
 * Return UTF-8 encoded urls
 * @param path
 * @returns
 * @link https://developers.google.com/search/docs/advanced/sitemaps/build-sitemap#general-guidelines
 */
export const entityEscapedUrl = (path: string): string => {
  return path
    .replace(/&amp;/g, '&') // decode &amp; to & first, so that we don't replace &amp; again to &amp;amp;
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
}

type XMLMSFlags = 'news' | 'image' | 'video' | 'xhtml'

/**
 * Builder class to generate xml and robots.txt
 * Returns only string values
 */
export class SitemapBuilder {
  /**
   * Create XML Template
   * @param content
   * @returns
   */
  withXMLTemplate(content: string, xmlsFlags: Array<XMLMSFlags>): string {
    const flags: string[] = []

    if (xmlsFlags.includes('news')) {
      flags.push('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')
    }
    if (xmlsFlags.includes('image')) {
      flags.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    }
    if (xmlsFlags.includes('video')) {
      flags.push('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"')
    }
    if (xmlsFlags.includes('xhtml')) {
      flags.push('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ${flags.join(
      ' ',
    )}>\n${content}</urlset>`
  }

  /**
   * Generates sitemap-index.xml
   * @param allSitemaps
   * @returns
   */
  buildSitemapIndexXml(allSitemaps: Array<string>) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...(allSitemaps?.map((x) => `<sitemap><loc>${x}</loc></sitemap>`) ?? []),
      '</sitemapindex>',
    ].join('\n')
  }

  /**
   * Normalize sitemap field keys to stay consistent with <xsd:sequence> order
   * @link https://www.w3schools.com/xml/el_sequence.asp
   * @link https://github.com/iamvishnusankar/next-sitemap/issues/345
   * @param x
   * @returns
   */
  normalizeSitemapField(x: ISitemapField) {
    const { changefreq, lastmod, loc, priority, ...restProps } = x

    // Return keys in following order
    return {
      loc,
      lastmod,
      changefreq,
      priority,
      ...restProps,
    }
  }

  /**
   * Composes YYYY-MM-DDThh:mm:ssTZD date format (with TZ offset)
   * (ref: https://stackoverflow.com/a/49332027)
   * @param date
   * @private
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const z = (n: string | number) => `0${n}`.slice(-2)
    const zz = (n: string | number) => `00${n}`.slice(-3)
    let off = d.getTimezoneOffset()
    const sign = off > 0 ? '-' : '+'
    off = Math.abs(off)

    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(
      d.getSeconds(),
    )}.${zz(d.getMilliseconds())}${sign}${z((off / 60) | 0)}:${z(off % 60)}`
  }

  private formatBoolean(value: boolean): string {
    return value ? 'yes' : 'no'
  }

  private escapeHtml(s: string) {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    // @ts-ignore
    return s.replace(/[&<>"']/g, (m) => map[m])
  }

  /**
   * Generates sitemap.xml
   * @param fields
   * @returns
   */
  buildSitemapXml(fields: Array<ISitemapField>): string {
    const flags: Array<XMLMSFlags> = []

    const content = fields.reduce((acc, x: ISitemapField) => {
      // Normalize sitemap field keys to stay consistent with <xsd:sequence> order
      const field = this.normalizeSitemapField(x)

      // Field array to keep track of properties
      const fieldArr: Array<string> = []

      // Iterate all object keys and key value pair to field-set
      for (const key of Object.keys(field)) {
        // Skip reserved keys
        if (['trailingSlash'].includes(key)) {
          continue
        }

        // @ts-ignore
        if (field[key]) {
          if (key === 'alternateRefs') {
            flags.push('xhtml')

            const altRefField = this.buildAlternateRefsXml(field.alternateRefs)

            fieldArr.push(altRefField)
          } else if (key === 'news') {
            if (field.news) {
              flags.push('news')

              const newsField = this.buildNewsXml(field.news)
              fieldArr.push(newsField)
            }
          } else if (key === 'images') {
            if (field.images) {
              flags.push('image')

              for (const image of field.images) {
                const imageField = this.buildImageXml(image)
                fieldArr.push(imageField)
              }
            }
          } else if (key === 'videos') {
            if (field.videos) {
              flags.push('video')

              for (const video of field.videos) {
                const videoField = this.buildVideoXml(video)
                fieldArr.push(videoField)
              }
            }
          } else {
            // @ts-ignore
            fieldArr.push(`<${key}>${field[key]}</${key}>`)
          }
        }
      }

      // Append previous value and return
      return `${acc}<url>${fieldArr.join('')}</url>\n`
    }, '')

    return this.withXMLTemplate(content, flags)
  }

  /**
   * Generate alternate refs.xml
   * @param alternateRefs
   * @returns
   */
  buildAlternateRefsXml(alternateRefs: Array<IAlternateRef> = []): string {
    return alternateRefs
      .map((alternateRef) => {
        return `<xhtml:link rel="alternate" hreflang="${alternateRef.hreflang}" href="${alternateRef.href}"/>`
      })
      .join('')
  }

  /**
   * Generate Google News sitemap entry
   * @param news
   * @returns string
   */
  buildNewsXml(news: IGoogleNewsEntry): string {
    // using array just because it looks more structured
    return [
      '<news:news>',

      '<news:publication>',

      `<news:name>${this.escapeHtml(news.publicationName)}</news:name>`,
      `<news:language>${news.publicationLanguage}</news:language>`,

      '</news:publication>',
      `<news:publication_date>${this.formatDate(news.date)}</news:publication_date>`,
      `<news:title>${this.escapeHtml(news.title)}</news:title>`,

      '</news:news>',
    ]
      .filter(Boolean)
      .join('')
  }

  /**
   * Generate Image sitemap entry
   * @param image
   * @returns string
   */
  buildImageXml(image: IImageEntry): string {
    // using array just because it looks more structured
    if (!image || !image.loc) {
      return ''
    }
    return [
      '<image:image>',

      `<image:loc>${entityEscapedUrl(typeof image.loc === 'string' ? image.loc : image.loc.href)}</image:loc>`,
      image.caption && `<image:caption>${this.escapeHtml(image.caption)}</image:caption>`,
      image.title && `<image:title>${this.escapeHtml(image.title)}</image:title>`,
      image.geoLocation && `<image:geo_location>${this.escapeHtml(image.geoLocation)}</image:geo_location>`,
      image.license && `<image:license>${entityEscapedUrl(image.license.href)}</image:license>`,

      '</image:image>',
    ]
      .filter(Boolean)
      .join('')
  }

  /**
   * Generate Video sitemap entry
   * @param video
   * @returns string
   */
  buildVideoXml(video: IVideoEntry): string {
    // using array just because it looks more structured
    return [
      '<video:video>',

      `<video:title>${this.escapeHtml(video.title)}</video:title>`,
      `<video:thumbnail_loc>${entityEscapedUrl(video.thumbnailLoc.href)}</video:thumbnail_loc>`,
      `<video:description>${this.escapeHtml(video.description)}</video:description>`,
      video.contentLoc && `<video:content_loc>${entityEscapedUrl(video.contentLoc.href)}</video:content_loc>`,
      video.playerLoc && `<video:player_loc>${entityEscapedUrl(video.playerLoc.href)}</video:player_loc>`,
      video.duration && `<video:duration>${video.duration}</video:duration>`,
      video.viewCount && `<video:view_count>${video.viewCount}</video:view_count>`,
      video.tag && `<video:tag>${this.escapeHtml(video.tag)}</video:tag>`,
      video.rating && `<video:rating>${video.rating.toFixed(1).replace(',', '.')}</video:rating>`,
      video.expirationDate && `<video:expiration_date>${this.formatDate(video.expirationDate)}</video:expiration_date>`,
      video.publicationDate &&
        `<video:publication_date>${this.formatDate(video.publicationDate)}</video:publication_date>`,
      typeof video.familyFriendly !== 'undefined' &&
        `<video:family_friendly>${this.formatBoolean(video.familyFriendly)}</video:family_friendly>`,
      typeof video.requiresSubscription !== 'undefined' &&
        `<video:requires_subscription>${this.formatBoolean(video.requiresSubscription)}</video:requires_subscription>`,
      typeof video.live !== 'undefined' && `<video:live>${this.formatBoolean(video.live)}</video:live>`,
      video.restriction &&
        `<video:restriction relationship="${video.restriction.relationship}">${video.restriction.content}</video:restriction>`,
      video.platform &&
        `<video:platform relationship="${video.platform.relationship}">${video.platform.content}</video:platform>`,
      video.uploader &&
        `<video:uploader${video.uploader.info && ` info="${video.uploader.info}"`}>${this.escapeHtml(
          video.uploader.name,
        )}</video:uploader>`,

      '</video:video>',
    ]
      .filter(Boolean)
      .join('')
  }
}
