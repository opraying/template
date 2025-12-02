import type { PortableTextBlock } from '@portabletext/types'
import type { Image, Slug } from '@xstack/cms/sanity'
import * as CMS from '@xstack/cms'
import * as Effect from 'effect/Effect'
import groq from 'groq'

// Author

const _AUTHOR_LIST = groq`
*[_type == "author"] {
  name,
  bio,
  image
}`

export interface Author {
  name: string
  bio: string
  image: Image
}

// Changelog
export interface Changelog {
  _id: string
  publishedAt: string
  title: string
  author: {
    name: string
    image: Image
    bio: string
  }
  slug: Slug
  mainImage?: Image
  body: Array<PortableTextBlock>
}

const CHANGELOGS = groq`
  {
    "changelogs": *[
      _type == "changelog" &&
      defined(slug.current)
    ] {
      _id,
      publishedAt,
      title,
      slug,
      mainImage,
      body,
      "author": author->{name, image, bio}
    } | order(publishedAt desc) {...} [$start...$end],

    "total": count(*[
      _type == "changelog" &&
      defined(slug.current)
    ])
  }
`

export const changelogs = ({ language, page, size }: { language: string; page: number; size?: number | undefined }) => {
  type ChangelogResponse = {
    changelogs: Array<Changelog>
    total: number
  }

  return CMS.loadQueryWithPagination<ChangelogResponse>('changelogs', CHANGELOGS, {
    page,
    size,
  })
}

export const changelogCount = ({ size }: { size: number }) => {
  return CMS.loadQuery<number>('changelogCount', groq`count(*[_type == "changelog" && defined(slug.current)])`).pipe(
    Effect.andThen((_) => {
      return {
        totalPages: Math.ceil(_.initial.data / size),
      }
    }),
  )
}
