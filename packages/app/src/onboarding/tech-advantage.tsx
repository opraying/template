import { m } from 'motion/react'
import { cn } from '@/lib/utils'

export interface TechAdvantageProps {
  advantages: {
    icon: string
    title: string
    description: string
  }[]
}

export const TechAdvantage = ({ advantages }: TechAdvantageProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {advantages.map((item, index) => (
        <m.div
          key={item.title}
          className="flex gap-4 p-4 rounded-xl border bg-card"
          initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center justify-center p-3 h-fit rounded-lg bg-primary/10">
            <i className={cn(item.icon, 'size-5 text-primary')} />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-medium">{item.title}</h4>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        </m.div>
      ))}
    </div>
  )
}
