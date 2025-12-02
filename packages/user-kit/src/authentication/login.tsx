import { effectTsResolver } from '@xstack/form/resolver'
import { useNavigate } from '@xstack/router'
import { useToaster } from '@xstack/toaster'
import { useAuthConfig } from '@xstack/user-kit/authentication/components/auth-provider'
import { OAuthButton } from '@xstack/user-kit/authentication/components/oauth-button'
import {
  useLoginFlowEmail,
  useLoginFlowStep,
  useLoginSubmit,
  useVerifyEmailCodeSubmit,
} from '@xstack/user-kit/authentication/hooks'
import type { AuthScreenConfig } from '@xstack/user-kit/authentication/types'
import type { OAuthErrorLiteral } from '@xstack/user-kit/errors'
import { type Auth, EmailVerificationCodeSchema, LoginSchema, type OAuthProviderLiteral } from '@xstack/user-kit/schema'
import * as Match from 'effect/Match'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Separator } from '@/components/ui/separator'

const TextTransitionProps = {
  animate: 'visible',
  initial: 'hide',
  exit: 'hide',
}

const ContainerTransition = {
  visible: { opacity: 1, transition: { delay: 0.1, delayChildren: 0.2, staggerChildren: 0.3 } },
  hide: { opacity: 0, transition: { delay: 0.1 } },
}
const _GroupTransition = {
  visible: { opacity: 1, transition: { delayChildren: 0.2, staggerChildren: 0.3 } },
  hide: { opacity: 0 },
}
const _GroupChildTransition = {
  visible: { opacity: 1 },
  hide: { opacity: 0 },
}
const ContentTransition = {
  visible: { opacity: 1, y: 0 },
  hide: { opacity: 0, y: 5 },
}

interface LoginPageProps {
  name?: string | undefined
  logo?: string | undefined
  custom: AuthScreenConfig['custom']
}

