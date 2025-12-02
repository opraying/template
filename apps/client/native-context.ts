import { Api } from '@client/api-client'
import { DBLive } from '@client/db'
import { Migrator } from '@xstack/db'
import { Events } from '@xstack/event-log'
import { make } from '@xstack/preset-react-native/context'
import { SettingsEvents } from '@xstack/local-first/services/settings'

const MigratorLive = Migrator.fromRecord(() => {
  const migrations: Record<string, string> = {}
  const schemaSql = ''

  return { schemaSql, migrations }
})

const EventLogRegistry = Events.register(SettingsEvents)

export const { Live } = make({
  DBLive,
  MigratorLive,
  EventLogRegistry,
  inputLayer: Api.Default,
})
