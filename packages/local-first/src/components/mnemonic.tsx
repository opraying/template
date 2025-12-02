import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InvalidMnemonicError } from '@xstack/event-log/Error'
import { makeFormErrors } from '@xstack/form/errors'
import { standardSchemaResolver } from '@xstack/form/resolver'
import { Textarea } from '@xstack/lib/ui/textarea'
import { useToaster } from '@xstack/toaster'
import * as Exit from 'effect/Exit'
import { identity } from 'effect/Function'
import * as Match from 'effect/Match'
import * as ParseResult from 'effect/ParseResult'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import { useImperativeHandle, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

export function MnemonicDisplay({
  mnemonic,
  defaultVisible = false,
  handleRandom,
  hide = true,
  tips = true,
}: {
  mnemonic: string
  defaultVisible?: boolean
  handleRandom?: () => void
  hide?: boolean
  tips?: boolean
}) {
  const [isBlurred, setIsBlurred] = useState(() => !defaultVisible)
  const [showCopied, setShowCopied] = useState(false)
  const { t } = useTranslation()

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }

  const words = mnemonic.split(' ')
  const firstRow = words.slice(0, 6)
  const secondRow = words.slice(6, 12)

  return (
    <div className="flex flex-col gap-y-4">
      <div className="rounded-lg border bg-card overflow-hidden relative">
        {isBlurred && (
          <div className="absolute rounded-lg inset-0 z-10 backdrop-blur bg-background/50 flex items-center justify-center">
            <Button
              variant="outline"
              className="flex items-center gap-2 shadow-sm hover:shadow"
              onClick={() => setIsBlurred(false)}
            >
              <span className="i-lucide-eye text-base" />
              {t('sync.mnemonic.display.show')}
            </Button>
          </div>
        )}
        <div className="px-3 py-4 flex flex-col gap-4 bg-muted/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {firstRow.map((word, index) => (
              <div key={index} className="relative group">
                <div className="font-mono bg-background rounded-md px-2 py-2 text-sm border">
                  <span className="block text-center">{word}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {secondRow.map((word, index) => (
              <div key={index} className="relative group">
                <div className="font-mono bg-background rounded-md px-2 py-2 text-sm border">
                  <span className="block text-center">{word}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 flex items-center justify-between border-t bg-background/50">
          {!isBlurred && hide ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setIsBlurred(true)}
            >
              <span className="i-lucide-eye-off text-base" />
              {t('sync.mnemonic.display.hide')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {handleRandom && (
              <Button variant="outline" size="sm" onClick={handleRandom}>
                <i className="i-lucide-refresh-cw text-base" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex items-center gap-1.5 ml-auto',
                showCopied && 'text-green-500 border-green-500/20 bg-green-500/10',
              )}
              onClick={handleCopy}
            >
              {showCopied ? (
                <>
                  <span className="i-lucide-check text-base" />
                  {t('sync.mnemonic.display.copied')}
                </>
              ) : (
                <>
                  <span className="i-lucide-copy text-base" />
                  {t('sync.mnemonic.display.copy')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {tips && (
        <Alert>
          <AlertTitle icon={<i className="i-lucide-key w-5 h-5 text-warning" />}>
            {t('sync.identity.technical.mnemonic.title')}
          </AlertTitle>
          <AlertDescription>
            {t('sync.identity.technical.mnemonic.description')}
            <ul className="space-y-2 text-sm text-muted-foreground pt-3">
              <li className="flex items-start gap-2">
                <span className="i-lucide-check text-base text-green-500 mt-0.5 shrink-0" />
                {t('sync.mnemonic.security.store')}
              </li>
              <li className="flex items-start gap-2">
                <span className="i-lucide-check text-base text-green-500 mt-0.5 shrink-0" />
                {t('sync.mnemonic.security.backup')}
              </li>
              <li className="flex items-start gap-2">
                <span className="i-lucide-x text-base text-destructive mt-0.5 shrink-0" />
                {t('sync.mnemonic.security.share')}
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

class MnemonicImportSchema extends Schema.Struct({
  mnemonic: Schema.NonEmptyString.pipe(Schema.annotations({ message: () => 'mnemonic input is required' })),
}) {
  static get standardResolver() {
    return standardSchemaResolver(Schema.standardSchemaV1(MnemonicImportSchema))
  }
}

export const MnemonicImport: React.FC<{
  ref: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: (mnemonic: Redacted.Redacted<string>) => Promise<Exit.Exit<void, InvalidMnemonicError>>
}> = ({ ref, onSubmit }) => {
  const { t } = useTranslation()
  const toast = useToaster()
  const form = useForm<typeof MnemonicImportSchema.Type>({
    resolver: MnemonicImportSchema.standardResolver,
  })
  const { errors } = form.formState

  useImperativeHandle(ref, () => {
    return {
      focus: () => form.setFocus('mnemonic'),
    } as any
  })

  const handleSubmit = ({ mnemonic }: typeof MnemonicImportSchema.Type) =>
    onSubmit(Redacted.make(mnemonic)).then(
      Exit.match({
        onSuccess: identity,
        onFailure: (cause) =>
          Match.value(cause).pipe(
            Match.tag('Die', ({ defect }) => {
              toast.error((defect as any).message)
            }),
            Match.tag('Fail', (cause) =>
              Match.value(cause.error).pipe(
                Match.tag('InvalidMnemonicError', (error) =>
                  makeFormErrors({
                    mnemonic: new ParseResult.Unexpected(mnemonic, error.message),
                  }),
                ),
                Match.exhaustive,
                (errors) => form.control._setErrors(errors),
              ),
            ),
            Match.orElseAbsurd,
          ),
      }),
    )

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="flex flex-col gap-2">
        <Textarea
          {...form.register('mnemonic')}
          className="h-20 font-mono rounded-md resize-none"
          placeholder={t('sync.mnemonic.import.placeholder')}
        />

        {errors.mnemonic?.message && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center gap-2">
              <span className="i-lucide-alert-circle text-base" />
              {errors.mnemonic.message}
            </AlertDescription>
          </Alert>
        )}
        <Button type="submit">Import</Button>
      </div>
    </form>
  )
}
