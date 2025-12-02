import { useOAuthOpener } from '@xstack/user-kit/authentication/hooks'
import type { OAuthStateOptionsInput } from '@xstack/user-kit/oauth/provider'
import * as String from 'effect/String'
import { Button } from '@/components/ui/button'

interface OAuthButtonProps {
  /**
   * The OAuth provider to use
   */
  provider: string
  /**
   * Whether to use portal mode (popup window) for OAuth
   * @default false - uses redirect mode
   */
  portal?: boolean
  /**
   * Callback to invoke on successful OAuth authentication
   */
  onSuccess?: (() => void) | undefined
  /**
   * Callback to invoke on failed OAuth authentication
   */
  onFailure?: ((cause: unknown) => void) | undefined
}

const googleIcon = <i className="i-logos-google-icon size-6" />

const githubIcon = <i className="i-logos-github-icon dark:invert size-6" />

export const OAuthButton = ({ provider, portal = false, onSuccess, onFailure }: OAuthButtonProps) => {
  const origin = window.location.origin
  const handleOAuthClick = useOAuthOpener()

  const options = {
    isPortal: portal ? 'true' : 'false',
  } satisfies Partial<OAuthStateOptionsInput>
  const urlSearchParams = new URLSearchParams(options)
  const oauthUrl = `${origin}/api/oauth/${String.uncapitalize(provider)}?${urlSearchParams.toString()}`

  const handleClick = () => {
    handleOAuthClick({
      portal,
      url: oauthUrl,
      onSuccess,
      onFailure,
    })
  }

  return (
    <Button variant="ghost" className="w-full gap-x-2" onClick={handleClick}>
      <div className="w-8 justify-center flex items-center">{provider === 'Google' ? googleIcon : githubIcon}</div>
      <div className="min-w-40 text-left">Continue with {provider}</div>
    </Button>
  )
}
