import { PortableText } from '@portabletext/react'
import type { ArbitraryTypedObject, PortableTextBlock, PortableTextMarkDefinition } from '@portabletext/types'
import type { Image, PortableTextSpan, Slug } from '@xstack/cms/sanity'
import type { QueryResult } from '@xstack/cms/sanity'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { cn } from '@/lib/utils'

export const imageAttributes = {
  width: 688,
  height: 368,
}

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

export type ChangelogResponse = {
  changelogs: Array<Changelog>
  total: number
}

export type LoaderData =
  | { success: false; error: Error }
  | {
      success: true
      result: {
        changelogs: QueryResult<ChangelogResponse> & {
          pagination: {
            page: number
            size: number
            total: number
            totalPages: number
          }
        }
      }
    }

export interface ChangeLogItemProps {
  date: string
  image: {
    url: string
    width: number
    height: number
  }
  author: {
    name: string
    bio: string
    image: string
  }
  body: PortableTextBlock<PortableTextMarkDefinition, ArbitraryTypedObject | PortableTextSpan, string, string>[]
  title: string
  flatten?: boolean
}

export const ChangeLogItem = ({ date, image, body, title, author, flatten }: ChangeLogItemProps) => {
  const formatDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className={cn('flex flex-col md:flex-row', flatten && 'md:flex-col')}>
      <div className={cn('min-w-[25%] py-fl-2xs px-fl-sm hidden md:block', flatten && 'hidden md:hidden')}>
        <div className="text-fl-base">{formatDate}</div>
        <div className="flex items-center space-x-fl-xs py-fl-xs">
          <img
            draggable={false}
            crossOrigin="anonymous"
            src={author.image}
            width={36}
            height={36}
            alt=""
            className="object-cover rounded-full overflow-hidden"
          />
          <div>
            <div>{author.name}</div>
            <div className="text-muted-foreground text-fl-xs">{author.bio}</div>
          </div>
        </div>
      </div>
      <div className={cn('flex-1 border-b py-fl-xs max-w-[688px] xl:min-w-[788px]', flatten ? '' : 'py-fl-md-xl')}>
        <AspectRatio ratio={image.width / image.height} className="rounded-xl overflow-hidden">
          <img
            draggable={false}
            crossOrigin="anonymous"
            src={image.url}
            width={image.width}
            height={image.height}
            alt=""
            className="object-cover object-center size-full "
          />
        </AspectRatio>
        <p className={cn('text-fl-xl pt-fl-md pb-fl-xs')}>{title}</p>
        <div className={cn('flex items-center justify-between', flatten ? 'pb-fl-xs' : 'md:hidden py-fl-2xs')}>
          <div className="flex items-center space-x-fl-2xs">
            <img
              draggable={false}
              crossOrigin="anonymous"
              src={author.image}
              width={36}
              height={36}
              alt=""
              className="object-cover rounded-full overflow-hidden"
            />
            <div>
              <div>{author.name}</div>
              <div className="text-muted-foreground text-fl-xs">{author.bio}</div>
            </div>
          </div>
          <div className={cn('', flatten && 'pt-2')}>{formatDate}</div>
        </div>
        <div className="prose dark:prose-invert">
          <PortableText value={body} />
        </div>
      </div>
    </div>
  )
}
