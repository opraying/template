import { getRadius, useTheme } from './theme-context'

export const useEmailStyles = () => {
  const colors = useTheme()

  return {
    heading: {
      fontSize: '24px',
      fontWeight: 'bold' as const,
      margin: '24px 0',
      color: colors.text.primary,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: getRadius(colors.radius),
      color: colors.background.card,
      padding: '0px 2.5%',
      display: 'inline-block',
      textAlign: 'center' as const,
      textDecoration: 'none',
      lineHeight: '40px',
      marginBottom: '24px',
    },
    codeBlock: {
      display: 'inline-block',
      padding: '12px 4.5%',
      width: '90.5%',
      textAlign: 'center' as const,
      fontSize: '20px',
      backgroundColor: colors.background.main,
      borderRadius: getRadius(colors.radius),
      border: `1px solid ${colors.border}`,
      color: colors.text.primary,
    },
    logo: {
      marginBottom: '24px',
    },
    hr: {
      borderColor: colors.border,
      margin: '20px 0',
    },
  }
}
