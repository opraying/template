import * as Headers from '@effect/platform/Headers'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { MyHttpApi } from '@xstack/internal-kit/api'
import { S3 } from '@xstack/server/s3'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'

export const HttpInternalLive = HttpApiBuilder.group(MyHttpApi, 'internal', (handles) =>
  Effect.gen(function* () {
    const s3 = yield* S3

    return handles.handleRaw('get r2 object', ({ path }) =>
      pipe(
        s3.get(path.key),
        Effect.map((object) => {
          const headers = Headers.fromInput({
            etag: object.httpEtag,
          })

          return HttpServerResponse.raw(object.body, {
            headers,
            contentType: object.httpMetadata?.contentType,
            contentLength: object.size,
            status: 200,
            statusText: 'OK',
          })
        }),
        Effect.catchAll(() => HttpServerResponse.empty({ status: 404, statusText: 'Not Found' })),
      ),
    )
  }),
)
