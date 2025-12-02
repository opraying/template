import { VisualEditing } from '@sanity/visual-editing/react-router'
import { client } from '@xstack/cms/client'
import { useLiveMode } from '@xstack/cms/store'

const getStudioUrl = () => {
  const host = window.location.host.split(':')[0]
  const port = Number.parseInt(window.location.port) - 1

  return `http://${host}:${port}`
}

export function VisualEditingDev() {
  useLiveMode({
    client,
    studioUrl: typeof window !== 'undefined' ? getStudioUrl() : 'http://localhost:3333',
  })

  return <VisualEditing />
}
