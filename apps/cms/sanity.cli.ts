import { defineCliConfig } from 'sanity/cli'
import { dataset, port, projectId } from './sanity.config'

export default defineCliConfig({
  server: {
    port,
  },
  api: {
    projectId,
    dataset,
  },
})
