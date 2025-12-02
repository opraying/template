import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

interface FeatureComparisonProps {
  features?:
    | {
        id: string
        name: React.ReactNode
        free: boolean | React.ReactNode
        pro: boolean | React.ReactNode
        description?: React.ReactNode | undefined
      }[]
    | undefined
}

export const FeatureComparison = React.memo(function FeatureComparison({ features }: FeatureComparisonProps) {
  const { t } = useTranslation()

  const comparisonData = useMemo(
    () =>
      features ?? [
        {
          id: 'feature-1',
          name: t('pricing.comparison.feature-1.name'),
          description: t('pricing.comparison.feature-1.description'),
          free: true,
          pro: true,
        },
        ...Array.from({ length: 5 }).map((_, index) => ({
          id: `feature-${index + 2}`,
          name: t(`pricing.comparison.feature-${index + 2}.name`),
          description: t(`pricing.comparison.feature-${index + 2}.description`),
          free: t(`pricing.comparison.feature-${index + 2}.free`),
          pro: t(`pricing.comparison.feature-${index + 2}.pro`),
        })),
      ],
    [features, t],
  )

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[1.5fr,1fr,1fr] gap-4 px-3">
        <div className="font-medium">{t('pricing.comparison.columns.name')}</div>
        <div className="text-center font-medium">{t('pricing.comparison.columns.free')}</div>
        <div className="text-center font-medium">{t('pricing.comparison.columns.pro')}</div>
      </div>
      <div className="mt-4 space-y-2">
        {comparisonData.map((feature) => (
          <m.div
            key={feature.id}
            className="grid grid-cols-[1.5fr,1fr,1fr] gap-4 px-3 py-2 rounded-lg hover:bg-muted/30"
            whileHover={{ x: 5 }}
          >
            <div className="space-y-1">
              <div className="font-medium">{feature.name}</div>
              {feature.description && <div className="text-xs text-muted-foreground">{feature.description}</div>}
            </div>
            <div className="flex justify-center items-center">
              {typeof feature.free === 'boolean' ? (
                <i
                  className={cn('size-4', feature.free ? 'i-lucide-check text-green-500' : 'i-lucide-x text-red-500')}
                />
              ) : (
                <span className="text-sm">{feature.free}</span>
              )}
            </div>
            <div className="flex justify-center items-center">
              {typeof feature.pro === 'boolean' ? (
                <i
                  className={cn('size-4', feature.pro ? 'i-lucide-check text-green-500' : 'i-lucide-x text-red-500')}
                />
              ) : (
                <span className="text-sm">{feature.pro}</span>
              )}
            </div>
          </m.div>
        ))}
      </div>
    </div>
  )
})
