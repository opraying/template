import { type ButtonProps, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type * as React from 'react'
import { useTranslation } from 'react-i18next'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)
Pagination.displayName = 'Pagination'

const PaginationContent = ({ className, ...props }: React.ComponentPropsWithRef<'ul'>) => (
  <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />
)
PaginationContent.displayName = 'PaginationContent'

const PaginationItem = ({ className, ...props }: React.ComponentPropsWithRef<'li'>) => (
  <li className={cn('', className)} {...props} />
)
PaginationItem.displayName = 'PaginationItem'

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'a'>

const PaginationLink = ({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size,
      }),
      className,
    )}
    {...props}
  />
)
PaginationLink.displayName = 'PaginationLink'

const PaginationPrevious = ({
  className,
  loading,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { loading?: boolean }) => {
  const { t } = useTranslation()
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('gap-1 pl-2.5', className)}
      {...props}
    >
      {loading ? <i className="i-lucide-loader size-4 animate-spin" /> : <i className="i-lucide-chevron-left size-4" />}
      <span>{t('misc.previous')}</span>
    </PaginationLink>
  )
}
PaginationPrevious.displayName = 'PaginationPrevious'

const PaginationNext = ({
  className,
  loading,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { loading?: boolean }) => {
  const { t } = useTranslation()
  return (
    <PaginationLink aria-label="Go to next page" size="default" className={cn('gap-1 pr-2.5', className)} {...props}>
      <span>{t('misc.next')}</span>
      {loading ? (
        <i className="i-lucide-loader size-4 animate-spin" />
      ) : (
        <i className="i-lucide-chevron-right size-4" />
      )}
    </PaginationLink>
  )
}
PaginationNext.displayName = 'PaginationNext'

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => {
  const { t } = useTranslation()
  return (
    <span aria-hidden className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
      <i className="i-lucide-more-horizontal size-4" />
      <span className="sr-only">{t('misc.more')}</span>
    </span>
  )
}
PaginationEllipsis.displayName = 'PaginationEllipsis'

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
