export interface RSSItem {
  title: string
  description: string
  link: string
  guid: string
  pubDate: string
  author?: string | undefined
}

export interface BuildOptions {
  generator?: string | undefined
  copyright?: string
  title: string
  description: string
  link: string
  language?: string | undefined
  webMaster?: string | undefined
  lastBuildDate?: string | undefined
  items: Array<RSSItem>
}

export class RSSBuilder {
  escapeXml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  build({ copyright, description, generator, items, language, lastBuildDate, link, title, webMaster }: BuildOptions) {
    const rssItems = items
      .map((item) =>
        [
          '    <item>',
          `      <title><![CDATA[${this.escapeXml(item.title)}]]></title>`,
          `      <description><![CDATA[${item.description}]]></description>`,
          `      <link isPermaLink="false">${item.link}</link>`,
          `      <guid>${item.guid}</guid>`,
          `      <pubDate>${item.pubDate}</pubDate>`,
          item.author && `      <author><![CDATA[${this.escapeXml(item.author)}]]></author>`,
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n')

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      `    <atom:link href="${link}" rel="self" type="application/rss+xml"></atom:link>`,
      `    <title><![CDATA[${this.escapeXml(title)}]]></title>`,
      `    <description><![CDATA[${this.escapeXml(description)}]]></description>`,
      `    <link>${link}</link>`,
      copyright && `    <copyright>${this.escapeXml(copyright)}</copyright>`,
      generator && `    <generator>${this.escapeXml(generator)}</generator>`,
      language && `    <language>${this.escapeXml(language)}</language>`,
      webMaster && `    <webMaster>${this.escapeXml(webMaster)}</webMaster>`,
      lastBuildDate && `    <lastBuildDate>${this.escapeXml(lastBuildDate)}</lastBuildDate>`,
      rssItems,
      '  </channel>',
      '</rss>',
    ]
      .filter(Boolean)
      .join('\n')
  }
}