export function LoginPage({ name, logo, custom }: LoginPageProps) {
  const navigate = useNavigate()
  const step = useLoginFlowStep()
  const location = useLocation()

  const handleBack = () => {
    // 如果是在验证码步骤，尝试返回到邮箱输入步骤
    if (step === 2) {
      // 这里应该调用某个重置步骤的函数，这需要根据您的实际逻辑实现
      // 例如: resetLoginFlow()

      // 临时解决方案：刷新页面回到第一步
      window.location.reload()
      return
    }

    // 否则正常后退
    if (location.key === 'default') {
      // 如果是直接打开的页面（没有历史记录），则导航到首页
      navigate.push('/')
    } else {
      // 否则正常后退
      navigate.back()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh w-full max-w-md mx-auto px-4">
      <div className="w-full flex flex-col space-y-5">
        <div className="flex items-center relative h-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={step === 2 ? 'Back to email' : 'Go back'}
            className="absolute left-0"
          >
            <i className="i-lucide-arrow-left w-4 h-4" />
          </Button>
          {logo && (
            <div className="mx-auto flex flex-col items-center">
              <img
                draggable={false}
                crossOrigin="anonymous"
                className="size-6 object-contain"
                src={logo}
                alt={name || 'Logo'}
              />
              {name && <p className="text-sm font-medium mt-0.5">{name}</p>}
            </div>
          )}
        </div>
        <LoginForm name={name} />
      </div>
    </div>
  )
}

export interface LoginFormProps {
  name?: string | undefined
  titleVisible?: boolean | undefined
  portal?: boolean | undefined
  onSuccess?: (() => void) | undefined
  onFailure?: ((error: unknown) => void) | undefined
}

export function LoginForm({ name, titleVisible, portal = false, onSuccess, onFailure }: LoginFormProps) {
  const { t } = useTranslation()
  const toast = useToaster()
  const step = useLoginFlowStep()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const webConfig = useAuthConfig()

  const params: {
    error: OAuthErrorLiteral | null
    provider: OAuthProviderLiteral | null
  } = {
    error: searchParams.get('error') as OAuthErrorLiteral,
    provider: searchParams.get('provider') as OAuthProviderLiteral,
  }

  const matchStep = Match.type<typeof step>().pipe(
    Match.when(1, () => (
      <Step1
        name={name}
        titleVisible={titleVisible}
        providers={webConfig.providers}
        portal={portal}
        onSuccess={onSuccess}
        onFailure={onFailure}
      />
    )),
    Match.when(2, () => <Step2 name={name} redirect={webConfig.loginRedirect || '/'} portal={portal} />),
    Match.exhaustive,
  )

  useEffect(() => {
    const matchError = Match.type<typeof params>().pipe(
      Match.when({ error: Match.string, provider: Match.any }, ({ error, provider }) => {
        setTimeout(() => {
          const message = t(`auth.oauth-error.${error}`, {
            provider,
            defaultValue: t('auth.oauth-error.unknown', { provider }),
          })

          toast.error(message, { duration: 5000, position: 'top-center' })
        }, 150)
      }),
      Match.orElse(() => {}),
    )

    matchError({
      error: params.error,
      provider: params.provider,
    })

    if (params.error) {
      // replace search params
      searchParams.delete('error')
      searchParams.delete('provider')

      navigate.setParams({
        error: params.error,
        provider: params.provider,
      })
    }
  }, [params.error, params.provider, t, searchParams, navigate, toast])

  return (
    <m.div variants={ContainerTransition} {...TextTransitionProps} className="w-full mx-auto flex flex-col gap-y-3">
      <div className="flex flex-col gap-y-3">
        {webConfig.allowEmailLogin ? matchStep(step) : <OAuthOptions providers={webConfig.providers} portal={portal} />}
      </div>
      <div className="text-center text-xs text-muted-foreground mt-4">
        <Trans i18nKey="auth.privacy-checked">
          <a target="_blank" href="/policy" rel="noreferrer" className="text-blue-600 px-[2px]" />
          <a target="_blank" href="/terms" rel="noreferrer" className="text-blue-600 px-[2px]" />
        </Trans>
      </div>
    </m.div>
  )
}

interface Step1Props {
  name?: string | undefined
  titleVisible?: boolean | undefined
  providers: string[]
  portal: boolean
  onSuccess?: (() => void) | undefined
  onFailure?: ((cause: unknown) => void) | undefined
}

const Step1 = ({ name, titleVisible = true, providers, portal, onSuccess, onFailure }: Step1Props) => {
  'use no memo'

  const { t } = useTranslation()
  const form = useForm({
    resolver: effectTsResolver(LoginSchema),
    mode: 'onBlur',
  })
  const { formState } = form
  const email = form.watch('email')
  const isDisabled = formState.isSubmitting || !formState.isValid || formState.isValidating
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailFormInput = useMemo(() => {
    if (!isReady) {
      return {}
    }

    return form.register('email')
  }, [form, isReady])
  const loginSubmit = useLoginSubmit()

  const onSubmit = async (data: Auth.LoginForm) => {
    setIsSubmitting(true)

    try {
      await loginSubmit({
        data,
        onSuccess: () => {
          if (onSuccess) onSuccess()
        },
        onError: (error) => {
          form.setError('root', { message: error.message })
          if (onFailure) onFailure(error)
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full flex flex-col space-y-5">
      {titleVisible && (
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t('auth.login-title', { name })}</h1>
        </div>
      )}

      <m.div
        variants={ContentTransition}
        className="flex flex-col gap-y-4 w-full"
        onAnimationComplete={() => setIsReady(true)}
      >
        <form className="flex flex-col gap-y-4 w-full" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-y-1.5 w-full">
            <div className="relative">
              <Input
                className="w-full h-12 px-3 rounded-lg border border-gray-200 focus-visible:ring-1 focus-visible:ring-offset-0"
                placeholder={t('auth.email-placeholder')}
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={!!formState.errors?.email}
                aria-describedby={formState.errors?.email ? 'email-error' : undefined}
                {...emailFormInput}
              />
              {email && !formState.errors?.email && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                  <i className="i-lucide-check w-4 h-4" />
                </div>
              )}
            </div>

            {formState.errors?.root && (
              <m.p
                id="root-error"
                layout
                variants={{
                  visible: { opacity: 1, y: 0 },
                  hide: { opacity: 0, y: 5 },
                }}
                className="text-destructive text-xs"
                role="alert"
              >
                {formState.errors?.root.message}
              </m.p>
            )}

            {formState.errors?.email && (
              <m.p
                id="email-error"
                layout
                variants={{
                  visible: { opacity: 1, y: 0 },
                  hide: { opacity: 0, y: 5 },
                }}
                className="text-destructive text-xs"
                role="alert"
              >
                {formState.errors?.email?.message?.toString()}
              </m.p>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {email && (
              <m.div
                initial={{ opacity: 0, height: 0, y: 5 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  type="submit"
                  disabled={isDisabled}
                  className="w-full h-12 rounded-lg font-medium text-sm bg-black hover:bg-gray-800 text-white"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="i-lucide-loader-2 w-3.5 h-3.5 animate-spin" />
                      {t('auth.submitting')}
                    </span>
                  ) : (
                    t('auth.submit')
                  )}
                </Button>
              </m.div>
            )}
          </AnimatePresence>
        </form>

        {providers.length > 0 && (
          <>
            <div className="relative my-3">
              <Separator className="absolute inset-0 my-auto" />
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">{t('auth.or-continue-with')}</span>
              </div>
            </div>
            <OAuthOptions providers={providers} portal={portal} onSuccess={onSuccess} onFailure={onFailure} />
          </>
        )}
      </m.div>
    </div>
  )
}

const OAuthOptions = ({
  providers,
  portal,
  onSuccess,
  onFailure,
}: {
  providers: string[]
  portal: boolean
  onSuccess?: (() => void) | undefined
  onFailure?: ((error: unknown) => void) | undefined
}) => {
  if (providers.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-2.5 w-full">
      {providers.map((p) => (
        <OAuthButton key={p} provider={p} portal={portal} onSuccess={onSuccess} onFailure={onFailure} />
      ))}
    </div>
  )
}

interface Step2props {
  name?: string | undefined
  redirect: string
  portal: boolean
}

const Step2 = ({ name, redirect, portal }: Step2props) => {
  'use no memo'

  const { t } = useTranslation()
  const toast = useToaster()
  const form = useForm({
    resolver: effectTsResolver(EmailVerificationCodeSchema),
    mode: 'onBlur',
  })
  const { formState } = form
  const isDisabled = formState.isSubmitting || !formState.isValid || formState.isValidating
  const code = form.watch('code')
  const email = useLoginFlowEmail()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const verifyEmailCodeSubmit = useVerifyEmailCodeSubmit()

  // 用于返回邮箱输入步骤
  const handleBackToEmail = () => {
    // 这里应该调用重置步骤的函数
    // 例如: resetLoginFlow()

    // 临时解决方案：刷新页面
    window.location.reload()
  }

  const onSubmit = async (data: Auth.EmailVerificationCode) => {
    setIsSubmitting(true)

    try {
      await verifyEmailCodeSubmit({
        portal,
        data,
        onSuccess: () => {
          window.location.href = redirect
        },
        onError: (error) => {
          form.setError('root', { message: error.message })
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = () => {
    setResendDisabled(true)
    setCountdown(60)

    toast.success(t('auth.code-resent'), {
      position: 'top-center',
      duration: 3000,
    })
  }

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }

    if (countdown === 0 && resendDisabled) {
      setResendDisabled(false)
    }
  }, [countdown, resendDisabled])

  const codeError = formState.errors.code
  const codeInput = form.register('code')

  const isCodeComplete = () => {
    if (!code) return false
    if (typeof code === 'string') return code.length === 6
    return false
  }

  return (
    <div className="w-full flex flex-col space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{t('auth.login-title', { name })}</h1>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <p className="text-sm text-secondary-foreground inline">{t('auth.email-sent', { email })}</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-blue-600 font-normal inline-flex"
            onClick={handleBackToEmail}
          >
            {t('auth.change-email')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t('auth.check-inbox')}</p>
      </div>

      <m.div variants={ContentTransition} className="flex flex-col gap-y-4 w-full">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-y-4 w-full">
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              containerClassName="justify-center gap-1.5"
              className="otp-input"
              onBlur={(e) => codeInput.onBlur({ target: { name: 'code', value: e.target.value }, type: 'blur' })}
              onChange={(value) => codeInput.onChange({ target: { name: 'code', value }, type: 'change' })}
              aria-invalid={!!codeError}
              aria-describedby={codeError ? 'code-error' : undefined}
            >
              <InputOTPGroup>
                {/* 使用索引加字符串作为key以避免lint警告 */}
                <InputOTPSlot
                  key="slot-0"
                  index={0}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
                <InputOTPSlot
                  key="slot-1"
                  index={1}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
                <InputOTPSlot
                  key="slot-2"
                  index={2}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
                <InputOTPSlot
                  key="slot-3"
                  index={3}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
                <InputOTPSlot
                  key="slot-4"
                  index={4}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
                <InputOTPSlot
                  key="slot-5"
                  index={5}
                  className="w-10 h-12 rounded-lg border-gray-200 text-lg focus:ring-1 focus:ring-black focus:border-black"
                />
              </InputOTPGroup>
            </InputOTP>

            {codeError && (
              <p id="code-error" className="text-destructive text-xs mt-0" role="alert">
                {codeError.message?.toString()}
              </p>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {isCodeComplete() && (
              <m.div
                initial={{ opacity: 0, height: 0, y: 5 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 rounded-lg font-medium text-sm bg-black hover:bg-gray-800 text-white"
                  disabled={isDisabled}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="i-lucide-loader-2 w-3.5 h-3.5 animate-spin" />
                      {t('auth.verifying')}
                    </span>
                  ) : (
                    t('auth.continue')
                  )}
                </Button>
              </m.div>
            )}
            {formState.errors?.root && (
              <m.p
                layout
                variants={{
                  visible: { opacity: 1, y: 0 },
                  hide: { opacity: 0, y: 5 },
                }}
                className="text-destructive text-xs"
                role="alert"
              >
                {formState.errors?.root.message}
              </m.p>
            )}
          </AnimatePresence>
        </form>

        <div className="flex flex-col">
          <Separator className="my-2" />
          <div className="flex items-center justify-center">
            <p className="text-xs text-muted-foreground">{t('auth.email-haven-received-part1')}</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pl-1 text-xs text-blue-600 font-normal"
              onClick={handleResendCode}
              disabled={resendDisabled}
            >
              {resendDisabled ? `${t('auth.resend-code')} (${countdown}s)` : t('auth.resend-code')}
            </Button>
          </div>
        </div>
      </m.div>
    </div>
  )
}
