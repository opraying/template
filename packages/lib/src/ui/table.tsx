import type * as React from 'react'

import { cn } from '@/lib/utils'

const Table = ({ className, ...props }: React.ComponentPropsWithRef<'table'>) => (
  <div className="relative w-full overflow-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
)
Table.displayName = 'Table'

const TableHeader = ({ className, ...props }: React.ComponentPropsWithRef<'thead'>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
)
TableHeader.displayName = 'TableHeader'

const TableBody = ({ className, ...props }: React.ComponentPropsWithRef<'tbody'>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)
TableBody.displayName = 'TableBody'

const TableFooter = ({ className, ...props }: React.ComponentPropsWithRef<'tfoot'>) => (
  <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />
)
TableFooter.displayName = 'TableFooter'

const TableRow = ({ className, ...props }: React.ComponentPropsWithRef<'tr'>) => (
  <tr
    className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
    {...props}
  />
)
TableRow.displayName = 'TableRow'

const TableHead = ({ className, ...props }: React.ComponentPropsWithRef<'th'>) => (
  <th
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
)
TableHead.displayName = 'TableHead'

const TableCell = ({ className, ...props }: React.ComponentPropsWithRef<'td'>) => (
  <td className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
)
TableCell.displayName = 'TableCell'

const TableCaption = ({ className, ...props }: React.ComponentPropsWithRef<'caption'>) => (
  <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
)
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
