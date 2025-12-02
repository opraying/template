import { Button } from '@xstack/emails/components/button'
import { Footer } from '@xstack/emails/components/footer'
import { Header } from '@xstack/emails/components/header'
import { Heading } from '@xstack/emails/components/heading'
import { EmailLayout } from '@xstack/emails/components/layout'
import { Link, Text } from '@xstack/emails/components/text'
import type { ThemeColors } from '@xstack/emails/components/theme-context'
import type { CompanyInfo } from '@xstack/emails/components/types'
import { Head } from 'jsx-email'
import { WelcomeTemplateSchema } from '../schema'
import { getDefaultProps } from '../template'

export type WelcomeTemplateProps = typeof WelcomeTemplateSchema.Encoded

export const defaultProps = getDefaultProps(WelcomeTemplateSchema)

export const make =
  ({ company, theme }: { company: CompanyInfo; theme?: Partial<ThemeColors> }) =>
  ({ message = defaultProps.message }: WelcomeTemplateProps = defaultProps) => (
    <EmailLayout preview={message} theme={theme}>
      <Head />
      <Header logo={company.logo} />
      <Heading>Welcome to {company.name}!</Heading>
      <Text>{message}</Text>
      <Button href={`${company.url}/`} height={40} width={260}>
        View your {company.name} Dashboard
      </Button>
      <Text>
        If you haven't finished your integration, you might find our <Link href={`${company.url}/docs`}>docs</Link>{' '}
        handy.
      </Text>
      <Text>
        Once you're ready to start accepting payments, you'll just need to use your live{' '}
        <Link href={`${company.url}/dashboard/apikeys`}>API keys</Link> instead of your test API keys. Your account can
        simultaneously be used for both test and live requests, so you can continue testing while accepting live
        payments. Check out our <Link href={`${company.url}/docs/dashboard`}>tutorial about account basics</Link>.
      </Text>
      <Footer
        companyName={company.name}
        companyUrl={company.url}
        companyAddress={company.address}
        links={company.links}
      >
        {company.description}
      </Footer>
    </EmailLayout>
  )
