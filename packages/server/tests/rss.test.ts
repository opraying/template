import { describe, expect, it } from '@effect/vitest'
import { XMLValidator } from 'fast-xml-parser'
import { RSSBuilder } from '../src/rss'

describe.concurrent('RSSBuilder', () => {
  it('snapshot test for RSS feed', () => {
    // Builder instance
    const builder = new RSSBuilder()

    // Build content
    const content = builder.build({
      title: 'Example RSS Feed',
      description: 'An example RSS feed.',
      generator: 'Example Generator',
      language: 'en',
      lastBuildDate: 'Mon, 01 Jan 2000 00:00:00 GMT',
      webMaster: 'news-webmaster@google.com (Frank Luksa)',
      link: 'https://example.com',
      items: [
        {
          title: 'Example Item',
          description: 'An example item.',
          link: 'https://example.com/item',
          guid: 'https://example.com/item',
          pubDate: 'Mon, 01 Jan 2000 00:00:00 GMT',
        },
        {
          title: 'Example Item 2',
          description: 'An example item 2.',
          link: 'https://example.com/item2',
          guid: 'https://example.com/item2',
          pubDate: 'Mon, 01 Jan 2000 00:00:00 GMT',
        },
      ],
    })
    const isValid = XMLValidator.validate(content)
    expect(isValid).toBe(true)
    // Expect the generated RSS feed to match snapshot.
    expect(content).toMatchSnapshot()
  })
})
