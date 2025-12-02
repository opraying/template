import { createQueryStore, setServerClient } from '@sanity/react-loader'

export const cmsStore = createQueryStore({ client: false, ssr: true })

export const { loadQuery, useLiveMode, useQuery } = cmsStore
export { setServerClient }
