import { createContext, type ReactNode, use } from 'react'

export interface GlobalConfig {
  languages: ReadonlyArray<{ value: string; label: string }>
}

export interface GlobalConfigProviderProps {
  children: ReactNode
  languages: GlobalConfig['languages']
}

const GlobalConfigContext = createContext<GlobalConfig | null>(null)

export const GlobalConfigProvider = (props: GlobalConfigProviderProps) => {
  const value = {
    languages: props.languages,
  } satisfies GlobalConfig

  return <GlobalConfigContext value={value}>{props.children}</GlobalConfigContext>
}

export const useGlobalConfig = () => {
  const context = use(GlobalConfigContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
