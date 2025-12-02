import { FeatureCard } from '@xstack/app/onboarding/features/feature-card'
import { FeatureCards } from '@xstack/app/onboarding/features/feature-cards'
import { FeatureGrid } from '@xstack/app/onboarding/features/feature-grid'
import { FeatureGroup, FeatureItem } from '@xstack/app/onboarding/features/feature-group'
import { FeatureHighlight } from '@xstack/app/onboarding/features/feature-highlight'
import { FeatureImage } from '@xstack/app/onboarding/features/feature-image'
import { FeatureList } from '@xstack/app/onboarding/features/feature-list'
import { FeatureShowcase } from '@xstack/app/onboarding/features/feature-showcase'
import { TechAdvantage } from '@xstack/app/onboarding/tech-advantage'
import { UserCases } from '@xstack/app/onboarding/user-cases'
import { BaseStep } from '@xstack/app-kit/onboarding/components/base-step'
import { DragableGrid } from '@xstack/app-kit/onboarding/components/interactive-demo'
import { AnimatePresence, m, type Variants } from 'motion/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

// 动画配置
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

interface SectionTitleProps {
  icon: string
  title: string
  description: string
  className?: string
  align?: 'left' | 'center'
}

const SectionTitle = ({ icon, title, description, className, align = 'center' }: SectionTitleProps) => {
  return (
    <m.div
      className={cn(align === 'center' ? 'text-center' : '', className)}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      variants={fadeInUp}
    >
      <h2 className={cn('text-xl font-semibold flex items-center gap-2', align === 'center' ? 'justify-center' : '')}>
        <i className={cn(icon, 'w-5 h-5')} />
        {title}
      </h2>
      <p className="text-muted-foreground mt-1">{description}</p>
    </m.div>
  )
}

interface FeatureSectionProps {
  title: string
  description: string
  icon: string
  children: React.ReactNode
  className?: string
  titleAlign?: 'left' | 'center'
}

const FeatureSection = ({
  title,
  description,
  icon,
  children,
  className,
  titleAlign = 'center',
}: FeatureSectionProps) => {
  return (
    <section className={cn('space-y-8', className)}>
      <SectionTitle icon={icon} title={title} description={description} align={titleAlign} />
      {children}
    </section>
  )
}

// 工作区功能配置
const workspaceFeatures = [
  { id: 'dashboard', title: '数据概览', icon: 'i-lucide-layout-dashboard' },
  { id: 'favorites', title: '收藏夹', icon: 'i-lucide-star' },
  { id: 'recent', title: '最近访问', icon: 'i-lucide-clock' },
  { id: 'quick-actions', title: '快捷操作', icon: 'i-lucide-zap' },
]

