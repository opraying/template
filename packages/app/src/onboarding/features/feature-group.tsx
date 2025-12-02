import { m, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export interface FeatureItemProps {
  icon: string
  text: string
  className?: string
  isActive?: boolean
  onClick?: () => void
}

export const FeatureItem = ({ icon, text, className, isActive, onClick }: FeatureItemProps) => {
  return (
    <m.div
      whileHover={{ scale: onClick ? 1.02 : 1 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      className={cn('flex items-center gap-2 text-sm text-muted-foreground', isActive && 'text-primary', className)}
      onClick={onClick}
    >
      <i className={cn(icon, 'w-4 h-4')} />
      <span>{text}</span>
    </m.div>
  )
}

export interface FeatureGroupProps {
  icon: string
  title: string
  description: string
  features: { icon: string; text: string }[]
  activeFeature?: string | undefined
  onFeatureClick?: (feature: string) => void
}

export const FeatureGroup = ({
  icon,
  title,
  description,
  features,
  activeFeature,
  onFeatureClick,
}: FeatureGroupProps) => {
  return (
    <m.div className="space-y-4" initial="initial" whileInView="animate" viewport={{ once: true }} variants={fadeInUp}>
      <div className="flex items-center gap-3">
        <m.div className="p-3 flex justify-center items-center rounded-lg bg-primary/10" whileHover={{ scale: 1.05 }}>
          <i className={cn(icon, 'w-5 h-5 text-primary')} />
        </m.div>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <m.div className="pl-11 space-y-2" variants={staggerContainer}>
        {features.map((item) => (
          <m.div key={item.text} variants={fadeInUp}>
            <FeatureItem {...item} isActive={activeFeature === item.text} onClick={() => onFeatureClick?.(item.text)} />
          </m.div>
        ))}
      </m.div>
    </m.div>
  )
}
