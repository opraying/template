import * as Database from '@xstack/db'

const tables_ = [] satisfies Database.Tables

export type Tables = Database.TablesRecord<typeof tables_>

export type TablesType = Database.TablesType<Tables>

export type TablesEncoded = Database.TablesEncoded<Tables>

export const tables = Database.tables(tables_)

export const config = {
  provider: 'sqlite',
  runtime: 'browser',
}
