import type { ReactNode } from 'react'
import { type ChangeHandler, Controller, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Checkbox as Checkbox_ } from '@/components/ui/checkbox'
import { Input as Input_ } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup as RadioGroup_, RadioGroupItem } from '@/components/ui/radio-group'
import { Select as Select_, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch as Switch_ } from '@/components/ui/switch'
import { Textarea as Textarea_ } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function SettingGroup({
  title,
  description,
  children,
  separator = true,
}: {
  title?: ReactNode | undefined
  description?: ReactNode | undefined
  children?: ReactNode | undefined
  separator?: boolean | undefined
}) {
  return (
    <div className={cn('py-fl-3xs @container', separator && 'border-b border-muted')}>
      {title && <div className="py-fl-3xs text-fl-base font-medium">{title}</div>}
      {description && <div className="pb-fl-2xs">{description}</div>}
      <div className="flex flex-col gap-y-fl-md py-fl-2xs">{children}</div>
    </div>
  )
}

interface SettingItemProps {
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  orientation?: 'horizontal' | 'vertical' | undefined
  className?: string
  autoWrap?: boolean | undefined
}

export function SettingItem({
  icon,
  title,
  description,
  orientation = 'horizontal',
  className,
  children,
  error,
  autoWrap = false,
}: React.PropsWithChildren<SettingItemProps & { error?: string }>) {
  return (
    <div
      className={cn(
        'w-full flex',
        autoWrap
          ? 'flex-col space-y-fl-2xs @xl:space-y-0 @xl:flex-row @xl:items-center @xl:justify-between'
          : 'items-center justify-between',
        orientation === 'vertical' && 'flex-col items-start space-y-fl-2xs',
      )}
    >
      <div>
        <div className="flex items-center gap-x-1.5">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {description && <div className="pt-fl-3xs text-balance text-secondary-foreground/70">{description}</div>}
      </div>
      <div className={cn(className, orientation === 'vertical' && 'w-full')}>
        {children}
        {error && <ItemError error={error} />}
      </div>
    </div>
  )
}

function ItemError({ error }: { error: string }) {
  const { t } = useTranslation()

  return <div className="mt-2 text-sm text-red-500">{t(error, { defaultValue: error })}</div>
}

export function Input({
  className,
  title,
  description,
  orientation,
  ...props
}: React.ComponentPropsWithRef<'input'> & SettingItemProps) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={props.name as string}
      control={control}
      defaultValue={props.defaultValue}
      render={({ field, fieldState }) => (
        <SettingItem
          title={t(title as string, { defaultValue: title })}
          description={t(description as string, { defaultValue: description })}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <Input_ className={cn('w-full', className)} {...field} />
        </SettingItem>
      )}
    />
  )
}

export interface RadioProps {
  options: Array<{ value: string; label: string }>
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function RadioGroup({
  options,
  name,
  defaultValue,
  title,
  description,
  orientation,
  className,
  ...props
}: React.ComponentPropsWithRef<typeof RadioGroup_> & RadioProps & SettingItemProps) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={name as string}
      control={control}
      defaultValue={defaultValue}
      render={({ field, fieldState }) => (
        <SettingItem
          title={t(title as string, { defaultValue: title })}
          description={t(description as string, { defaultValue: description })}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <RadioGroup_
            {...props}
            className={cn('w-full', className)}
            onBlur={field.onBlur}
            value={field.value}
            onValueChange={field.onChange}
          >
            {options.map((option) => {
              return (
                <Label
                  key={option.label}
                  className="flex items-center gap-x-2 rounded-md bg-input/80 p-3 hover:bg-input/95 active:bg-input/95 transition-colors"
                >
                  <RadioGroupItem value={option.value} />
                  <span>{t(option.label, { defaultValue: option.label })}</span>
                </Label>
              )
            })}
          </RadioGroup_>
        </SettingItem>
      )}
    />
  )
}

interface CheckboxGroupProps {
  options: Array<{ value: string; label: string }>
  value?: Array<string>
  name: string
}

export function CheckboxGroup({
  className,
  name,
  onChange,
  title,
  description,
  orientation,
  ...props
}: React.PropsWithChildren<CheckboxGroupProps & { className?: string; onChange?: ChangeHandler } & SettingItemProps>) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={props.value}
      render={({ field, fieldState }) => {
        const value = field.value ?? []
        const options = props.options.map((option) => {
          const checked = value?.includes(option.value)

          return (
            <Label
              key={option.value}
              className="flex items-center gap-x-2 rounded-md bg-input/80 p-3 hover:bg-input/95 active:bg-input/95 transition-colors"
            >
              <Checkbox_
                {...props}
                checked={checked}
                className={cn('', className)}
                onCheckedChange={(checked) => {
                  const newValue = checked ? [...value, option.value] : value.filter((_: any) => _ !== option.value)

                  field.onChange(newValue)
                }}
              />
              <span>{t(option.label, { defaultValue: option.label })}</span>
            </Label>
          )
        })

        return (
          <SettingItem
            title={t(title as string, { defaultValue: title })}
            description={t(description as string, { defaultValue: description })}
            orientation={orientation}
            error={fieldState.error?.message || ''}
          >
            <div className="flex flex-col gap-1.5">{options}</div>
          </SettingItem>
        )
      }}
    />
  )
}

export function Switch({
  className,
  onChange,
  title,
  description,
  orientation,
  ...props
}: React.ComponentPropsWithRef<typeof Switch_> & SettingItemProps) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={props.name as string}
      control={control}
      defaultValue={props.defaultChecked}
      render={({ field, fieldState }) => (
        <SettingItem
          title={t(title as string, { defaultValue: title })}
          description={t(description as string, { defaultValue: description })}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <Switch_
            className={cn('', className)}
            ref={field.ref}
            checked={field.value}
            disabled={props.disabled}
            onBlur={field.onBlur}
            onCheckedChange={field.onChange}
          />
        </SettingItem>
      )}
    />
  )
}

interface SelectProps {
  options: Array<{ value: string; label: string }>
  placeholder?: string
  onChange?: ChangeHandler
}

export function Select({
  placeholder,
  options,
  defaultValue,
  name,
  title,
  description,
  orientation,
  ...props
}: React.ComponentPropsWithRef<typeof Select_> & SelectProps & SettingItemProps) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={name as string}
      control={control}
      defaultValue={defaultValue}
      render={({ field, fieldState }) => (
        <SettingItem
          title={t(title as string, { defaultValue: title })}
          description={t(description as string, { defaultValue: description })}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <Select_
            {...props}
            value={field.value}
            onValueChange={(...args) => {
              field.onChange(...args)
            }}
          >
            <SelectTrigger className="min-w-32">
              <SelectValue placeholder={placeholder || 'Select'} defaultValue={defaultValue} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label, { defaultValue: option.label })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select_>
        </SettingItem>
      )}
    />
  )
}

export function Textarea({
  className,
  title,
  description,
  orientation,
  ...props
}: React.ComponentPropsWithRef<typeof Textarea_> & SettingItemProps) {
  const { t } = useTranslation()
  const { control } = useFormContext()

  return (
    <Controller
      name={props.name as string}
      control={control}
      defaultValue={props.defaultValue}
      render={({ field, fieldState }) => (
        <SettingItem
          title={t(title as string, { defaultValue: title })}
          description={t(description as string, { defaultValue: description })}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <Textarea_ className={cn('w-full', className)} {...field} />
        </SettingItem>
      )}
    />
  )
}
