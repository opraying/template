import { m } from 'motion/react'
import { cn } from '@/lib/utils'

export interface FeatureImageProps {
  features: {
    title: string
    description: string
    image: string
    align?: 'left' | 'right'
  }[]
}

export const FeatureImage = ({ features }: FeatureImageProps) => {
  return (
    <div className="space-y-20">
      {features.map((feature, _index) => (
        <m.div
          key={feature.title}
          className={cn('grid md:grid-cols-2 gap-8 items-center', feature.align === 'right' && 'md:grid-flow-dense')}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <div className={cn('space-y-4', feature.align === 'right' && 'md:col-start-2')}>
            <m.h3
              className="text-2xl font-semibold"
              initial={{ opacity: 0, x: feature.align === 'right' ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              {feature.title}
            </m.h3>
            <m.p
              className="text-muted-foreground"
              initial={{ opacity: 0, x: feature.align === 'right' ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
            >
              {feature.description}
            </m.p>
          </div>
          <m.div
            className="relative aspect-[4/3] rounded-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
          >
            <img src={feature.image} alt={feature.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </m.div>
        </m.div>
      ))}
    </div>
  )
}
