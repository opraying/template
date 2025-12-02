import { make } from '@xstack/sqlite/kysely'
import type { TablesEncoded } from './tables'

const { DBLive, DB } = make<TablesEncoded>()

export { DBLive, DB }

export * from './tables'
