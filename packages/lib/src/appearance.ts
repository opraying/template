import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import {
  type Appearance as AppearanceType,
  type Theme,
  type ThemeConfig,
  DefaultStorageKeys,
  resolveAppearanceToTheme,
  getStoredAppearance,
  getStoredTheme,
  updateDocumentAppearance,
} from './appearance/appearance-provider'

export interface Appearance {
  appearance: () => AppearanceType
  resolvedAppearance: () => 'light' | 'dark'
  theme: () => Theme
  themes: () => ReadonlyArray<ThemeConfig>
  setAppearance: (appearance: AppearanceType) => Effect.Effect<void>
  setTheme: (theme: Theme) => Effect.Effect<void>
  toggleAppearance: () => Effect.Effect<void>
}

export const Appearance = Context.GenericTag<Appearance>('@appearance')

export const AppearanceLive = Layer.effect(
  Appearance,
  Effect.sync(() => {
    let currentAppearance = getStoredAppearance()
    let currentTheme = getStoredTheme()

    return {
      appearance: () => currentAppearance,
      resolvedAppearance: () => resolveAppearanceToTheme(currentAppearance),
      theme: () => currentTheme,
      themes: () => [],

      setAppearance: (appearance: AppearanceType) =>
        Effect.sync(() => {
          currentAppearance = appearance
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DefaultStorageKeys.appearance, appearance)
          }
          // Update document class for immediate effect
          const resolved = resolveAppearanceToTheme(appearance)
          updateDocumentAppearance(resolved)
        }),

      setTheme: (theme: Theme) =>
        Effect.sync(() => {
          currentTheme = theme
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DefaultStorageKeys.theme, theme)
          }
        }),

      toggleAppearance: () =>
        Effect.sync(() => {
          const resolved = resolveAppearanceToTheme(currentAppearance)
          const newAppearance: AppearanceType = resolved === 'light' ? 'dark' : 'light'
          currentAppearance = newAppearance
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DefaultStorageKeys.appearance, newAppearance)
          }
          updateDocumentAppearance(resolveAppearanceToTheme(newAppearance))
        }),
    }
  }),
)

const withTheme = <E, A>(effect: (_: Appearance) => Effect.Effect<A, E>) =>
  pipe(
    Effect.context<never>(),
    Effect.map((ctx) => Context.get(ctx as Context.Context<Appearance>, Appearance)),
    Effect.flatMap(effect),
  )

export const appearance = withTheme((_) => Effect.sync(_.appearance))

export const resolvedAppearance = withTheme((_) => Effect.sync(_.resolvedAppearance))

export const theme = withTheme((_) => Effect.sync(_.theme))

export const themes = withTheme((_) => Effect.sync(_.themes))

export const setAppearance = (appearance: AppearanceType) => withTheme((_) => _.setAppearance(appearance))

export const setTheme = (theme: Theme) => withTheme((_) => _.setTheme(theme))

export const toggleAppearance = () => withTheme((_) => _.toggleAppearance())
