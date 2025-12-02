import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FeatureGridProps {
  features: {
    icon: string
    title: string
    description: string
    tags?: string[]
  }[]
}

export const FeatureGrid = ({ features }: FeatureGridProps) => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<{ label: string; value: number; target: number }[]>([
    { label: '性能提升', value: 0, target: 85 },
    { label: '资源节省', value: 0, target: 65 },
    { label: '效率提升', value: 0, target: 95 },
  ])

  useEffect(() => {
    let mounted = true
    // 模拟数据加载动画
    const interval = setInterval(() => {
      if (!mounted) return
      setMetrics((prev) =>
        prev.map((metric) => ({
          ...metric,
          value: metric.value < metric.target ? metric.value + 1 : metric.value,
        })),
      )
    }, 30)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, []) // 移除不必要的依赖

  return (
    <div className="space-y-8">
      <div className="">
        {features.map((feature, index) => (
          <m.div
            key={feature.title}
            className={cn(
              'group relative p-6 rounded-2xl border',
              'bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300',
              selectedFeature === feature.title && 'ring-2 ring-primary',
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            onClick={() => setSelectedFeature(selectedFeature === feature.title ? null : feature.title)}
          >
            {/* 背景渐变效果 */}
            <m.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/0"
              initial={{ opacity: 0 }}
              animate={{ opacity: selectedFeature === feature.title ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            />

            <div className="relative space-y-4">
              {/* 头部区域 */}
              <div className="flex items-center gap-4">
                <m.div
                  className="size-12 rounded-xl bg-primary/10 flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <i className={cn(feature.icon, 'size-6 text-primary')} />
                </m.div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{feature.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {feature.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <m.div
                  animate={{ rotate: selectedFeature === feature.title ? 180 : 0 }}
                  className="text-muted-foreground"
                >
                  <i className="i-lucide-chevron-down size-5" />
                </m.div>
              </div>

              {/* 描述文本 */}
              <p className="text-muted-foreground text-sm line-clamp-2">{feature.description}</p>

              {/* 展开内容 */}
              <m.div
                initial={false}
                animate={{
                  height: selectedFeature === feature.title ? 'auto' : 0,
                  opacity: selectedFeature === feature.title ? 1 : 0,
                }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  {/* 实时指标 */}
                  <div className="grid grid-cols-2 gap-3">
                    {metrics.map((metric) => (
                      <div key={metric.label} className="p-3 rounded-lg bg-muted/30">
                        <div className="text-sm text-muted-foreground">{metric.label}</div>
                        <div className="mt-1 flex items-end gap-2">
                          <div className="text-2xl font-bold text-primary">{metric.value}%</div>
                          <div className="text-xs text-green-500 mb-1">↑ {metric.target - metric.value}%</div>
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-muted/50 overflow-hidden">
                          <m.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: '0%' }}
                            animate={{ width: `${metric.value}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 功能演示 */}
                  <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">功能演示</span>
                      <Badge variant="outline" className="text-[10px]">
                        实时
                      </Badge>
                    </div>
                    <div className="relative h-24 rounded bg-muted/50">
                      <m.div
                        className="absolute inset-0 bg-primary/10"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: [0, 1, 0] }}
                        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
                      />
                      <m.div
                        className="absolute left-0 top-1/2 -translate-y-1/2 size-3 rounded-full bg-primary"
                        animate={{ x: ['0%', '100%', '0%'] }}
                        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
                      />
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Button variant="default" size="sm" className="w-full gap-1">
                      <i className="i-lucide-play size-4" />
                      开始使用
                    </Button>
                    <Button variant="outline" size="sm" className="w-full gap-1">
                      <i className="i-lucide-book-open size-4" />
                      了解更多
                    </Button>
                  </div>
                </div>
              </m.div>
            </div>
          </m.div>
        ))}
      </div>

      {/* 功能概览 */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">功能概览</h3>
            <p className="text-sm text-muted-foreground mt-1">实时监控各项功能的使用情况</p>
          </div>
          <Select defaultValue="week">
            <SelectTrigger className="w-28">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 使用趋势 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">使用趋势</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">本期</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="size-2 rounded-full bg-muted" />
                  <span className="text-muted-foreground">上期</span>
                </div>
              </div>
            </div>
            <div className="h-48 rounded-lg bg-muted/30">
              <div className="h-full flex items-end justify-between gap-2 p-4">
                {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-muted/50 rounded-t" style={{ height: `${30 + Math.sin(i) * 20}%` }} />
                    <div className="w-full bg-primary/40 rounded-t" style={{ height: `${40 + Math.cos(i) * 20}%` }} />
                    <span className="text-xs text-muted-foreground">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 活跃度分析 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">活跃度分析</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <i className="i-lucide-download size-3" />
                导出报告
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { label: '日活跃度', value: 95, color: 'bg-green-500' },
                { label: '功能覆盖', value: 85, color: 'bg-blue-500' },
                { label: '使用时长', value: 75, color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <m.div
                      className={cn('h-full rounded-full', item.color)}
                      initial={{ width: '0%' }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
