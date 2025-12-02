import { m } from 'motion/react'
import { cn } from '@/lib/utils'

export interface UserCaseProps {
  cases: {
    icon: string
    title: string
    description: string
    metrics: { label: string; value: string }[]
  }[]
}

export const UserCases = ({ cases }: UserCaseProps) => {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {cases.map((item, index) => (
        <m.div
          key={item.title}
          className="p-4 rounded-xl border bg-card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
          whileHover={{ y: -5 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center p-2 rounded-lg bg-primary/10">
              <i className={cn(item.icon, 'size-5 text-primary')} />
            </div>
            <h4 className="font-medium">{item.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
          <div className="grid grid-cols-2 gap-3">
            {item.metrics.map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="text-2xl font-bold text-primary">{metric.value}</div>
                <div className="text-xs text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        </m.div>
      ))}
    </div>
  )
}
