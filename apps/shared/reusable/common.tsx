import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function InputItem({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="">{title}</div>
      <div className="">{children}</div>
    </div>
  )
}

export function SettingGroup({
  title,
  description,
  children,
  separator = true,
}: {
  title?: ReactNode | undefined
  description?: ReactNode | undefined
  children?: ReactNode | undefined
  separator?: boolean | undefined
}) {
  return (
    <div className={cn('py-fl-3xs-sm', separator && '')}>
      {title && <div className="py-fl-2xs text-fl-base">{title}</div>}
      {description && <div className="text-fl-sm">{description}</div>}
      <div className="space-y-fl-xs px-fl-2xs py-fl-2xs-xs">{children}</div>
    </div>
  )
}

export function Group({ children, title }: { children?: ReactNode; title?: string }) {
  return (
    <div className="">
      <div className="flex items-center justify-between pb-1">
        <div className="text-base">{title}</div>
      </div>
      <div className="flex flex-col gap-y-4">{children}</div>
    </div>
  )
}
