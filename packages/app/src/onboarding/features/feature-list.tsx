import { m } from 'motion/react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FeatureListProps {
  features: {
    icon: string
    title: string
    description: string
    details?: {
      title: string
      description: string
      metrics?: { label: string; value: string; trend?: string }[]
      demo?: React.ReactNode
      status?: {
        type: 'success' | 'warning' | 'error' | 'info'
        message: string
      }
      chart?: {
        data: number[]
        labels: string[]
      }
      actions?: {
        icon: string
        label: string
        onClick?: () => void
      }[]
    }[]
  }[]
}

export const FeatureList = ({ features }: FeatureListProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null)
  const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({})
  const [hoveredChart, setHoveredChart] = useState<string | null>(null)

  const toggleChart = useCallback((id: string) => {
    setExpandedCharts((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className="space-y-4">
      {features.map((feature, index) => (
        <m.div
          key={feature.title}
          className={cn(
            'group relative rounded-xl border overflow-hidden transition-all duration-300',
            activeIndex === index ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50',
          )}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          viewport={{ once: true }}
        >
          {/* 主要内容区域 */}
          <div className="p-4" onClick={() => setActiveIndex(activeIndex === index ? null : index)}>
            <div className="flex items-center gap-4">
              <m.div
                className="size-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <i className={cn(feature.icon, 'size-5 text-primary')} />
              </m.div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{feature.description}</p>
              </div>
              <m.i
                className="i-lucide-chevron-down size-5 text-muted-foreground/50"
                animate={{ rotate: activeIndex === index ? 180 : 0 }}
              />
            </div>
          </div>

          {/* 详细信息区域 */}
          {feature.details && (
            <m.div
              initial={false}
              animate={{
                height: activeIndex === index ? 'auto' : 0,
                opacity: activeIndex === index ? 1 : 0,
              }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 pl-[3.5rem] space-y-4">
                {feature.details.map((detail, detailIndex) => (
                  <m.div
                    key={detail.title}
                    className={cn(
                      'rounded-lg transition-colors overflow-hidden',
                      activeDetailIndex === detailIndex && activeIndex === index ? 'bg-primary/10' : 'bg-muted/50',
                    )}
                  >
                    {/* 详情头部 */}
                    <div
                      className="p-3"
                      onClick={() => setActiveDetailIndex(activeDetailIndex === detailIndex ? null : detailIndex)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{detail.title}</h4>
                          {detail.status && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                detail.status.type === 'success' && 'text-green-500 border-green-500/20',
                                detail.status.type === 'warning' && 'text-yellow-500 border-yellow-500/20',
                                detail.status.type === 'error' && 'text-red-500 border-red-500/20',
                                detail.status.type === 'info' && 'text-blue-500 border-blue-500/20',
                              )}
                            >
                              {detail.status.message}
                            </Badge>
                          )}
                        </div>
                        <m.i
                          className="i-lucide-chevron-right size-4 text-muted-foreground/50"
                          animate={{ rotate: activeDetailIndex === detailIndex ? 90 : 0 }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{detail.description}</p>
                    </div>

                    {/* 详情展开内容 */}
                    <m.div
                      initial={false}
                      animate={{
                        height: activeDetailIndex === detailIndex ? 'auto' : 0,
                        opacity: activeDetailIndex === detailIndex ? 1 : 0,
                      }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-4">
                        {/* 指标展示 */}
                        {detail.metrics && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {detail.metrics.map((metric) => (
                              <m.div
                                key={metric.label}
                                className="p-2 rounded-lg bg-background"
                                whileHover={{ scale: 1.02 }}
                              >
                                <div className="text-sm font-semibold text-primary">
                                  {metric.value}
                                  {metric.trend && (
                                    <span
                                      className={cn(
                                        'ml-1 text-xs',
                                        metric.trend.startsWith('+') ? 'text-green-500' : 'text-red-500',
                                      )}
                                    >
                                      {metric.trend}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{metric.label}</div>
                              </m.div>
                            ))}
                          </div>
                        )}

                        {/* 图表展示 */}
                        {detail.chart && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">趋势分析</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => toggleChart(`${index}-${detailIndex}`)}
                              >
                                {expandedCharts[`${index}-${detailIndex}`] ? '收起' : '展开'}
                              </Button>
                            </div>
                            <m.div
                              className={cn(
                                'rounded-lg bg-muted/30 overflow-hidden',
                                expandedCharts[`${index}-${detailIndex}`] ? 'h-48' : 'h-24',
                              )}
                              animate={{
                                height: expandedCharts[`${index}-${detailIndex}`] ? 192 : 96,
                              }}
                            >
                              <div className="h-full flex items-end justify-between gap-1 p-2">
                                {detail.chart.data.map((value, i) => (
                                  <div
                                    key={detail.chart?.labels[i]}
                                    className="flex-1 flex flex-col items-center gap-1"
                                    onMouseEnter={() => setHoveredChart(`${index}-${detailIndex}-${i}`)}
                                    onMouseLeave={() => setHoveredChart(null)}
                                  >
                                    <m.div
                                      className="w-full bg-primary/40 rounded-t relative group"
                                      initial={{ height: 0 }}
                                      animate={{ height: `${value}%` }}
                                      transition={{ duration: 0.5, delay: i * 0.1 }}
                                    >
                                      {hoveredChart === `${index}-${detailIndex}-${i}` && (
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-primary text-white text-[10px]">
                                          {value}%
                                        </div>
                                      )}
                                    </m.div>
                                    {expandedCharts[`${index}-${detailIndex}`] && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {detail.chart?.labels[i]}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </m.div>
                          </div>
                        )}

                        {/* 演示区域 */}
                        {detail.demo && (
                          <m.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-lg bg-muted/30 p-3"
                          >
                            {detail.demo}
                          </m.div>
                        )}

                        {/* 操作按钮 */}
                        {detail.actions && (
                          <div className="flex flex-wrap gap-2">
                            {detail.actions.map((action) => (
                              <Button
                                key={action.label}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 hover:bg-primary/5"
                                onClick={action.onClick}
                              >
                                <i className={cn(action.icon, 'size-3')} />
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </m.div>
                  </m.div>
                ))}
              </div>
            </m.div>
          )}
        </m.div>
      ))}
    </div>
  )
}
