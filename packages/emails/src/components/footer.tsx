import type { ReactNode } from 'react'
import { Link, Text } from './text'
import { useTheme } from './theme-context'

interface FooterProps {
  children?: ReactNode
  companyName?: string | undefined
  companyUrl?: string | undefined
  companyAddress?: string | undefined
  links?:
    | Array<{
        href: string
        label: string
      }>
    | undefined
}

export const Footer = ({ children, companyName, companyUrl, companyAddress, links }: FooterProps) => {
  const colors = useTheme()

  const styles = {
    wrapper: {
      marginTop: '32px',
      borderTop: `1px solid ${colors.border}`,
      paddingTop: '24px',
    },
    linkContainer: {
      marginBottom: '10px',
      fontSize: '13px',
    },
    separator: {
      margin: '0 8px',
      color: colors.text.secondary,
      display: 'inline-block',
    },
    content: {
      fontSize: '13px',
    },
    companyInfo: {
      fontSize: '12px',
      margin: '0px 0px',
      color: colors.text.secondary,
    },
  }

  return (
    <div style={styles.wrapper}>
      {links && links.length > 0 && (
        <div style={styles.linkContainer}>
          {links.map((link, index) => (
            <span key={link.href}>
              <Link href={link.href} target="_blank">
                {link.label}
              </Link>
              {index < links.length - 1 && <span style={styles.separator}>•</span>}
            </span>
          ))}
        </div>
      )}
      {children && <Text style={styles.content}>{children}</Text>}
      {(companyName || companyAddress) && (
        <Text style={styles.companyInfo}>
          {companyName && companyUrl && (
            <>
              <Link href={companyUrl} target="_blank">
                {companyName}
              </Link>
              {companyAddress && ' • '}
            </>
          )}
          {companyAddress}
        </Text>
      )}
    </div>
  )
}
