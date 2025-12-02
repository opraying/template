export const HEADER_LINKS = [
  {
    href: '/',
    icon: <i className="i-lucide-home" />,
    label: 'Home',
  },
  {
    href: '/activity',
    icon: <i className="i-lucide-activity" />,
    label: 'Activity',
  },
]

export const ALT_LINKS = [
  {
    href: '/',
    icon: <i className="i-lucide-activity" />,
    label: 'Todo',
  },
]

export const KEY_SCOPE = {
  BASIC: 'basic',
  APP: 'app',
} as const
export const KEY_SCOPES = Object.values(KEY_SCOPE)
export const APP_ROOT_SCOPE = [KEY_SCOPE.APP]
