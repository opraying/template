import type { InvalidMnemonicError } from '@xstack/event-log/Error'
import type { Mnemonic } from '@xstack/event-log/Types'
import { shouldNeverHappen } from '@xstack/fx/effect'
import * as Dialog from '@xstack/lib/components/dialog'
import { Button } from '@xstack/lib/ui/button'
import { cn } from '@xstack/lib/utils'
import { IdentityService, LocalFirstStorageService, SyncService } from '@xstack/local-first/services'
import { useToaster } from '@xstack/toaster'
import * as Cause from 'effect/Cause'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import { AnimatePresence, m } from 'motion/react'
import * as React from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MnemonicDisplay, MnemonicImport } from './mnemonic'

// Mock data for development
const MOCK_DATA = {
  isSubscribed: false,
  currentIdentitiesCount: 1,
  maxIdentities: 3,
} as const

function _HintOverlay({ children, hint }: { children: React.ReactNode; hint: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <p className="text-xs text-muted-foreground/80 pt-1 px-1">{hint}</p>
      <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-sm text-muted-foreground px-3 py-1.5">{hint}</p>
      </div>
    </div>
  )
}

export const TechnicalDetailsDialog = Dialog.dialog(
  () => {
    const { t } = useTranslation()
    return (
      <div className="space-y-6 py-4 px-fl-xs">
        <p className="leading-relaxed text-primary">{t('sync.identity.technical.overview')}</p>
        <div className="grid gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <i className="i-lucide-hard-drive w-5 h-5" />
              <h2 className="font-medium">{t('sync.identity.technical.features.localStorage.title')}</h2>
            </div>
            <div className="pl-7 space-y-1">
              <p className=" text-muted-foreground">{t('sync.identity.technical.features.localStorage.description')}</p>
              <ul className=" text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.localStorage.benefits.offline')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.localStorage.benefits.control')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.localStorage.benefits.desktop')}
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <i className="i-lucide-shield-check w-5 h-5" />
              <h2 className="font-medium">{t('sync.identity.technical.features.encryption.title')}</h2>
            </div>
            <div className="pl-7 space-y-1">
              <p className=" text-muted-foreground">{t('sync.identity.technical.features.encryption.description')}</p>
              <ul className=" text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.encryption.benefits.local')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.encryption.benefits.transfer')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.encryption.benefits.private')}
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <i className="i-lucide-git-branch w-5 h-5" />
              <h2 className="font-medium">{t('sync.identity.technical.features.eventLog.title')}</h2>
            </div>
            <div className="pl-7 space-y-1">
              <p className=" text-muted-foreground">{t('sync.identity.technical.features.eventLog.description')}</p>
              <ul className=" text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.eventLog.benefits.history')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.eventLog.benefits.sync')}
                </li>
                <li className="flex items-start gap-2">
                  <i className="i-lucide-check w-4 h-4 text-green-500 mt-0.5" />
                  {t('sync.identity.technical.features.eventLog.benefits.integrity')}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: <Trans i18nKey="sync.identity.technical.title" />,
    styles: {
      contentClassName: 'max-w-2xl',
    },
  },
)

export const ViewMnemonicDialog = Dialog.dialog(
  () => {
    const identity = IdentityService.useAtom
    const { value: mnemonic } = identity.mnemonic.useSuspenseSuccess()

    return Option.match(mnemonic, {
      onNone: () => '',
      onSome: (mnemonic) => {
        return <MnemonicDisplay mnemonic={Redacted.value(mnemonic)} />
      },
    })
  },
  {
    title: <Trans i18nKey="sync.mnemonic.viewMnemonic" />,
    styles: { contentClassName: 'max-w-2xl' },
  },
)

export const RestoreDialog = Dialog.alertDialog(
  ({ modal, options }) => {
    const storageService = LocalFirstStorageService.useAtom
    const [importFile, setImportFile] = React.useState<File | null>(null)

    const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files[0] instanceof File) {
        setImportFile(files[0])
      }
    }

    const handleRestore = () => {
      if (!importFile) return Promise.resolve()
      return modal.hideWhenPromiseExit(storageService.import.promise(importFile))
    }

    return (
      <div className="py-4">
        <Input type="file" accept=".sqlite" onChange={handleFileSelection} />
        <button type="button" ref={options.ref} hidden onClick={handleRestore} />
      </div>
    )
  },
  {
    title: <Trans i18nKey="sync.backup.restore" />,
    ref: React.createRef<HTMLButtonElement>(),
  },
)

