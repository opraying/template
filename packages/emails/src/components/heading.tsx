import { useEmailStyles } from '@xstack/emails/components/styles'
import type { ReactNode } from 'react'

export const Heading = ({ children }: { children: ReactNode }) => {
  const styles = useEmailStyles()
  return <h1 style={styles.heading}>{children}</h1>
}
