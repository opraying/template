import { BaseStep } from '@xstack/app-kit/onboarding/components/base-step'
import { m } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  icon: string
  hint: string
}

const SectionHeader = ({ title, icon, hint }: SectionHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{title}</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <i className={cn(icon, 'w-4 h-4')} />
        <span>{hint}</span>
      </div>
    </div>
  )
}

interface ThemeOptionProps {
  icon: string
  label: string
  preview: string
  isSelected?: boolean
  onClick?: () => void
}

const ThemeOption = ({ icon, label, preview, isSelected, onClick }: ThemeOptionProps) => {
  return (
    <m.div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border bg-card p-2 transition-colors hover:bg-accent cursor-pointer',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <div className={cn('h-12 rounded-md mb-2', preview)} />
      <div className="flex items-center gap-2 text-sm">
        <i className={cn(icon, 'w-4 h-4')} />
        <span>{label}</span>
      </div>
      <div className="absolute inset-0 rounded-lg ring-2 ring-primary/10 group-hover:ring-primary/20" />
    </m.div>
  )
}

interface FeatureCardProps {
  icon: string
  title: string
  description: string
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <div>
      <Card className="bg-muted/5 hover:bg-muted/10 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <i className={cn(icon, 'w-5 h-5 text-primary')} />
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface PreferenceItemProps {
  icon: string
  title: string
  description: string
  enabled: boolean
  onChange: (value: boolean) => void
}

const PreferenceItem = ({ icon, title, description, enabled, onChange }: PreferenceItemProps) => {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 bg-muted/5">
      <div className="flex gap-3">
        <div className="mt-1">
          <i className={cn(icon, 'w-5 h-5 text-muted-foreground')} />
        </div>
        <div>
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} />
    </div>
  )
}

export const ProfileSetup = () => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light')
  const [preferences, setPreferences] = useState({
    followSystem: true,
    notifications: true,
  })

  return (
    <BaseStep icon="i-lucide-user-cog" title="探索功能特性" description="了解产品特色，开启个性化体验">
      <div className="grid md:grid-cols-3 gap-4">
        <FeatureCard icon="i-lucide-palette" title="个性化主题" description="支持明暗主题切换，打造舒适的使用环境" />
        <FeatureCard icon="i-lucide-keyboard" title="快捷操作" description="丰富的快捷键支持，提升操作效率" />
        <FeatureCard icon="i-lucide-bell" title="智能提醒" description="及时获取重要信息，不错过任何更新" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="i-lucide-settings-2 w-5 h-5 text-primary" />
            快速设置
          </CardTitle>
          <CardDescription>选择几个基础选项，稍后可以在设置中调整更多</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题预览 */}
          <div className="space-y-3">
            <SectionHeader title="显示主题" icon="i-lucide-sun" hint="选择适合的显示模式" />
            <div className="grid grid-cols-2 gap-3">
              <ThemeOption
                icon="i-lucide-sun"
                label="明亮模式"
                preview="bg-white"
                isSelected={currentTheme === 'light'}
                onClick={() => setCurrentTheme('light')}
              />
              <ThemeOption
                icon="i-lucide-moon"
                label="暗黑模式"
                preview="bg-zinc-900"
                isSelected={currentTheme === 'dark'}
                onClick={() => setCurrentTheme('dark')}
              />
            </div>
          </div>
          <div className="space-y-3">
            <SectionHeader title="基础选项" icon="i-lucide-sliders" hint="按需开启" />
            <PreferenceItem
              icon="i-lucide-bell"
              title="接收通知提醒"
              description="及时获取重要的更新和提醒"
              enabled={preferences.notifications}
              onChange={(value) => setPreferences((prev) => ({ ...prev, notifications: value }))}
            />
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-muted/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <i className="i-lucide-keyboard w-5 h-5 text-primary" />
          <h3 className="font-medium">效率提升小贴士</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">使用快捷命令快速操作</p>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">⌘ K</kbd>
              <span className="text-sm">随时唤起命令面板</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">快速查找任何内容</p>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">⌘ /</kbd>
              <span className="text-sm">全局搜索</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <i className="i-lucide-lightbulb w-4 h-4" />
        <span>
          在
          <Button variant="link" size="sm" className="px-1 h-auto">
            系统设置
          </Button>
          中探索更多个性化选项
        </span>
      </div>
    </BaseStep>
  )
}