export const ClearDataDialog = Dialog.alertDialog(
  ({ modal, options }) => {
    const { t } = useTranslation()
    const identity = IdentityService.useAtom

    const handleClear = () => modal.hideWhenPromise(identity.clearData.promise())

    return (
      <div className="py-4">
        <button type="button" ref={options.ref} hidden onClick={handleClear} />
        <div className="flex items-center gap-2 mb-3">
          <i className="i-lucide-alert-triangle w-4 h-4 text-destructive" />
          <h3 className="font-medium text-destructive">{t('sync.clearLocalData.warning')}</h3>
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm text-muted-foreground">{t('sync.identity.advanced.reset.description')}</p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>{t('sync.identity.advanced.reset.requirements.backup')}</li>
            <li>{t('sync.identity.advanced.reset.requirements.confirm')}</li>
          </ul>
          <p className="text-sm font-medium text-destructive mt-2">{t('sync.identity.advanced.reset.warning')}</p>
        </div>
      </div>
    )
  },
  {
    title: <Trans i18nKey="sync.clearLocalData.title" />,
    ref: React.createRef<HTMLButtonElement>(),
  },
)

export const IdentityDeleteConfirmAlert = Dialog.alertDialog(
  () => {
    const { t } = useTranslation()

    return (
      <div className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <i className="i-lucide-alert-triangle w-4 h-4 text-destructive" />
          <h3 className="font-medium text-destructive">{t('sync.identity.delete.warning')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('sync.identity.delete.description')}</p>
      </div>
    )
  },
  {
    title: <Trans i18nKey="sync.identity.delete.title" />,
    ref: React.createRef<HTMLButtonElement>(),
  },
)

interface ImportConfirmAlertProps {
  onConfirm: () => void
  onCancel?: () => void
  isOverwrite?: boolean
}

export const ImportConfirmAlert = Dialog.alertDialog<ImportConfirmAlertProps>(
  ({ props }) => {
    const { t } = useTranslation()
    const { isOverwrite = false } = props

    return (
      <div className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <i className="i-lucide-alert-triangle size-4 text-destructive" />
          <h3 className="font-semibold text-destructive">
            {isOverwrite ? t('sync.identity.overwriteConfirm.title') : t('sync.identity.importConfirm.title')}
          </h3>
        </div>
        {isOverwrite ? (
          <p className="text-sm text-muted-foreground">
            <Trans
              i18nKey="sync.identity.overwriteConfirm.warning"
              components={{ strong: <strong className="text-destructive" /> }}
            />
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('sync.identity.importConfirm.description')}</p>
        )}
        <SecurityInfoList />
      </div>
    )
  },
  {
    ref: React.createRef<HTMLButtonElement>(),
  },
)

const SecurityInfoList = () => {
  const { t } = useTranslation()

  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      <li className="flex items-start gap-2">
        <span className="i-lucide-check text-base text-green-500 mt-0.5 shrink-0" />
        {t('sync.mnemonic.importInfo.backup')}
      </li>
      <li className="flex items-start gap-2">
        <span className="i-lucide-alert-triangle text-base text-yellow-500 mt-0.5 shrink-0" />
        {t('sync.mnemonic.importInfo.clear')}
      </li>
    </ul>
  )
}

