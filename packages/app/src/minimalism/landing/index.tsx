import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type Props = {
  name: string
  title: string
  description: string
  waitlist?: boolean
}

export function ComingSoonLanding({ name, title, description, waitlist }: Props) {
  return (
    <div className="flex flex-grow max-w-screen-lg mx-auto">
      <div className="flex flex-col justify-center items-center gap-4">
        <div className="max-w-screen-md">
          <div className="text-gray-1000 text-fl-3xl mb-2">{name}</div>
          <div className="flex flex-col gap-4">
            <span className="text-fl-4xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-blue-900 text-balance">
              {title}
            </span>
            <div className="text-gray-1000 mb-4 text-fl-base">{description}</div>
          </div>
        </div>
        {waitlist && <WaitlistForm />}
      </div>
    </div>
  )
}

function WaitlistForm() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="">
        <Input className="w-72" placeholder="Enter your email" />
      </div>
      <div>
        <Button type="button" size="lg">
          Join waitlist
        </Button>
      </div>
    </div>
  )
}