// 数据管理功能配置
const dataManagementFeatures = [
  {
    id: 'hierarchy',
    icon: 'i-lucide-folder-tree',
    title: '层级管理',
    description: '灵活的文件夹结构',
    preview: (
      <div className="space-y-2 pt-2">
        <FeatureItem icon="i-lucide-folder" text="项目文件夹" className="text-primary" />
        <div className="pl-6 space-y-2">
          <FeatureItem icon="i-lucide-folder" text="子分类" />
          <div className="pl-6">
            <FeatureItem icon="i-lucide-file" text="文件" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'tags',
    icon: 'i-lucide-tag',
    title: '标签系统',
    description: '多维度数据分类',
    preview: (
      <div className="flex flex-wrap gap-2 pt-2">
        {['重要', '进行中', '已完成', '待处理'].map((tag) => (
          <span key={tag} className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
            {tag}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: 'search',
    icon: 'i-lucide-search',
    title: '智能搜索',
    description: '快速定位所需内容',
    preview: (
      <div className="pt-2">
        <div className="relative">
          <input
            type="text"
            className="w-full px-3 py-1.5 pr-8 text-sm rounded-md border bg-background"
            placeholder="搜索..."
          />
          <i className="i-lucide-search w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    ),
  },
]

// 自动化功能配置
const automationFeatures = {
  smartSuggestions: {
    icon: 'i-lucide-wand-2',
    title: '智能建议',
    description: '基于使用习惯提供个性化建议',
    features: [
      { icon: 'i-lucide-zap', text: '快捷操作推荐' },
      { icon: 'i-lucide-clock', text: '智能时间提醒' },
      { icon: 'i-lucide-sparkles', text: '个性化内容推荐' },
    ],
  },
  workflow: {
    icon: 'i-lucide-workflow',
    title: '工作流自动化',
    description: '自定义自动化工作流程',
    features: [
      { icon: 'i-lucide-git-branch', text: '条件触发' },
      { icon: 'i-lucide-repeat', text: '定时任务' },
      { icon: 'i-lucide-webhook', text: '外部集成' },
    ],
  },
}

// 数据分析功能配置
const analyticsFeatures = [
  {
    icon: 'i-lucide-activity',
    title: '使用统计',
    features: ['访问频率', '使用时长', '功能偏好'],
  },
  {
    icon: 'i-lucide-trending-up',
    title: '趋势分析',
    features: ['数据增长', '使用模式', '效率提升'],
  },
  {
    icon: 'i-lucide-pie-chart',
    title: '可视化报表',
    features: ['图表展示', '数据导出', '定制报告'],
  },
]

// 新增的功能配置
const advancedFeatures = {
  collaboration: {
    title: '协作功能',
    description: '强大的团队协作工具，提升团队效率',
    features: [
      {
        icon: 'i-lucide-users',
        title: '实时协作',
        description: '多人同时编辑，实时同步变更',
      },
      {
        icon: 'i-lucide-message-square',
        title: '即时沟通',
        description: '内置消息系统，快速交流反馈',
      },
      {
        icon: 'i-lucide-history',
        title: '版本控制',
        description: '完整的历史记录，随时回溯查看',
      },
    ],
  },
  security: {
    title: '安全保障',
    description: '全方位的数据安全保护措施',
    features: [
      {
        icon: 'i-lucide-shield',
        title: '数据加密',
        description: '全程加密传输和存储',
      },
      {
        icon: 'i-lucide-key',
        title: '访问控制',
        description: '精细的权限管理系统',
      },
      {
        icon: 'i-lucide-hard-drive',
        title: '备份恢复',
        description: '自动备份，快速恢复',
      },
    ],
  },
}

const _featureComparison = [
  { title: '基础功能', free: true, pro: true },
  { title: '存储空间', free: '5GB', pro: '不限' },
  { title: '协作人数', free: '3人', pro: '不限' },
  { title: '版本历史', free: '7天', pro: '永久' },
  { title: '高级功能', free: false, pro: true },
  { title: '优先支持', free: false, pro: true },
]

const efficiencyDemo = (
  <div className="space-y-4">
    {/* AI 助手状态 */}
    <div className="relative">
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 animate-pulse">
        <i className="i-lucide-bot size-4 text-primary" />
        <span className="text-xs">正在分析您的使用习惯...</span>
      </div>
      <m.div
        className="absolute -right-1 -top-1 size-3 rounded-full bg-green-500"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
      />
    </div>

    {/* 智能建议展示 */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">智能建议</span>
          <Badge variant="secondary" className="text-[10px] h-4">
            实时
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
          <i className="i-lucide-refresh-cw size-3" />
          刷新
        </Button>
      </div>
      <div className="space-y-1.5">
        {[
          { icon: 'i-lucide-calendar', text: '建议在 9:00-11:00 处理重要任务', priority: 'high' },
          { icon: 'i-lucide-users', text: '3个待处理的团队协作请求', priority: 'medium' },
          { icon: 'i-lucide-bell', text: '设置提醒以提高完成率', priority: 'low' },
        ].map((item) => (
          <m.div
            key={item.text}
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs',
              item.priority === 'high' && 'border-l-2 border-red-500',
              item.priority === 'medium' && 'border-l-2 border-yellow-500',
              item.priority === 'low' && 'border-l-2 border-green-500',
            )}
            whileHover={{ x: 5, backgroundColor: 'rgba(var(--primary), 0.1)' }}
          >
            <i className={cn(item.icon, 'size-3.5 text-primary flex-shrink-0')} />
            <span className="line-clamp-1 flex-1">{item.text}</span>
            <i className="i-lucide-chevron-right size-3 text-muted-foreground/50" />
          </m.div>
        ))}
      </div>
    </div>

    {/* 效率指标 */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">效率指标</span>
          <Select defaultValue="week">
            <SelectTrigger className="h-6 text-xs w-20">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">今日</SelectItem>
              <SelectItem value="week">本周</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          {[
            { label: '任务完成率', value: '92%', trend: '+5%' },
            { label: '协作响应度', value: '95%', trend: '+3%' },
            { label: '时间利用率', value: '88%', trend: '+8%' },
          ].map((item) => (
            <div key={item.label} className="flex items-center p-1.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground flex-1 line-clamp-1">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{item.value}</span>
                <span className="text-[10px] text-green-500">{item.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative aspect-square">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">91%</div>
            <div className="text-[10px] text-muted-foreground">整体效率</div>
            <div className="text-[10px] text-green-500 mt-0.5">↑ 6.5%</div>
          </div>
        </div>
        <svg className="w-full h-full rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-muted/30"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
            r="35"
            cx="50"
            cy="50"
          />
          <m.circle
            className="text-primary"
            strokeWidth="10"
            strokeDasharray={220}
            strokeDashoffset={22}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="35"
            cx="50"
            cy="50"
            initial={{ strokeDashoffset: 220 }}
            animate={{ strokeDashoffset: 22 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </svg>
      </div>
    </div>

    {/* 智能任务分配 */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">智能任务分配</span>
        <Badge variant="outline" className="text-[10px] h-4">
          AI 推荐
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { time: '上午', tasks: '重要任务', icon: 'i-lucide-sun' },
          { time: '下午', tasks: '协作沟通', icon: 'i-lucide-users' },
          { time: '晚上', tasks: '总结复盘', icon: 'i-lucide-moon' },
        ].map((slot) => (
          <div key={slot.time} className="p-2 rounded-lg bg-muted/30 space-y-1.5">
            <i className={cn(slot.icon, 'size-4 text-primary')} />
            <div className="text-[10px] font-medium">{slot.time}</div>
            <div className="text-[10px] text-muted-foreground line-clamp-1">{slot.tasks}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const personalizationDemo = (
  <div className="space-y-4">
    {/* 主题预览 */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">主题预览</span>
          <Badge variant="outline" className="text-[10px] h-4">
            自定义
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'].map((color) => (
              <m.div
                key={color}
                className="size-5 rounded-full ring-1 ring-offset-1 ring-transparent hover:ring-primary"
                style={{ backgroundColor: color }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
          <Button variant="secondary" size="sm" className="h-6 text-xs px-2">
            <i className="i-lucide-plus size-3" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <div className="h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 p-2">
            <div className="flex items-center gap-1.5 text-xs">
              <i className="i-lucide-layout-dashboard size-3.5" />
              <span className="line-clamp-1">仪表盘</span>
            </div>
          </div>
          <div className="h-12 rounded-lg bg-card border p-2">
            <div className="flex items-center gap-1.5 text-xs">
              <i className="i-lucide-list size-3.5" />
              <span className="line-clamp-1">列表视图</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-muted/30 p-2">
            <div className="flex items-center gap-1.5 text-xs">
              <i className="i-lucide-grid size-3.5" />
              <span className="line-clamp-1">网格视图</span>
            </div>
          </div>
          <div className="h-18 rounded-lg bg-primary/10 p-2">
            <div className="flex items-center gap-1.5 text-xs">
              <i className="i-lucide-columns size-3.5" />
              <span className="line-clamp-1">看板视图</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 布局选项 */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">布局选项</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
          重置
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { icon: 'i-lucide-layout-dashboard', label: '网格布局', active: true },
          { icon: 'i-lucide-layout-list', label: '列表布局' },
          { icon: 'i-lucide-layout-grid', label: '卡片布局' },
          { icon: 'i-lucide-layout-template', label: '自定义' },
        ].map((item) => (
          <m.div
            key={item.label}
            className={cn(
              'flex items-center gap-1.5 p-2 rounded-lg',
              item.active ? 'bg-primary/10 text-primary' : 'bg-muted/30',
            )}
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(var(--primary), 0.1)' }}
          >
            <i className={cn(item.icon, 'size-3.5')} />
            <span className="text-xs line-clamp-1">{item.label}</span>
            {item.active && <i className="i-lucide-check size-3.5 ml-auto" />}
          </m.div>
        ))}
      </div>
    </div>

    {/* 快捷键配置 */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">快捷键配置</span>
        <Button variant="secondary" size="sm" className="h-6 text-xs px-2">
          编辑
        </Button>
      </div>
      <div className="space-y-1.5">
        {[
          { action: '快速搜索', keys: ['⌘', 'K'], description: '全局搜索' },
          { action: '新建项目', keys: ['⌘', 'N'], description: '创建新项目' },
          { action: '切换视图', keys: ['⌘', '⇧', 'V'], description: '切换显示方式' },
        ].map((item) => (
          <div key={item.action} className="flex items-center p-2 rounded-lg bg-muted/30">
            <div className="flex-1 min-w-0">
              <div className="text-xs line-clamp-1">{item.action}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {item.keys.map((key) => (
                <kbd key={key} className="px-1.5 py-0.5 rounded bg-background text-[10px] font-mono">
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* 通知设置 */}
    <div className="space-y-2">
      <span className="text-xs font-medium">通知设置</span>
      <div className="space-y-1.5">
        {[
          { type: '任务提醒', enabled: true },
          { type: '团队消息', enabled: true },
          { type: '系统通知', enabled: false },
        ].map((item) => (
          <m.div
            key={item.type}
            className={cn(
              'flex items-center justify-between p-2 rounded-lg transition-colors',
              item.enabled ? 'bg-primary/10' : 'bg-muted/30',
            )}
            whileHover={{ scale: 1.02, x: 5 }}
          >
            <div className="flex items-center gap-2">
              <i
                className={cn(
                  'size-3.5',
                  item.enabled ? 'i-lucide-bell text-primary' : 'i-lucide-bell-off text-muted-foreground',
                )}
              />
              <span className="text-xs line-clamp-1">{item.type}</span>
            </div>
            <Switch checked={item.enabled} className="data-[state=checked]:bg-primary" />
          </m.div>
        ))}
      </div>
    </div>
  </div>
)

const highlightFeatures = [
  {
    icon: 'i-lucide-zap',
    title: '智能效率提升',
    description: '通过AI辅助和自动化工具，显著提升工作效率',
    benefits: ['智能任务优先级排序', '自动化工作流程配置', '个性化使用建议', '智能时间管理', '团队协作效率分析'],
    accentColor: '#FF6B6B',
    demo: efficiencyDemo,
  },
  {
    icon: 'i-lucide-palette',
    title: '深度个性化',
    description: '提供全方位的定制选项，打造专属工作环境',
    benefits: ['自定义界面布局与主题', '个性化快捷键配置', '工作流程定制', '数据展示方式自定义', '个性化通知设置'],
    accentColor: '#4ECDC4',
    demo: personalizationDemo,
  },
  {
    icon: 'i-lucide-trending-up',
    title: '持续优化进化',
    description: '基于用户反馈不断改进，提供最佳产品体验',
    benefits: ['智能性能优化', '用户反馈驱动更新', '定期功能迭代', '自动化测试保障', '实时问题诊断'],
    accentColor: '#45B7D1',
    demo: (
      <div className="space-y-6">
        {/* 性能指标 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">性能指标</span>
              <Badge className="text-xs">同比提升 32%</Badge>
            </div>
            <Select defaultValue="month">
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">本周</SelectItem>
                <SelectItem value="month">本月</SelectItem>
                <SelectItem value="quarter">本季度</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-36 rounded-lg bg-muted/30 flex items-end p-4 gap-2">
            {[
              { value: 40, label: '加载速度', trend: '+15%' },
              { value: 65, label: '响应时间', trend: '+25%' },
              { value: 55, label: '资源利用', trend: '+10%' },
              { value: 80, label: '缓存命中', trend: '+30%' },
              { value: 95, label: '用户满意度', trend: '+20%' },
            ].map((item) => (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-xs text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.trend}
                </div>
                <m.div
                  className="w-full bg-primary/40 rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${item.value}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <span className="text-xs text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 更新日志 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">最近更新</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <i className="i-lucide-history size-3" />
              查看全部
            </Button>
          </div>
          <div className="space-y-3">
            {[
              {
                version: 'v2.1.0',
                date: '2024/03',
                type: 'major',
                changes: [
                  { type: 'feature', text: '新增 AI 助手功能' },
                  { type: 'optimization', text: '性能优化提升' },
                  { type: 'fix', text: '修复已知问题' },
                ],
              },
              {
                version: 'v2.0.9',
                date: '2024/02',
                type: 'minor',
                changes: [
                  { type: 'optimization', text: '界面交互优化' },
                  { type: 'feature', text: '新增数据分析' },
                ],
              },
              {
                version: 'v2.0.8',
                date: '2024/01',
                type: 'patch',
                changes: [
                  { type: 'feature', text: '新增快捷操作' },
                  { type: 'fix', text: '提升系统稳定性' },
                ],
              },
            ].map((item) => (
              <m.div
                key={item.version}
                className={cn('p-3 rounded-lg', item.type === 'major' ? 'bg-primary/10' : 'bg-muted/30')}
                whileHover={{ x: 5, backgroundColor: 'rgba(var(--primary), 0.1)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.version}</span>
                    {item.type === 'major' && (
                      <Badge variant="default" className="text-[10px]">
                        重要更新
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                </div>
                <div className="space-y-1.5">
                  {item.changes.map((change) => (
                    <div key={change.text} className="flex items-center gap-2 text-xs">
                      <i
                        className={cn(
                          'size-3',
                          change.type === 'feature' && 'i-lucide-plus-circle text-green-500',
                          change.type === 'optimization' && 'i-lucide-zap text-yellow-500',
                          change.type === 'fix' && 'i-lucide-wrench text-blue-500',
                        )}
                      />
                      <span className="text-muted-foreground">{change.text}</span>
                    </div>
                  ))}
                </div>
              </m.div>
            ))}
          </div>
        </div>

        {/* 用户反馈 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">用户反馈</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">满意度</span>
              <span className="font-medium text-primary">96%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '功能完善', value: 92, color: 'bg-green-500' },
              { label: '使用便捷', value: 88, color: 'bg-blue-500' },
              { label: '界面美观', value: 95, color: 'bg-purple-500' },
              { label: '运行稳定', value: 90, color: 'bg-yellow-500' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <m.div
                    className={cn('h-full rounded-full', item.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

const userCaseData = [
  {
    icon: 'i-lucide-building',
    title: '企业协作',
    description: '提升团队协作效率，实现业务增长',
    metrics: [
      { label: '效率提升', value: '85%' },
      { label: '成本节省', value: '60%' },
      { label: '团队规模', value: '200+' },
      { label: '项目数量', value: '50+' },
    ],
  },
  {
    icon: 'i-lucide-graduation-cap',
    title: '教育机构',
    description: '优化教学管理流程，提升教学质量',
    metrics: [
      { label: '师生互动', value: '96%' },
      { label: '课程完成', value: '92%' },
      { label: '学习效果', value: '89%' },
      { label: '满意度', value: '95%' },
    ],
  },
  {
    icon: 'i-lucide-shopping-bag',
    title: '电商平台',
    description: '提升运营效率，优化用户体验',
    metrics: [
      { label: '转化率', value: '35%' },
      { label: '复购率', value: '65%' },
      { label: '效率提升', value: '75%' },
      { label: '成本降低', value: '45%' },
    ],
  },
]

const techAdvantageData = [
  {
    icon: 'i-lucide-cpu',
    title: '高性能架构',
    description: '采用最新技术栈，确保系统高效稳定运行，支持大规模并发访问',
  },
  {
    icon: 'i-lucide-shield-check',
    title: '安全保障',
    description: '多重安全防护机制，保护数据安全，支持多级别权限控制',
  },
  {
    icon: 'i-lucide-settings',
    title: '灵活扩展',
    description: '模块化设计，支持功能自由组合，满足不同场景需求',
  },
  {
    icon: 'i-lucide-cloud',
    title: '云原生架构',
    description: '基于云原生技术，支持多云部署，确保服务高可用',
  },
]

export const FeatureIntroStep = () => {
  const [activeFeature, setActiveFeature] = useState<string>()

  return (
    <BaseStep icon="i-lucide-sparkles" title="探索强大功能" description="我们提供了一系列实用功能，助您提升使用体验">
      <m.div className="space-y-16" initial="initial" animate="animate" variants={staggerContainer}>
        {/* 个性化工作区 */}
        <FeatureSection icon="i-lucide-layout-dashboard" title="个性化工作区" description="根据需求自定义您的工作环境">
          <m.div
            className="relative bg-muted/30 rounded-xl border p-6"
            whileHover={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
            transition={{ duration: 0.3 }}
          >
            <DragableGrid items={workspaceFeatures} columns={2} />
            <m.div
              className="absolute -bottom-4 inset-x-0 flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button variant="secondary" size="sm" className="shadow-lg" onClick={() => {}}>
                <i className="i-lucide-plus w-4 h-4 mr-1" />
                添加模块
              </Button>
            </m.div>
          </m.div>
        </FeatureSection>

        {/* 数据管理 */}
        <FeatureSection icon="i-lucide-database" title="数据管理" description="高效的数据组织与管理方式">
          <div className="grid md:grid-cols-3 gap-6">
            <AnimatePresence>
              {dataManagementFeatures.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  {...feature}
                  onClick={() => setActiveFeature(feature.id)}
                  isActive={activeFeature === feature.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </FeatureSection>

        {/* 协作功能展示 */}
        <FeatureSection icon="i-lucide-users" title="团队协作" description="提供完善的团队协作解决方案">
          <div className="space-y-6">
            <FeatureShowcase {...advancedFeatures.collaboration} />
            <FeatureShowcase {...advancedFeatures.security} className="bg-muted/5" />
          </div>
        </FeatureSection>

        {/* 特色功能 */}
        <FeatureSection icon="i-lucide-star" title="特色亮点" description="独特的产品优势">
          <FeatureHighlight features={highlightFeatures} />
        </FeatureSection>

        {/* 自动化工具 */}
        <FeatureSection icon="i-lucide-settings" title="自动化工具" description="提升工作效率的智能助手">
          <Card className="bg-card overflow-hidden">
            <m.div
              className="p-6"
              whileHover={{ backgroundColor: 'rgba(var(--primary), 0.05)' }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid md:grid-cols-2 gap-8">
                <FeatureGroup
                  {...automationFeatures.smartSuggestions}
                  activeFeature={activeFeature}
                  onFeatureClick={setActiveFeature}
                />
                <FeatureGroup
                  {...automationFeatures.workflow}
                  activeFeature={activeFeature}
                  onFeatureClick={setActiveFeature}
                />
              </div>
            </m.div>
          </Card>
        </FeatureSection>

        {/* 数据分析 */}
        <FeatureSection icon="i-lucide-bar-chart" title="数据分析" description="深入了解您的使用情况">
          <div className="grid md:grid-cols-3 gap-6">
            {analyticsFeatures.map((feature, index) => (
              <m.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.features.join(' · ')}
                  preview={
                    <ul className="space-y-2 mt-3">
                      {feature.features.map((item) => (
                        <m.li
                          key={item}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                          whileHover={{ x: 5 }}
                        >
                          <i className="i-lucide-check w-4 h-4 text-green-500" />
                          {item}
                        </m.li>
                      ))}
                    </ul>
                  }
                />
              </m.div>
            ))}
          </div>
        </FeatureSection>

        <FeatureSection
          icon="i-lucide-users"
          title="用户案例"
          description="了解其他用户如何使用我们的产品"
          titleAlign="left"
        >
          <UserCases cases={userCaseData} />
        </FeatureSection>

        <FeatureSection icon="i-lucide-cpu" title="技术优势" description="深入了解我们的技术实力" titleAlign="left">
          <TechAdvantage advantages={techAdvantageData} />
        </FeatureSection>

        <FeatureSection
          icon="i-lucide-grid"
          title="网格布局展示"
          description="简洁的网格布局，突出核心特性"
          titleAlign="left"
        >
          <FeatureGrid
            features={[
              {
                icon: 'i-lucide-zap',
                title: '快速响应',
                description: '优化的性能表现，提供流畅的操作体验',
                tags: ['高性能', '低延迟'],
              },
              // ... 更多特性
            ]}
          />
        </FeatureSection>

        <FeatureSection
          icon="i-lucide-list"
          title="列表布局展示"
          description="详细的特性说明，展示完整功能"
          titleAlign="left"
        >
          <FeatureList
            features={[
              {
                icon: 'i-lucide-shield',
                title: '安全保障',
                description: '全方位的安全防护措施，保护您的数据安全',
                details: [
                  {
                    title: '数据加密',
                    description: '端到端加密，确保数据传输和存储安全',
                    status: { type: 'success', message: '运行正常' },
                    metrics: [
                      { label: '加密强度', value: '256位', trend: '+32位' },
                      { label: '安全评级', value: 'A+', trend: '+1' },
                      { label: '漏洞修复', value: '100%', trend: '+5%' },
                    ],
                    chart: {
                      data: [65, 75, 85, 80, 90, 95, 98],
                      labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                    },
                    demo: (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded bg-primary/5">
                          <i className="i-lucide-lock size-4 text-primary animate-pulse" />
                          <span className="text-xs">正在进行安全扫描...</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { name: '防火墙', status: 'active' },
                            { name: '入侵检测', status: 'active' },
                            { name: '漏洞扫描', status: 'scanning' },
                          ].map((item) => (
                            <div key={item.name} className="p-2 text-center rounded bg-muted/30">
                              <i
                                className={cn(
                                  'size-4',
                                  item.status === 'active'
                                    ? 'i-lucide-check-circle text-green-500'
                                    : 'i-lucide-loader-2 text-yellow-500 animate-spin',
                                )}
                              />
                              <div className="text-xs mt-1">{item.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                    actions: [
                      { icon: 'i-lucide-refresh-cw', label: '更新安全策略' },
                      { icon: 'i-lucide-file-text', label: '查看报告' },
                    ],
                  },
                  {
                    title: '访问控制',
                    description: '细粒度的权限管理和访问控制系统',
                    status: { type: 'warning', message: '需要审核' },
                    metrics: [
                      { label: '角色类型', value: '12+', trend: '+3' },
                      { label: '权限项', value: '50+', trend: '+15' },
                      { label: '审计记录', value: '100%', trend: '0' },
                    ],
                    chart: {
                      data: [30, 45, 60, 75, 85, 90, 95],
                      labels: ['角色', '权限', '策略', '组织', '审计', '日志', '报告'],
                    },
                    demo: (
                      <div className="space-y-2">
                        {[
                          { role: '管理员', access: '完全控制', color: 'primary' },
                          { role: '开发者', access: '受限访问', color: 'yellow-500' },
                          { role: '访客', access: '只读权限', color: 'blue-500' },
                        ].map((item) => (
                          <div key={item.role} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex items-center gap-2">
                              <i className={cn('i-lucide-user size-4', `text-${item.color}`)} />
                              <span className="text-xs">{item.role}</span>
                            </div>
                            <Badge variant="outline" className={cn('text-[10px]', `text-${item.color}`)}>
                              {item.access}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ),
                    actions: [
                      { icon: 'i-lucide-users', label: '管理角色' },
                      { icon: 'i-lucide-shield', label: '权限配置' },
                    ],
                  },
                  {
                    title: '安全审计',
                    description: '完整的安全审计和日志记录',
                    status: { type: 'info', message: '实时监控' },
                    metrics: [
                      { label: '日志保留', value: '90天', trend: '+30天' },
                      { label: '审计覆盖', value: '100%', trend: '+10%' },
                      { label: '异常检测', value: '实时', trend: '优化' },
                    ],
                    chart: {
                      data: [20, 35, 15, 85, 45, 65, 30],
                      labels: ['登录', '操作', '访问', '异常', '警告', '错误', '其他'],
                    },
                    demo: (
                      <div className="space-y-1">
                        {[
                          { time: '10:30', event: '用户登录', type: 'info', ip: '192.168.1.1' },
                          { time: '10:25', event: '文件访问', type: 'warning', ip: '192.168.1.2' },
                          { time: '10:20', event: '权限变更', type: 'alert', ip: '192.168.1.3' },
                        ].map((log) => (
                          <div
                            key={log.time}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded text-xs',
                              log.type === 'info' && 'bg-primary/5',
                              log.type === 'warning' && 'bg-yellow-500/5',
                              log.type === 'alert' && 'bg-red-500/5',
                            )}
                          >
                            <span className="text-muted-foreground">{log.time}</span>
                            <span>{log.event}</span>
                            <span className="text-muted-foreground text-[10px] ml-auto">{log.ip}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                log.type === 'info' && 'text-primary',
                                log.type === 'warning' && 'text-yellow-500',
                                log.type === 'alert' && 'text-red-500',
                              )}
                            >
                              {log.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ),
                    actions: [
                      { icon: 'i-lucide-history', label: '查看历史' },
                      { icon: 'i-lucide-download', label: '导出日志' },
                    ],
                  },
                ],
              },
              {
                icon: 'i-lucide-zap',
                title: '性能优化',
                description: '全方位的性能优化和监控系统',
                details: [
                  {
                    title: '响应速度',
                    description: '优化系统响应速度，提供极致体验',
                    status: { type: 'success', message: '性能优异' },
                    metrics: [
                      { label: '页面加载', value: '0.8s', trend: '-0.3s' },
                      { label: 'API响应', value: '50ms', trend: '-20ms' },
                      { label: '资源利用', value: '85%', trend: '+15%' },
                    ],
                    chart: {
                      data: [95, 85, 90, 88, 92, 96, 94],
                      labels: ['首页', '列表', '详情', '搜索', '编辑', '预览', '其他'],
                    },
                    demo: (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <i className="i-lucide-activity size-4 text-primary animate-pulse" />
                            <span className="text-xs">性能监控中</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-green-500">
                            优秀
                          </Badge>
                        </div>
                        <div className="relative h-8">
                          <m.div
                            className="absolute inset-0 bg-primary/10 rounded"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
                          />
                          <m.div
                            className="absolute left-0 top-1/2 -translate-y-1/2 size-3 rounded-full bg-primary"
                            animate={{ x: ['0%', '100%', '0%'] }}
                            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
                          />
                        </div>
                      </div>
                    ),
                    actions: [
                      { icon: 'i-lucide-bar-chart', label: '性能报告' },
                      { icon: 'i-lucide-settings', label: '优化配置' },
                    ],
                  },
                ],
              },
            ]}
          />
        </FeatureSection>

        <FeatureSection
          icon="i-lucide-image"
          title="图片布局展示"
          description="视觉化展示，直观呈现功能特性"
          titleAlign="left"
        >
          <FeatureImage
            features={[
              {
                title: '智能分析',
                description: '强大的数据分析能力，助您做出明智决策',
                image: '/path/to/image.jpg',
                align: 'right',
              },
              // ... 更多特性
            ]}
          />
        </FeatureSection>

        <FeatureSection
          icon="i-lucide-layout"
          title="卡片布局展示"
          description="现代化的卡片设计，突出重点特性"
          titleAlign="left"
        >
          <FeatureCards
            features={[
              {
                icon: 'i-lucide-sparkles',
                title: 'AI 助手',
                description: '智能化的辅助功能，提供个性化建议',
                color: '#FF6B6B',
              },
              // ... 更多特性
            ]}
          />
        </FeatureSection>

        <m.section
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Button variant="secondary" size="lg" className="gap-2" onClick={() => {}}>
            <i className="i-lucide-book-open w-4 h-4" />
            查看更多功能
          </Button>
          <p className="text-sm text-muted-foreground">探索更多强大功能，提升您的使用体验</p>
        </m.section>
      </m.div>
    </BaseStep>
  )
}
