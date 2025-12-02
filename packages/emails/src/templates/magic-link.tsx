import { Button } from '@xstack/emails/components/button'
import { Footer } from '@xstack/emails/components/footer'
import { Header } from '@xstack/emails/components/header'
import { Heading } from '@xstack/emails/components/heading'
import { EmailLayout } from '@xstack/emails/components/layout'
import { Text } from '@xstack/emails/components/text'
import type { ThemeColors } from '@xstack/emails/components/theme-context'
import type { CompanyInfo } from '@xstack/emails/components/types'
import { ValidateCode } from '@xstack/emails/components/validate-code'
import { Head } from 'jsx-email'
import { MagicLinkTemplateSchema } from '../schema'
import { getDefaultProps } from '../template'

export type MagicLinkTemplateProps = typeof MagicLinkTemplateSchema.Encoded

export const defaultProps = getDefaultProps(MagicLinkTemplateSchema)

export const make =
  ({ company, theme }: { company: CompanyInfo; theme?: Partial<ThemeColors> }) =>
  ({ loginCode = defaultProps.loginCode, hint = defaultProps.hint }: MagicLinkTemplateProps = defaultProps) => {
    return (
      <EmailLayout preview="Log in with this magic link" theme={theme}>
        <Head />
        <Header logo={company.logo} />
        <Heading>Login to {company.name}</Heading>
        <Text>Copy and paste this temporary login code</Text>
        <ValidateCode code={loginCode} />
        <Text>Or click the button below to log in</Text>
        <Button href={company.url} height={40} width={260}>
          Click here to log in
        </Button>
        <Text>If you haven&apos;t try to login, you can safely ignore this email.</Text>
        {hint && <Text>{hint}</Text>}
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
  }
