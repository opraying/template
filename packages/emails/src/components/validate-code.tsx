import { useEmailStyles } from '@xstack/emails/components/styles'

export const ValidateCode = ({ code }: { code: string }) => {
  const styles = useEmailStyles()

  return <code style={styles.codeBlock}>{code}</code>
}
