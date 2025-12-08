import { Options } from '@effect/cli'

const reactRouterSpaModeOption = Options.boolean('spa').pipe(
  Options.withDescription('Treat the build as SPA-only (Pages assets deployment)'),
  Options.withDefault(false),
)

const reactRouterDesktopOption = Options.boolean('desktop').pipe(
  Options.withDescription('Enable desktop bundling hints (e.g., Tauri build)'),
  Options.withDefault(false),
)

export { reactRouterDesktopOption, reactRouterSpaModeOption }
