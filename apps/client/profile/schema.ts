import * as Settings from '@xstack/app-kit/settings'
import * as FG from '@xstack/form/generate'
import * as I18n from '@xstack/i18n/i18n'
import { getUnsafeAppearance } from '@xstack/lib/appearance/hooks'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export const Language = new Settings.Setting(
  'language',
  Schema.String.pipe(
    FG.config({
      title: 'settings.preferences.language',
      description: 'settings.preferences.language.desc',
      componentType: 'custom',
      orientation: 'horizontal',
      component: 'LanguageSelect',
    }),
  ),
)

export const ThemeLiteral = Schema.Literal('dark', 'light', 'system')

export const Theme = new Settings.Setting(
  'theme',
  ThemeLiteral.pipe(
    FG.config({
      title: 'settings.preferences.theme',
      description: 'settings.preferences.theme.desc',
      componentType: 'select',
      options: FG.LiteralToOptionsRecord('settings.preferences.theme', ThemeLiteral),
    }),
  ),
)

export const FontSizeLiteral = Schema.Literal('small', 'default', 'medium', 'large')

export const UseFontSize = new Settings.Setting(
  'fontSize',
  FontSizeLiteral.pipe(
    FG.config({
      title: 'settings.preferences.fontSize',
      description: 'settings.preferences.fontSize.desc',
      componentType: 'select',
      options: FG.LiteralToOptionsRecord('settings.preferences.fontSize', FontSizeLiteral),
    }),
  ),
)

export const TransparentSidebar = new Settings.Setting(
  'transparentSideBar',
  Schema.Boolean.pipe(
    FG.config({
      title: 'settings.preferences.transparentSidebar',
      description: 'settings.preferences.transparentSidebar.desc',
    }),
  ),
)

export const UsePointerCursor = new Settings.Setting(
  'usePointerCursor',
  Schema.Boolean.pipe(
    FG.config({
      title: 'settings.preferences.usePointerCursor',
      description: 'settings.preferences.usePointerCursor.desc',
    }),
  ),
)

export const UseDefaultHomeView = new Settings.Setting(
  'useDefaultHomeView',
  Schema.Boolean.pipe(
    FG.config({
      title: 'settings.preferences.useDefaultHomeView',
      description: 'settings.preferences.useDefaultHomeView.desc',
    }),
  ),
)

export class PreferenceSettingsSchema extends Settings.make(
  {
    Language,
    TransparentSidebar,
    Theme,
    UsePointerCursor,
    UseFontSize,
    UseDefaultHomeView,
  },
  (schema) =>
    Effect.gen(function* () {
      const theme = getUnsafeAppearance()
      const language = yield* I18n.language

      return schema.make({
        language: language,
        fontSize: 'default',
        theme: theme,
        transparentSideBar: false,
        useDefaultHomeView: false,
        usePointerCursor: false,
      })
    }),
) {}

export declare namespace PreferenceSettingsSchema {
  export interface PreferenceSettings extends Schema.Schema.Type<typeof PreferenceSettingsSchema> {}
}

export class ProfileSettings extends Settings.make(
  {
    Language,
  },
  (schema) =>
    Effect.gen(function* () {
      const language = yield* I18n.language

      return schema.make({
        language: language,
      })
    }),
) {}
export declare namespace ProfileSettings {
  export interface ProfileSettings extends Schema.Schema.Type<typeof ProfileSettings> {}
}