// Utility functions
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatTimeAgo(date: number | Date | undefined): string {
  if (!date) return 'Never'
  const seconds = Math.floor((Date.now() - (date instanceof Date ? date.getTime() : date)) / 1000)
  if (seconds < 10) return 'Now'
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`
  return (date instanceof Date ? date : new Date(date)).toLocaleDateString()
}

// Default emoji list for quick selection
const DEFAULT_EMOJIS = ['🔑', '📱', '💻', '🏠', '🏢', '🌐', '📝', '⭐️', '🔒', '🎯', '🎨', '📚']

function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild className="emoji-picker-trigger">
        <Button
          variant="ghost"
          size="icon"
          className={cn('transition-colors p-0 rounded-full text-lg size-8 flex-shrink-0')}
        >
          {value || '🔑'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2">
        <div className="grid grid-cols-6 gap-1">
          {DEFAULT_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg hover:bg-accent hover:text-accent-foreground"
              onClick={() => onChange(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface IdentityLabelEditorProps {
  note: string
  onSave: (newNote: string) => Promise<void> | void
  isEditingInitially?: boolean
  className?: string
}

function IdentityLabelEditor({ note, onSave, isEditingInitially = false, className }: IdentityLabelEditorProps) {
  const { t } = useTranslation()
  const [initialNote, setInitialNote] = React.useState(note)
  const [currentEmoji, setCurrentEmoji] = React.useState('🔑')
  const [currentName, setCurrentName] = React.useState('')
  const [isEditing, setIsEditing] = React.useState(isEditingInitially)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const splitNoteInternal = (n: string) => {
    const [name = '', emoji = '🔑'] = n.split(';')
    const validEmoji = emoji.trim().length === 1 || /\p{Emoji}/u.test(emoji.trim()) ? emoji.trim() : '🔑'
    return { name: name.trim(), emoji: validEmoji }
  }

  const combineNoteInternal = (name: string, emoji: string) => {
    return `${name.trim()};${emoji.trim()}`
  }

  React.useEffect(() => {
    const { name, emoji } = splitNoteInternal(note)
    setCurrentName(name)
    setCurrentEmoji(emoji)
    if (!isEditing) {
      setInitialNote(note)
    }
  }, [note, isEditing, splitNoteInternal])

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleEdit = (e: React.MouseEvent | React.FocusEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleSave = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const trimmedName = currentName.trim()
    if (trimmedName === '') return

    const newNote = combineNoteInternal(trimmedName, currentEmoji)
    if (newNote !== initialNote) {
      await onSave(newNote)
    }
    setIsEditing(false)
    setInitialNote(newNote)
  }

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const { name, emoji } = splitNoteInternal(initialNote)
    setCurrentName(name)
    setCurrentEmoji(emoji)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // Helper function to determine if blur should trigger save/cancel
  const shouldIgnoreBlur = (relatedTarget: EventTarget | null): boolean => {
    if (!relatedTarget) return false // Focus lost outside window, likely should cancel/save
    if (relatedTarget === inputRef.current) return true // Focus stayed within input? Ignore.
    if ((relatedTarget as Element).closest?.('.emoji-picker-trigger')) return true
    if ((relatedTarget as Element).closest?.('.popover-content')) return true
    if ((relatedTarget as Element).closest?.('.action-buttons')) return true
    return false // Focus moved outside the component's interactive elements
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Use setTimeout to allow click events on buttons/popover to register before blur potentially cancels editing
    setTimeout(() => {
      if (!shouldIgnoreBlur(e.relatedTarget)) {
        // If focus moves outside interactive elements, proceed with save/cancel
        if (currentName.trim() === '') {
          handleCancel()
        } else {
          const newNote = combineNoteInternal(currentName.trim(), currentEmoji)
          if (newNote !== initialNote) {
            handleSave()
          } else {
            setIsEditing(false)
          }
        }
      }
    }, 0)
  }

  if (!isEditing) {
    return (
      <div
        className={cn(
          'group relative flex items-center w-full h-10 rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors duration-150',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'cursor-text',
          'appearance-none text-left',
          className,
        )}
        onClick={handleEdit}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-lg mr-2 select-none flex-shrink-0"
          aria-hidden="true"
        >
          {currentEmoji}
        </span>
        <span className="flex-1 truncate font-medium text-foreground pr-8">
          {currentName || <span className="text-muted-foreground italic">{t('sync.identity.clickToEdit')}</span>}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            'hover:text-primary hover:bg-accent transition-opacity duration-150',
          )}
          onClick={(e) => {
            e.stopPropagation()
            handleEdit(e)
          }}
          aria-label={t('sync.identity.editAction')}
          tabIndex={-1}
        >
          <span className="i-lucide-pencil text-sm" />
        </Button>
      </div>
    )
  }

  // Editing state
  return (
    <div
      className={cn(
        'group relative flex items-center w-full h-10 rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors duration-150',
        'ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        'gap-1.5',
        className,
      )}
    >
      <EmojiPicker value={currentEmoji} onChange={setCurrentEmoji} />
      <Input
        ref={inputRef}
        type="text"
        value={currentName}
        placeholder={t('sync.identity.deviceNamePlaceholder')}
        onChange={(e) => setCurrentName(e.target.value)}
        onKeyDownCapture={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          'flex-1 h-full p-0 border-none bg-transparent rounded-none outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
          'placeholder:text-muted-foreground',
        )}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 action-buttons">
        <Button
          aria-label={t('common.save')}
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
          onClick={handleSave}
          disabled={currentName.trim() === ''}
          tabIndex={0}
        >
          <span className="i-lucide-check text-base" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.cancel')}
          className="size-8 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
          onClick={handleCancel}
          tabIndex={0}
        >
          <span className="i-lucide-x text-base" />
        </Button>
      </div>
    </div>
  )
}

const IdentityItem = ({
  phrase,
  onUpdate,
  onRemove,
  onSwitch,
}: {
  phrase: any
  onUpdate: (id: string, note: string) => Promise<void>
  onRemove: (id: string) => void
  onSwitch: () => void
}) => {
  const { t } = useTranslation()
  const usedSize =
    phrase.usedStorageSize !== undefined && phrase.maxStorageSize !== undefined
      ? `${formatBytes(phrase.usedStorageSize)} / ${formatBytes(phrase.maxStorageSize)}`
      : '0'

  return (
    <div
      key={phrase.publicKey}
      className={cn(
        'group relative flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 py-2.5 rounded-lg border border-border/50 gap-fl-3xs-lg',
        'hover:bg-muted/50 transition-colors',
        'sm:gap-4',
      )}
    >
      <div className="flex items-center gap-2 flex-grow min-w-0">
        <IdentityLabelEditor
          note={phrase.note}
          onSave={(newNote) => onUpdate(phrase.publicKey, newNote)}
          className="flex-grow"
        />
      </div>
      <div className="flex items-center justify-end gap-2.5 ml-auto sm:ml-0 shrink-0 mt-2 sm:mt-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground/80 whitespace-nowrap space-x-2 cursor-default">
              <span>{usedSize}</span>
              <span>{formatTimeAgo(phrase.lastSyncedAt)}</span>
            </p>
          </TooltipTrigger>
          <TooltipContent>{t('sync.identities.lastSynced')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => {
                IdentityDeleteConfirmAlert.open({
                  title: t('sync.identity.delete.title'),
                  onConfirm: () => {
                    onRemove(phrase.publicKey)
                  },
                })
              }}
            >
              <span className="i-lucide-trash-2 text-base" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sync.identities.remove')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onSwitch()}
            >
              <span className="i-lucide-repeat text-base" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('sync.identities.switchToImport')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

const CurrentIdentitySection = ({ onSwitch }: { onSwitch: () => void }) => {
  const { t } = useTranslation()
  const sync = SyncService.useAtom
  const { value: publicKeys } = sync.publicKeys.useSuspenseSuccess()
  const { items, publicKey: selected } = publicKeys

  const currentItem = items.find((_) => _.publicKey === selected)
  const otherItems = items
    .filter((_) => _.publicKey !== selected)
    .sort((a, b) => (b.lastSyncedAt?.getTime() ?? 0) - (a.lastSyncedAt?.getTime() ?? 0)) // Sort others by last sync time

  const handleUpdate = (id: string, note: string) =>
    sync.updatePublicKey.promise({ publicKey: id, note }).then(() => {})

  const handleRemove = (id: string) => sync.deletePublicKey(id)

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        {currentItem && (
          <div>
            <h4 className="flex items-center gap-2 text-base font-semibold mb-2 px-1">
              <span className="i-lucide-user-check size-4" />
              {t('sync.identities.current')}
            </h4>
            <div className="bg-accent/50 rounded-lg p-2 border border-accent/30">
              <IdentityLabelEditor
                note={currentItem.note}
                onSave={(_) => {
                  handleUpdate(currentItem.publicKey, _)
                }}
                className="w-full"
              />
            </div>
          </div>
        )}
        {otherItems.length > 0 && (
          <div className="mt-4">
            <h4 className="flex items-center gap-2 text-base font-semibold mb-2 px-1">
              <span className="i-lucide-users size-4" />
              {t('sync.identities.others')}
            </h4>
            <div className="flex flex-col gap-2">
              {otherItems.map((phrase) => (
                <IdentityItem
                  key={phrase.publicKey}
                  phrase={phrase}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onSwitch={onSwitch}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

function GenerateIdentity({
  onImport,
  onSuccess,
  hintText,
  willOverwrite,
}: {
  onImport: (
    value: Redacted.Redacted<Mnemonic>,
    data: { note: string },
  ) => Promise<Exit.Exit<void, InvalidMnemonicError>>
  onSuccess: () => void
  hintText: string
  willOverwrite: boolean
}) {
  const { t } = useTranslation()
  const toast = useToaster()
  const identity = IdentityService.useAtom
  const [value, setValue] = React.useState<Redacted.Redacted<Mnemonic> | null>(null)
  const [newIdentityNote, setNewIdentityNote] = React.useState<string>('My New Device;🔑')

  const generateMnemonic = () => {
    identity.randomMnemonic.promise().then(
      Exit.match({
        onFailure: () => shouldNeverHappen('Failed to generate mnemonic'),
        onSuccess: (value) => setValue(value),
      }),
    )
  }

  const handleSubmit = () => {
    if (!value) return
    ImportConfirmAlert.open({
      isOverwrite: willOverwrite,
      onConfirm() {
        onImport(value, { note: newIdentityNote }).then(
          Exit.match({
            onSuccess: () => {
              setValue(null)
              onSuccess()
            },
            onFailure: (cause) => Cause.squashWith(cause, (_) => toast.error(_.message)),
          }),
        )
      },
    })
  }

  return (
    <div className="space-y-3 pb-2">
      {!value ? (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-fl-3xs-lg border border-dashed rounded-lg p-3">
          <IdentityLabelEditor note={newIdentityNote} onSave={setNewIdentityNote} className="flex-grow" />
          <Button className="min-w-[160px] sm:min-w-[180px]" onClick={generateMnemonic}>
            {t('misc.confirm')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-3 relative overflow-hidden">
          <IdentityLabelEditor
            note={newIdentityNote}
            onSave={setNewIdentityNote}
            isEditingInitially={true}
            className="w-full"
          />
          <AnimatePresence mode="wait">
            {value && (
              <m.div
                key="mnemonic-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex flex-col gap-4"
              >
                <MnemonicDisplay
                  mnemonic={Redacted.value(value)}
                  defaultVisible
                  hide={false}
                  tips={false}
                  handleRandom={generateMnemonic}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setValue(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="button" onClick={handleSubmit}>
                    {t('common.confirmAndSave')}
                  </Button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function ImportIdentitySection({
  ref,
  onSubmit,
  hintText,
  willOverwrite,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: (mnemonic: Redacted.Redacted<string>) => Promise<Exit.Exit<void, InvalidMnemonicError>>
  hintText: string
  willOverwrite: boolean
}) {
  const { t } = useTranslation()

  const handleSubmit = (mnemonic: Redacted.Redacted<string>) =>
    new Promise<Exit.Exit<void, InvalidMnemonicError>>((resolve) => {
      ImportConfirmAlert.open({
        isOverwrite: willOverwrite,
        onCancel() {
          resolve(Exit.void)
        },
        onConfirm() {
          onSubmit(mnemonic).then(resolve)
        },
      })
    })

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="i-lucide-import size-4" />
        {t('sync.identity.setup.import.title')}
      </h3>
      <p className="text-sm text-muted-foreground -mt-1 mb-1">{t('sync.identity.setup.import.description')}</p>
      <MnemonicImport ref={ref} onSubmit={handleSubmit} />
    </div>
  )
}

export const SetupMnemonicDialog = Dialog.dialog(
  ({ modal }) => {
    const { t } = useTranslation()
    const toast = useToaster()
    const identity = IdentityService.useAtom
    const ref = React.useRef<HTMLTextAreaElement | null>(null)

    const isSubscribed = MOCK_DATA.isSubscribed
    const currentIdentitiesCount = MOCK_DATA.currentIdentitiesCount
    const maxIdentities = MOCK_DATA.maxIdentities
    const canAddNew = currentIdentitiesCount < maxIdentities
    // If the user is not subscribed or the limit is reached, we can overwrite the existing identity
    const willOverwrite = !isSubscribed || !canAddNew
    const hintText1 = !isSubscribed
      ? t('sync.identity.limitInfo', {
          current: currentIdentitiesCount,
          max: maxIdentities,
        })
      : ''
    const hintText2 = !canAddNew
      ? t('sync.identity.limitInfo', {
          current: currentIdentitiesCount,
          max: maxIdentities,
        })
      : ''

    const handleImport = (mnemonic: Redacted.Redacted<string>, data?: { note: string } | undefined) =>
      identity.importMnemonic.promise({
        mnemonic,
        data,
      })

    const handleSwitchToImport = () => {
      ref.current?.focus()
    }

    const handleImportSuccess = () => {
      modal.hide()
      toast.success(t('sync.identity.importSuccess'))
    }

    return (
      <div className="flex flex-col gap-0 px-0 py-0 flex-grow">
        <div className="px-4 py-2">
          <CurrentIdentitySection onSwitch={handleSwitchToImport} />
        </div>
        <div className="p-4 border-b">
          <GenerateIdentity
            onImport={handleImport}
            onSuccess={handleImportSuccess}
            hintText={hintText1}
            willOverwrite={willOverwrite}
          />
        </div>
        <div className="p-4">
          <ImportIdentitySection ref={ref} onSubmit={handleImport} hintText={hintText2} willOverwrite={willOverwrite} />
        </div>
      </div>
    )
  },
  {
    title: <Trans i18nKey="sync.identity.setup.title" />,
    ref: React.createRef<HTMLFormElement>(),
    styles: {
      contentClassName: 'max-w-2xl',
    },
  },
)
