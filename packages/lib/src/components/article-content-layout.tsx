import type { ReactNode } from 'react'

export function ArticleContentLayout({
  children,
  description,
  title,
  titleProps,
  date,
}: {
  title?: string
  titleProps?: React.HTMLProps<HTMLHeadingElement>
  description?: ReactNode
  date?: string
  children?: ReactNode
}) {
  return (
    <div>
      <p className="text-fl-2xl font-normal linear-gradient-text" {...titleProps}>
        {title}
      </p>
      <p className="py-fl-sm text-fl-base">{description}</p>
      <div className="px-fl-lg">{date}</div>
      <div className="flex justify-center">
        <div className="py-fl-sm prose dark:prose-invert">{children}</div>
      </div>
    </div>
  )
}
