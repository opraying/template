import { cn } from '@/lib/utils'
import './loading.css'

export const SpinFallback = ({ className }: { className?: string }) => (
  <div className={cn('flex-1 w-full flex items-center justify-center', className)}>
    <div className="loader2" />
  </div>
)
