import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface FeatureHighlightProps {
  features: {
    icon: string
    title: string
    description: string
    benefits?: string[]
    demo?: React.ReactNode
    accentColor?: string
  }[]
}

export const FeatureHighlight = ({ features }: FeatureHighlightProps) => {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="relative">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Feature List */}
        <div className="space-y-3">
          {features.map((feature, index) => (
            <m.div
              key={feature.title}
              className={cn(
                'p-4 sm:p-5 rounded-xl border transition-colors',
                index === activeIndex ? 'bg-primary/5 border-primary/30 shadow-lg' : 'hover:bg-muted/50',
              )}
              onClick={() => setActiveIndex(index)}
              whileHover={{ x: index === activeIndex ? 0 : 8 }}
              animate={{
                scale: index === activeIndex ? 1.02 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn('p-2.5 rounded-lg', index === activeIndex ? 'bg-primary/20' : 'bg-primary/10')}
                  style={
                    feature.accentColor
                      ? {
                          backgroundColor: `${feature.accentColor}10`,
                          color: feature.accentColor,
                        }
                      : {}
                  }
                >
                  <i className={cn(feature.icon, 'size-5')} />
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <h4 className="text-base font-medium truncate">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{feature.description}</p>
                  {feature.benefits && (
                    <m.ul
                      className="mt-2 space-y-1.5"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: index === activeIndex ? 1 : 0,
                        height: index === activeIndex ? 'auto' : 0,
                      }}
                    >
                      {feature.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-center gap-2 text-xs">
                          <i className="i-lucide-check-circle size-3.5 text-primary flex-shrink-0" />
                          <span className="line-clamp-1">{benefit}</span>
                        </li>
                      ))}
                    </m.ul>
                  )}
                </div>
                <i
                  className={cn(
                    'i-lucide-chevron-right size-4 text-muted-foreground/50 transition-transform flex-shrink-0',
                    index === activeIndex && 'rotate-90',
                  )}
                />
              </div>
            </m.div>
          ))}
        </div>

        {/* Feature Demo */}
        <div className="relative lg:h-full">
          <div className="lg:sticky lg:top-4 rounded-xl border bg-card/50 backdrop-blur-sm p-4 sm:p-5 h-full">
            <AnimatePresence mode="wait">
              <m.div
                key={activeIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                {features[activeIndex].demo || (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <i className={cn(features[activeIndex].icon, 'size-16 opacity-20')} />
                  </div>
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
