import { useInitialLoaderDataWithPagination } from '@xstack/cms/hooks'
import { urlFor } from '@xstack/cms/image'
import { useTranslation } from 'react-i18next'
import { useLoaderData } from 'react-router'
import { Button } from '@/components/ui/button'
import { ChangeLogItem, imageAttributes, type LoaderData } from './types'

export const ChangeLogLink = () => {
  return (
    <span className="inline-flex items-center space-x-1">
      <span>Read more</span>
      <i className="i-lucide-chevron-right h-4 w-4" />
    </span>
  )
}

const useChangelogs = () => {
  const data = useLoaderData() as LoaderData

  if (!data.success) {
    throw data.error
  }

  return useInitialLoaderDataWithPagination(data.result.changelogs)
}

export type ChangelogsProps = {
  title: string
  description: string
}

export const Changelogs = ({ title, description }: ChangelogsProps) => {
  // const title = "Changelog"
  // const description = `New updates and improvements to ${siteConfig.name}.`
  const { data, loading, error, pagination } = useChangelogs()
  const { t } = useTranslation()

  if (!data) {
    return null
  }

  if (error) {
    throw error
  }

  const changelogs = data.changelogs

  return (
    <>
      <p className="text-fl-2xl font-normal linear-gradient-text">{title}</p>
      <p className="py-fl-sm text-fl-base">{description}</p>
      <div className="pt-fl-lg space-y-fl-md-lg">
        {loading && (
          <div className="flex items-center justify-center">
            <p className="text-lg text-slate-400">Loading...</p>
          </div>
        )}
        {changelogs.map((changelog) => {
          const image = changelog.mainImage
            ? urlFor(changelog.mainImage)
                .auto('format')
                .width(Math.ceil(imageAttributes.width * 1.5))
                .height(Math.ceil(imageAttributes.height * 1.5))
                .url()
            : ''

          const authorUrl = changelog.author.image
            ? urlFor(changelog.author.image).auto('format').width(64).height(64).url()
            : ''

          return (
            <ChangeLogItem
              key={changelog._id}
              image={{
                url: image,
                width: imageAttributes.width,
                height: imageAttributes.height,
              }}
              title={changelog.title}
              author={{
                name: changelog.author.name,
                image: authorUrl,
                bio: changelog.author.bio,
              }}
              body={changelog.body}
              date={changelog.publishedAt}
            />
          )
        })}
      </div>
      <div className="max-w-2xl py-fl-lg mx-auto">
        <div className="flex gap-6 justify-between">
          {pagination.hasPrev && (
            <Button variant="ghost" className="flex-1 flex justify-between py-3 h-auto col-span-full" asChild>
              <a href={`/changelog?page=${pagination.prev}`}>
                <i className="i-lucide-arrow-left size-6" />
                <div className="text-left">
                  <div className="min-h-6 text-primary">{t('misc.previous')}</div>
                </div>
              </a>
            </Button>
          )}
          {pagination.hasNext && (
            <Button variant="ghost" className="flex-1 flex justify-between py-3 h-auto" asChild>
              <a href={`/changelog?page=${pagination.next}`}>
                <div className="text-left">
                  <div className="min-h-6 text-primary">{t('misc.next')}</div>
                </div>
                <i className="i-lucide-arrow-right size-6" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
