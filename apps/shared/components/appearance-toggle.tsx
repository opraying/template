import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppearance } from '@/lib/appearance/hooks'

type InputColorScheme = 'light' | 'dark' | 'system'

interface AppearaceToggleProps {
  setAppearance?: (colorScheme: InputColorScheme) => void
}

export const mode = [
  {
    icon: <i className="i-lucide-sun-medium mr-2 h-4 w-4" />,
    name: 'light',
  },
  {
    icon: <i className="i-lucide-moon mr-2 h-4 w-4" />,
    name: 'dark',
  },
  {
    icon: <i className="i-lucide-laptop mr-2 h-4 w-4" />,
    name: 'system',
  },
] as const

export function AppearanceToggle({ setAppearance }: AppearaceToggleProps) {
  const appearance = useAppearance()
  const { t } = useTranslation()

  const handleSet = setAppearance || appearance.setAppearance

  return (
    <DropdownMenu>
      <DropdownMenuTrigger suppressHydrationWarning asChild>
        <Button size="sm" variant="ghost" className="w-full">
          <i className="i-lucide-moon rotate-0 scale-100 transition-all hover:text-gray-900 dark:-rotate-90 dark:scale-0" />
          <i className="i-lucide-moon absolute rotate-90 scale-0 transition-all hover:text-gray-900 dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle appearace</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {mode.map((item) => {
          return (
            <DropdownMenuItem
              className={appearance.appearance.toLowerCase() === item.name ? 'bg-accent text-accent-foreground' : ''}
              key={item.name}
              onClick={() => handleSet(item.name)}
            >
              {item.icon}
              <span>{t(`theme.${item.name}`, { defaultValue: item.name })}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
