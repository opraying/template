import type { PaymentEnvironmentTag, PaymentProviderTag } from '@xstack/purchase/payment'
import type { AppPlan } from '@xstack/app-kit/schema'
import { useLoaderData } from 'react-router'

type LoaderData =
  | { success: false; error: Error }
  | {
      success: true
      result: {
        namespace: string
        plans: ReadonlyArray<typeof AppPlan.Encoded>
        system: {
          provider: PaymentProviderTag
          providerId: string
          environment: PaymentEnvironmentTag
        }
      }
    }

export const usePlansLoader = () => {
  const data = useLoaderData() as LoaderData

  if (!data.success) {
    throw data.error
  }

  return data.result
}
