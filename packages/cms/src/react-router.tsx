import { useRouteLoaderData } from 'react-router'

interface RootLoaderValue {
  result: {
    sanity?: {
      projectId: string | undefined
      dataset: string | undefined
    }
  }
}

export const SanityEnv = () => {
  const data = useRouteLoaderData('root') as RootLoaderValue

  if (!data?.result) {
    return
  }

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__x_sanity_env = ${JSON.stringify(data.result.sanity)}`,
      }}
    />
  )
}

export const getSanityEnv = () => {
  return {
    // @ts-ignore
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
    // @ts-ignore
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
    apiToken: import.meta.env.DEV
      ? // @ts-ignore
        process.env.SANITY_STUDIO_API_TOKEN || undefined
      : undefined,
  } as {
    projectId: string
    dataset: string
    apiToken?: string | undefined
  }
}
