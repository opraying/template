import { DBLive } from '@client/db'
import { Migrator } from '@xstack/db'
import { Events } from '@xstack/event-log'
import { SettingsEvents } from '@xstack/local-first/services/settings'
import { make } from '@xstack/local-first/worker-context'
import schemaSql from './db/schema.sql?raw'

const MigratorLive = Migrator.fromRecord(() => {
  const migrations: Record<string, string> = import.meta.glob('./migrations/**/migration.sql', {
    eager: true,
    query: '?raw',
    import: 'default',
  })

  return { schemaSql, migrations }
})

const EventLogRegistry = Events.register(SettingsEvents)

export const { Live } = make({
  DBLive,
  MigratorLive,
  EventLogRegistry,
})
