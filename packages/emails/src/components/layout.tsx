import { Body, ColorScheme, Container, Html, Preview, Section } from 'jsx-email'
import type { ReactNode } from 'react'
import { getRadius, type ThemeColors, ThemeProvider } from './theme-context'

interface EmailLayoutProps {
  children: ReactNode
  preview: string
  theme: Partial<ThemeColors> | undefined
}

export const EmailLayout = ({ children, preview, theme }: EmailLayoutProps) => {
  const styles = {
    container: {
      backgroundColor: theme?.background?.card ?? '#ffffff',
      margin: '0 auto',
      padding: '26px 0 48px',
      marginBottom: '64px',
      borderRadius: getRadius(theme?.radius),
    },
    section: {
      padding: '0 24px',
    },
    main: {
      marginTop: '10px',
      paddingTop: '30px',
      paddingBottom: '10px',
      paddingLeft: '10px',
      paddingRight: '10px',
      backgroundColor: theme?.background?.main ?? '#f6f9fc',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
    },
  }

  return (
    <Html>
      <Preview>{preview}</Preview>
      <ThemeProvider theme={theme}>
        <ColorScheme mode="light dark" />
        <Body style={styles.main}>
          <Container style={styles.container}>
            <Section style={styles.section}>{children}</Section>
          </Container>
        </Body>
      </ThemeProvider>
    </Html>
  )
}
