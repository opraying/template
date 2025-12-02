import { BaseStep } from '@xstack/app-kit/onboarding/components/base-step'
import { FreeVersionCard, ProVersionCard } from '@xstack/app-kit/purchase/components/feature-block'
import * as Pricing from '@xstack/app-kit/purchase/components/pricing-dialog'
import { Separator } from '@xstack/lib/ui/separator'
import { useNavigate } from '@xstack/router'
import { m } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ActionItemProps {
  id: string
  icon: string
  title: string
  description: string
  path: string
  isNew?: boolean
}

const ActionItem = ({ icon, title, description, path, isNew }: ActionItemProps) => {
  const navigate = useNavigate()

  return (
    <m.div
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate.push(path)}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="p-3 flex items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
        <i className={cn(icon, 'w-5 h-5 text-primary')} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {isNew && (
            <Badge variant="secondary" className="text-xs">
              新
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <i className="i-lucide-chevron-right w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </m.div>
  )
}

const SupportSection = () => {
  return (
    <>
      <Separator className="mt-6" />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">遇到问题或有建议？欢迎随时与我们联系</p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="h-8 px-3 text-xs font-medium">
            <i className="i-lucide-mail w-3.5 h-3.5 mr-1.5" />
            联系支持
          </Button>
          <Button variant="secondary" size="sm" className="h-8 px-3 text-xs font-medium">
            <i className="i-lucide-book-open w-3.5 h-3.5 mr-1.5" />
            使用文档
          </Button>
        </div>
      </div>
    </>
  )
}

export const Welcome = () => {
  const handleUpgrade = () => Pricing.openPricingDialog()

  const actionItems = [
    {
      id: 'dashboard',
      icon: 'i-lucide-layout-dashboard',
      title: '浏览工作台',
      description: '查看您的个性化数据概览',
      path: '/dashboard',
    },
    {
      id: 'settings',
      icon: 'i-lucide-settings',
      title: '完善设置',
      description: '根据需要调整更多细节配置',
      path: '/settings',
    },
    {
      id: 'create',
      icon: 'i-lucide-file-plus',
      title: '创建内容',
      description: '开始您的第一个项目',
      path: '/create',
      isNew: true,
    },
  ]

  return (
    <BaseStep icon="i-lucide-party-popper" title="准备就绪！" description="开始使用您的个性化工作空间">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          我们是一个专注于提供高质量软件的独立开发团队。致力于为用户打造安全、高效、易用的工具，
          让您的工作更加轻松愉快。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>开始使用</CardTitle>
          <CardDescription>从这里开启您的探索之旅</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            {actionItems.map((item) => (
              <ActionItem key={item.id} {...item} />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <ProVersionCard onUpgrade={handleUpgrade} />
        <FreeVersionCard />
      </div>
      <SupportSection />
    </BaseStep>
  )
}
