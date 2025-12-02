interface SanityEnvConfig {
  projectId: string
  dataset: string
  apiToken: string
}

interface SanityEnvBrowserConfig {
  projectId: string
  dataset: string
  apiToken: undefined
}

export const { projectId, dataset, apiToken } =
  typeof document === 'undefined'
    ? ({
        // @ts-ignore
        projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
        // @ts-ignore
        dataset: process.env.SANITY_STUDIO_DATASET ?? '',
        // @ts-ignore
        apiToken: process.env.SANITY_STUDIO_API_TOKEN ?? '',
      } as SanityEnvConfig)
    : ((window as any).__x_sanity_env as SanityEnvBrowserConfig) || {}
