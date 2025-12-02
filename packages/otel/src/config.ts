import * as Config from 'effect/Config'

export const OTEL_CONFIG = Config.all({
  namespace: Config.string('NAMESPACE').pipe(Config.withDefault('')),
  name: Config.string('NAME').pipe(Config.withDefault('')),
  provider: Config.string('PROVIDER').pipe(Config.option, Config.nested('OTEL')),
  apiKey: Config.redacted('API_KEY').pipe(Config.option, Config.nested('OTEL')),
  version: Config.string('VERSION').pipe(Config.withDefault('0.0.1'), Config.nested('OTEL')),
})
export type OtelConfig = Config.Config.Success<typeof OTEL_CONFIG>
