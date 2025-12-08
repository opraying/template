import { Data } from 'effect'
import { Stage } from '../domain'

export interface EmailBuildSubcommand {
  readonly _tag: 'EmailBuildSubcommand'
  readonly cwd: string
}
export const EmailBuildSubcommand = Data.tagged<EmailBuildSubcommand>('EmailBuildSubcommand')

export interface EmailDeploySubcommand {
  readonly _tag: 'EmailDeploySubcommand'
  readonly cwd: string
  readonly stage: Stage
}
export const EmailDeploySubcommand = Data.tagged<EmailDeploySubcommand>('EmailDeploySubcommand')
