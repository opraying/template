import type { Deployment as CFDeployment, Project } from '@cloudflare/types'

export interface CloudflareProject extends Project {}
export interface CloudflareDeployment extends CFDeployment {}

export interface CloudflareWorkersProject {
  created_on: string
  etag: string
  tag: string
  tags: string[]
  id: string
  logpush: boolean
  modified_on: string
  pipeline_hash: string
  placement_mode: 'off' | 'smart'
  tail_consumers: Array<{
    environment: string
    namespace: string
    service: string
  }>
  usage_model: 'bundled' | 'unbound'
}

export function formatUrl(str: string) {
  const url = str
    .replace(/^https?:\/\//, '')
    .replace(/^https?\/\//, '')
    .replace(/\/$/, '')

  return `https://${url}`
}

export function formatStatus(
  status: CFDeployment['latest_stage']['status'],
): 'queued' | 'failure' | 'error' | 'pending' | 'in_progress' {
  switch (status) {
    case 'failure':
      return 'failure'
    case 'idle':
      return 'pending'
    case 'success':
    case 'skipped':
    case 'canceled':
    case 'active':
      return 'in_progress'
  }
}

export const formatSize = (size: bigint | number) => {
  return `${(Number(size) / 1024).toFixed(2)} KB`
}
