import { DestroyVaultWorkflow } from '@xstack/event-log-server/workflows/destroy-vault'

export const workflows = {
  DestroyVaultWorkflow,
}

declare global {
  type WorkflowsBinding = typeof workflows
}
