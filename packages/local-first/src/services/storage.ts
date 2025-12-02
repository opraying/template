import * as SqlClient from '@effect/sql/SqlClient'
import { makeAtomService, UseUseServices } from '@xstack/atom-react'
import * as GlobalLayer from '@xstack/atom-react/global'
import type * as InternalClient from '@xstack/sqlite/internal/client'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Tracer from 'effect/Tracer'

const Live = pipe(GlobalLayer.use('LocalStorage', Tracer.Tracer, SqlClient.SqlClient))

export class LocalFirstStorageService extends Effect.Service<LocalFirstStorageService>()('LocalFirstStorageService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient) as InternalClient.SqlClient

    const export_ = Effect.fn('export')(function* () {
      const data = yield* sql.export
      const blob = new Blob([data.slice()], { type: 'application/octet-stream' })

      return blob
    })

    const import_ = Effect.fn('import')(function* (_: Uint8Array<ArrayBufferLike>) {
      yield* sql.import(_)
    })

    return {
      export: export_,
      import: import_,
    }
  }),
  dependencies: [Live],
}) {
  static get useAtom() {
    return makeAtomService(this, useStorageService)
  }
}

const useStorageService = UseUseServices({ LocalFirstStorageService })(({
  runtime,
  services: { LocalFirstStorageService },
}) => {
  const export_ = runtime.fn((options?: { filename?: string }) =>
    Effect.gen(function* () {
      const blob = yield* LocalFirstStorageService.export()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = options?.filename || 'db.sqlite'
      a.click()
    }),
  )

  const import_ = runtime.fn((_: File) =>
    Effect.gen(function* () {
      const arrayBuffer = yield* Effect.promise(() => _.arrayBuffer())
      const uint8Array = new Uint8Array(arrayBuffer)
      yield* LocalFirstStorageService.import(uint8Array)
    }),
  )

  return {
    import: import_,
    export: export_,
  }
})
