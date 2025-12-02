import { useEmailStyles } from '@xstack/emails/components/styles'
import { type ButtonProps, Button as EmailButton } from 'jsx-email'

export const Button = ({ children, ...props }: ButtonProps) => {
  const styles = useEmailStyles()

  return (
    <EmailButton {...props} style={styles.button}>
      {children}
    </EmailButton>
  )
}
