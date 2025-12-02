import { lazy, type ReactNode } from 'react'

export const MarketingLayout = lazy(() =>
  import('@shared/marketing/layout').then((P) => ({
    default: (props: { children?: ReactNode }) => <P.MarketingLayout {...props} />,
  })),
)
