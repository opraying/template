import type { ThemeColors } from '@xstack/emails/components/theme-context'
import type { CompanyInfo } from '@xstack/emails/components/types'

export const config: {
  company: CompanyInfo
} = {
  company: {
    name: 'Acme Corp',
    url: 'https://acme.com',
    logo: {
      src: 'https://jsx.email/assets/demo/notion-logo.png',
      width: 48,
      height: 48,
      alt: "Acme Corp's Logo",
    },
    address: '354 Oyster Point Blvd, South San Francisco, CA 94080',
    links: [
      { href: 'https://acme.com/privacy', label: 'Privacy' },
      { href: 'https://acme.com/terms', label: 'Terms' },
      { href: 'https://acme.com/security', label: 'Security' },
    ],
    description: "Acme Corp's description",
  },
}

export const theme: Partial<ThemeColors> = {
  primary: '#49b868',
  radius: 'md',
}
