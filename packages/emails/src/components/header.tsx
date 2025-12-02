import { Hr, Img } from 'jsx-email'
import type { ReactNode } from 'react'
import { useEmailStyles } from './styles'

interface HeaderProps {
  logo?: {
    src: string
    width?: number
    height?: number
    alt?: string
  }
  children?: ReactNode
}

export const Header = ({ logo, children }: HeaderProps) => {
  const styles = useEmailStyles()

  return (
    <>
      {logo && <Img src={logo.src} width={logo.width} height={logo.height} alt={logo.alt} style={styles.logo} />}
      {children}
      <Hr style={styles.hr} />
    </>
  )
}
