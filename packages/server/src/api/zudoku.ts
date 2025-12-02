import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import * as Effect from 'effect/Effect'
import type * as Layer from 'effect/Layer'

export const ZudokuLayer = (options?: { readonly path?: `/${string}` | undefined }): Layer.Layer<never, never> =>
  HttpApiBuilder.Router.use((router) =>
    Effect.gen(function* () {
      const response = HttpServerResponse.html(`<!doctype html>
  <html>
    <head>
      <title>API</title>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script type="module" src="https://cdn.zudoku.dev/latest/main.js" crossorigin></script>
      <link rel="stylesheet" href="https://cdn.zudoku.dev/latest/style.css" crossorigin />
    </head>
    <body>
      <script>
       const host = window.location.host
       const protocol = window.location.protocol
       const apiUrl = protocol + "//" + host + "/api/openapi.json"
       const doc = document.createElement("div")
       doc.setAttribute("data-api-url", apiUrl)
       document.body.appendChild(doc)
      </script>
    </body>
  </html>`)
      yield* router.get(options?.path ?? '/docs', Effect.succeed(response))
    }),
  )
