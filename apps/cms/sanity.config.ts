import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { presentationTool } from 'sanity/presentation'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './schema'

export const port = 5333
export const previewPort = 5420
export const projectId = process.env.SANITY_STUDIO_PROJECT_ID as string
export const dataset = process.env.SANITY_STUDIO_DATASET as string
export const previewUrl = `https://localhost:${previewPort}`

if (!projectId || !dataset || !previewUrl) {
  throw new Error('Missing environment variables')
}

const apiVersion = '2024-07-17'

export default defineConfig({
  name: 'template',
  title: 'template',
  projectId,
  dataset,
  plugins: [
    structureTool(),
    presentationTool({
      previewUrl,
      devMode: true,
    }),
    visionTool({
      defaultApiVersion: apiVersion,
    }),
  ],
  schema: {
    types: schemaTypes,
  },
})
