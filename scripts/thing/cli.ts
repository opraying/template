import { Command, HelpDoc, Options } from '@effect/cli'
import { buildCommand, deployCommand, previewCommand, serveCommand } from './app/command'
import { databaseCommand } from './database/command'
import { emailCommand } from './emails/command'
import { nativeCommand } from './react-native/command'
import { testCommand } from './vitest/command'

const rootOptions = {
  tsconfig: Options.text('tsconfig').pipe(
    Options.withDescription('Optional tsconfig path forwarded to tooling (for compatibility)'),
    Options.withDefault(undefined),
  ),
}

export const xdevCommand = Command.make('xdev', rootOptions).pipe(
  Command.withSubcommands([
    serveCommand,
    buildCommand,
    deployCommand,
    previewCommand,
    databaseCommand,
    emailCommand,
    testCommand,
    nativeCommand,
  ]),
)

export const cli = xdevCommand.pipe(
  Command.withDescription('XStack development toolkit - build, serve, deploy React Router and Workers projects'),
  Command.run({
    name: 'XDev',
    version: '0.0.1',
    footer: HelpDoc.blocks([
      HelpDoc.h1('XStack XDev CLI'),
      HelpDoc.p('Development toolkit for React Router and Cloudflare Workers projects'),
      HelpDoc.h2('Common Usage Patterns:'),
      HelpDoc.p('• Development: xdev serve --cwd <project-path>'),
      HelpDoc.p('• Production: xdev build --cwd <project-path> && xdev deploy --cwd <project-path>'),
      HelpDoc.p('• Database: xdev db push --cwd <project-path> [--database <db-name>]'),
    ]),
  }),
)
