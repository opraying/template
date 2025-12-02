import { Live } from '@client/context'
import { PreferenceSettingsSchema } from '@client/profile/schema'
import { makeAtomService, UseUseServices } from '@xstack/atom-react'
import { SyncSettings } from '@xstack/local-first/services'
import * as Effect from 'effect/Effect'

export class ProfileService extends Effect.Service<ProfileService>()('@client:profile-service', {
  accessors: true,
  effect: Effect.gen(function* () {
    const preferenceSettings = yield* SyncSettings.sync('preferences-settings', PreferenceSettingsSchema)

    return {
      preferenceSettings,
    }
  }),
  dependencies: [],
}) {
  static get useAtom() {
    return makeAtomService(this, useProfileService)
  }
}

const useProfileService = UseUseServices(
  { ProfileService },
  Live,
)(({ runtime, services: { ProfileService } }) => {
  const preferenceSettings = SyncSettings.createAtomBinding(runtime, ProfileService.preferenceSettings)

  return {
    preferenceSettings,
  }
})
