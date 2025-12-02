import { m, type Variants } from 'motion/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

export interface FeatureCardProps {
  icon: string
  title: string
  description: string
  preview?: React.ReactNode
  className?: string
  onClick?: () => void
  isActive?: boolean
}

export const FeatureCard = ({ icon, title, description, preview, className, onClick, isActive }: FeatureCardProps) => {
  return (
    <m.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      className={cn('h-full')}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      variants={fadeInUp}
    >
      <Card className={cn('h-full bg-card transition-colors', isActive && 'ring-2 ring-primary', className)}>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <m.div
              className="p-3 flex items-center justify-center rounded-lg bg-primary/10"
              whileHover={{ scale: 1.05 }}
            >
              <i className={cn(icon, 'size-5 text-primary')} />
            </m.div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {preview && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              {preview}
            </m.div>
          )}
        </div>
      </Card>
    </m.div>
  )
}
