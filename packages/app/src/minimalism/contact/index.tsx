import { useFetcherData } from '@xstack/react-router/hooks/use-safe-response'
import { useToaster } from '@xstack/toaster'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ContactForm() {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const toast = useToaster()
  const fetcher = useFetcherData({
    onSuccess: (_result) => {
      toast.success(t('contact.form.success'))
      formRef.current?.reset()
    },
    onFailure: (error) => {
      toast.error(t('contact.form.error'))
      console.error(error)
    },
  })
  const loading = fetcher.state !== 'idle'

  return (
    <fetcher.Form ref={formRef} method="post" action="/contact">
      <div className="mx-auto max-w-screen-sm">
        <div className="flex flex-col gap-y-fl-xs">
          <div className="w-full sm:w-[50%]">
            <Label className="sr-only" htmlFor="hs-name">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder={t('contact.form.name')}
              type="text"
              className="bg-input "
              required
            />
          </div>
          <div>
            <Label className="sr-only" htmlFor="hs-email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              placeholder={t('contact.form.email')}
              type="email"
              className="bg-input"
              required
            />
          </div>
          <div>
            <Label className="sr-only" htmlFor="hs-about-contacts-1">
              Message
            </Label>
            <Textarea
              id="message"
              name="message"
              placeholder={t('contact.form.message')}
              className="max-h-[200px] bg-input "
              required
              rows={5}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center">
          <Button type="submit" disabled={loading} className="text-fl-xl">
            {loading ? t('contact.form.sending') : t('contact.form.submit')}
          </Button>
          <div className="mt-3 text-center">
            <p>{t('contact.form.date')}</p>
          </div>
        </div>
      </div>
    </fetcher.Form>
  )
}

interface ContactPageProps {}
export function ContactPage(_props: ContactPageProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-screen-md">
      <div className="flex flex-col justify-center space-y-2 mb-12">
        <p className="text-3xl text-center">You probably got many questions for us...</p>
        <p className="text-lg text-center">We are here to help you!</p>
      </div>
      <div>
        <ContactForm />
      </div>
    </div>
  )
}
