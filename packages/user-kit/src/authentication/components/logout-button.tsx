import { Slot } from '@radix-ui/react-slot'
import { type AuthSignOutButtonProps, useAuthSignOutButton } from '@xstack/user-kit/authentication/hooks'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

interface LogoutDropdownMenuItemProps extends AuthSignOutButtonProps {
  asChild?: boolean
  children: ReactNode
}

export function LogoutDropdownMenuItem({ asChild, children, ...rest }: LogoutDropdownMenuItemProps) {
  const onSubmit = useAuthSignOutButton()

  const Comp = asChild ? Slot : DropdownMenuItem

  return <Comp onSelect={() => onSubmit(rest)}>{children}</Comp>
}

interface LogoutButtonProps extends AuthSignOutButtonProps {
  asChild?: boolean
  children: ReactNode
}

export function LogoutButton({ children, asChild, ...rest }: LogoutButtonProps) {
  const onSubmit = useAuthSignOutButton()

  const Comp = asChild ? Slot : Button

  return (
    <Comp
      onClick={() => {
        return onSubmit(rest)
      }}
    >
      {children}
    </Comp>
  )
}
