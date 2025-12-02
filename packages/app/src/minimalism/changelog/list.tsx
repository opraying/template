import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import { urlFor } from '@xstack/cms/image'
import { makeContinuousLoadAtom } from '@xstack/atom-react'
import * as Chunk from 'effect/Chunk'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Stream from 'effect/Stream'
import { Button } from '@/components/ui/button'
import { ChangeLogItem, type Changelog, imageAttributes } from './types'

const List = ({
  data,
  loading,
  onLoadMore,
  hasDone,
}: {
  data: ReadonlyArray<Changelog>
  loading: boolean
  onLoadMore: () => void
  hasDone: boolean
}) => {
  return (
    <>
      {data.map((changelog) => {
        const url = changelog.mainImage
          ? urlFor(changelog.mainImage)
              .auto('format')
              .width(Math.ceil(imageAttributes.width * 1.5))
              .height(Math.ceil(imageAttributes.height * 1.5))
              .url()
          : ''
        const authorUrl = urlFor(changelog.author.image).auto('format').width(32).height(32).url()

        return (
          <ChangeLogItem
            key={changelog._id}
            flatten
            image={{
              url,
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
      {data.length > 0 && (
        <div>
          {hasDone ? (
            <div>
              <p className="text-fl-base text-center">No more updates</p>
            </div>
          ) : (
            <div>
              <Button onClick={() => onLoadMore()} disabled={hasDone || loading}>
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const perPage = 5

const dataId = '"data",'

const stream = (_: { batchSize: number }) =>
  Stream.paginateChunkEffect(0, (pageNumber) =>
    Effect.gen(function* () {
      const res = yield* HttpClient.get('/changelog.data', {
        urlParams: { _routes: 'changelog', raw: true, size: _.batchSize, page: pageNumber },
      })
      const text = yield* res.text
      const json: { initial: { data: { changelogs: ReadonlyArray<Changelog> } } } = yield* Effect.try(() => {
        const dataIndex = text.indexOf(dataId)
        if (dataIndex === -1) throw new Error('Data not found')

        const jsonContent = text.slice(dataIndex + dataId.length, text.length - 2)
        const results = JSON.parse(JSON.parse(jsonContent)) as {
          initial: { data: { changelogs: ReadonlyArray<Changelog> } }
        }

        return results
      }).pipe(
        Effect.orElseSucceed(() => {
          return {
            initial: {
              data: {
                changelogs: [],
              },
            },
          }
        }),
      )

      const changelogs = json.initial.data.changelogs

      return [
        Chunk.fromIterable(changelogs),
        Option.some(pageNumber + 1).pipe(Option.filter(() => changelogs.length === _.batchSize)),
      ]
    }),
  ).pipe(Stream.bufferChunks({ capacity: 2 }), Stream.provideLayer(FetchHttpClient.layer))

const changelogsAtom = makeContinuousLoadAtom({ batchSize: perPage }, stream)

const useChangelogs = () => changelogsAtom.use()

export function ChangelogLoadList() {
  const { loading, done, loadMore, value } = useChangelogs()

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="loader2" />
        </div>
      )}
      <List data={value} hasDone={done} loading={loading} onLoadMore={loadMore} />
    </>
  )
}
