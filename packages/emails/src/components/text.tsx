import { Link as EmailLink, Text as EmailText } from 'jsx-email'
import type { ReactNode } from 'react'
import { useTheme } from './theme-context'

interface TextProps {
  style?: React.CSSProperties | undefined
  children: ReactNode
}

interface LinkProps {
  href: string
  target?: string
  style?: React.CSSProperties | undefined
  children: ReactNode
}

export const Text = ({ children, style }: TextProps) => {
  const colors = useTheme()

  const styles = {
    paragraph: {
      color: colors.text.secondary,
      fontSize: '16px',
      lineHeight: '22px',
      margin: '10px 0px',
      textAlign: 'left' as const,
    },
  }

  return (
    <EmailText
      style={{
        ...styles.paragraph,
        ...style,
      }}
    >
      {children}
    </EmailText>
  )
}

export const Link = ({ children, style, ...props }: LinkProps) => {
  const colors = useTheme()

  const styles = {
    link: {
      color: colors.text.link,
      textDecoration: 'underline',
    },
  }

  return (
    <EmailLink style={{ ...styles.link, ...style }} {...props}>
      {children}
    </EmailLink>
  )
}
