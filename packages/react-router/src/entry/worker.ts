import { I18nServerWrapper } from '@xstack/i18n/server-wrapper'
import { makeServer, handleError } from '@xstack/react-router/entry/internal/server'
import { createElement } from 'react'
// @ts-ignore
import { type ReactDOMServerReadableStream, renderToReadableStream } from 'react-dom/server.edge'
import { ServerRouter } from 'react-router'

export const make = makeServer({
  component: ({ context, request }) =>
    createElement(I18nServerWrapper, {
      children: createElement(ServerRouter, { context, url: request.url }),
    }),
  render: ({ children, isBot, responseHeaders, responseStatusCode, headers, request }) => {
    return new Promise<Response>((resolve, reject) => {
      responseHeaders.set('Content-Type', 'text/html')

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders.set(key, value)
        }
      }

      renderToReadableStream(children, {
        signal: request.signal,
        onError: (error: any) => {
          if (error?.status) {
            responseHeaders.set('X-Error-Status', error.status)
          }

          reject(error)
        },
      })
        .then((body: ReactDOMServerReadableStream) => {
          if (isBot) {
            return body.allReady.then(() => body)
          }

          return body
        })
        .then((body: ReactDOMServerReadableStream) => {
          const response = new Response(body, {
            headers: responseHeaders,
            status: responseStatusCode,
          })

          resolve(response)
        })
    })
  },
})

export { handleError }
