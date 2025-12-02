import { createReadableStreamFromReadable } from '@react-router/node'
import { I18nServerWrapper } from '@xstack/i18n/server-wrapper'
import { handleError, makeServer } from '@xstack/react-router/entry/internal/server'
// @ts-ignore
import { PassThrough } from 'node:stream'
import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { ServerRouter } from 'react-router'

export const make = makeServer({
  component: ({ context, request }) =>
    createElement(I18nServerWrapper, {
      children: createElement(ServerRouter, { context, url: request.url }),
    }),
  render: ({ children, isBot, responseHeaders, responseStatusCode, timeout, request, headers }) => {
    return new Promise<Response>((resolve, reject) => {
      const callbackName = isBot ? 'onAllReady' : 'onShellReady'
      responseHeaders.set('Content-Type', 'text/html')

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders.set(key, value)
        }
      }

      const { abort, pipe } = renderToPipeableStream(children, {
        [callbackName]: () => {
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)

          const response = new Response(stream, {
            headers: responseHeaders,
            status: responseStatusCode,
          })

          resolve(response)

          pipe(body)
        },
        onError: (error: any) => {
          if (error?.status) {
            responseHeaders.set('X-Error-Status', error.status)
          }
        },
        onShellError: (error: any) => {
          reject(error)
        },
      })

      const handleAbort = () => {
        request.signal.removeEventListener('abort', handleAbort)
        abort()
      }

      request.signal.addEventListener('abort', handleAbort)
      setTimeout(abort, timeout)
    })
  },
})

export { handleError }
