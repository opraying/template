import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SecurityFeatureProps {
  icon: string
  title: string
  description: string
  status?: React.ReactNode
}

export const SecurityFeature = ({ icon, title, description, status }: SecurityFeatureProps) => {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <i className={cn(icon, 'w-5 h-5')} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {status && <CardContent>{status}</CardContent>}
    </Card>
  )
}
