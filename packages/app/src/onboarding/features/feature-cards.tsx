import { m } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface FeatureCardsProps {
  features: {
    icon: string
    title: string
    description: string
    color?: string
  }[]
}

export const FeatureCards = ({ features }: FeatureCardsProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature, index) => (
        <m.div
          key={feature.title}
          className="group relative rounded-2xl border p-6 hover:shadow-lg transition-all duration-300"
          onHoverStart={() => setHoveredIndex(index)}
          onHoverEnd={() => setHoveredIndex(null)}
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
          whileHover={{ y: -5 }}
        >
          <m.div
            className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-r"
            style={{
              height: hoveredIndex === index ? '100%' : '4px',
              borderRadius: hoveredIndex === index ? '1rem' : '0 0 1rem 1rem',
              background: `linear-gradient(to right, ${feature.color || 'var(--primary)'}, ${feature.color || 'var(--primary)'})`,
            }}
            animate={{
              opacity: hoveredIndex === index ? 0.1 : 0.2,
            }}
          />
          <div className="relative space-y-4">
            <m.div
              className="size-12 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: `color-mix(in srgb, ${feature.color || 'var(--primary)'} 10%, transparent)`,
              }}
            >
              <i className={cn(feature.icon, 'size-6')} style={{ color: feature.color || 'var(--primary)' }} />
            </m.div>
            <div>
              <m.h3
                className="text-lg font-semibold mb-2"
                style={{
                  color: hoveredIndex === index ? feature.color || 'var(--primary)' : 'inherit',
                }}
              >
                {feature.title}
              </m.h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          </div>
        </m.div>
      ))}
    </div>
  )
}
