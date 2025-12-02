import { m } from 'motion/react'
import { cn } from '@/lib/utils'

export interface FeatureShowcaseProps {
  title: string
  description: string
  image?: string
  features: { icon: string; title: string; description: string }[]
  className?: string
}

export const FeatureShowcase = ({ title, description, image, features, className }: FeatureShowcaseProps) => {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="grid md:grid-cols-2 gap-6 p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="space-y-4">
            {features.map((feature) => (
              <m.div key={feature.title} className="flex gap-3" whileHover={{ x: 5 }}>
                <div className="p-2 rounded-lg bg-primary/10">
                  <i className={cn(feature.icon, 'size-4 text-primary')} />
                </div>
                <div>
                  <h4 className="font-medium">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </m.div>
            ))}
          </div>
        </div>
        {image && (
          <div className="relative aspect-square rounded-lg bg-muted/30">
            <img src={image} alt={title} className="absolute inset-0 object-cover rounded-lg" />
          </div>
        )}
      </div>
    </div>
  )
}
