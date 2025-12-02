import { createClient } from '@sanity/client'
import { apiToken, dataset, projectId } from '@xstack/cms/env'

// Do not import this into client-side components unless lazy-loaded

const getStudioUrl = () => {
  const host = window.location.host.split(':')[0]
  const port = Number.parseInt(window.location.port) - 1

  return `http://${host}:${port}`
}

export const client = createClient({
  projectId: projectId || 'replace-me',
  dataset: dataset || 'production',
  token: apiToken || '',
  useCdn: true,
  apiVersion: '2024-07-17',
  allowReconfigure: true,
  stega: {
    enabled: true,
    studioUrl: typeof window !== 'undefined' ? getStudioUrl() : 'http://localhost:3333',
  },
})
