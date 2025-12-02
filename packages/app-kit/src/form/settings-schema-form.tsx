import * as Primitive from '@xstack/app-kit/settings/components/primitive'
import { makeSchemaForm, type RenderFormFields } from '@xstack/form/schema-form'
import type { ComponentType } from 'react'
import { Fragment } from 'react'
import { type Control, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

export const SettingsSchemaForm = makeSchemaForm(renderFields)

function renderFields({ schemaJSON, groups, register, components, control, skipFirstGroup }: RenderFormFields) {
  return schemaJSON.map((group: any, index: number) => {
    const groupProps = index === 0 && skipFirstGroup ? undefined : groups[index]

    return (
      <Primitive.SettingGroup key={group.id} {...groupProps}>
        {groupProps?.prefix}
        {group.children.map((item: any) => {
          const orientation =
            item.orientation ?? (['switch', 'select'].includes(item.componentType) ? 'horizontal' : 'vertical')

          const props = {
            ...register(item.name),
            title: item.title,
            description: item.description,
            orientation,
          }

          return (
            <Fragment key={item.name}>
              {item.componentType === 'input' && (
                <Primitive.Input
                  type={item.htmlType}
                  minLength={item.restriction.minLength}
                  maxLength={item.restriction.maxLength}
                  pattern={item.restriction.pattern}
                  {...props}
                />
              )}
              {item.componentType === 'textarea' && <Primitive.Textarea {...props} />}
              {item.componentType === 'checkbox' && <Primitive.CheckboxGroup {...props} options={item.options} />}
              {item.componentType === 'radio' && <Primitive.RadioGroup {...props} options={item.options} />}
              {item.componentType === 'switch' && <Primitive.Switch {...props} />}
              {item.componentType === 'select' && <Primitive.Select {...props} options={item.options} />}
              {item.componentType === 'custom' && components?.[item.component] && (
                <CustomComponent cp={components[item.component]} {...props} control={control} />
              )}
            </Fragment>
          )
        })}
        {groupProps?.suffix}
      </Primitive.SettingGroup>
    )
  })
}

function CustomComponent({
  cp: Cp,
  title,
  description,
  orientation,
  control,
  name,
  ...props
}: {
  cp: ComponentType<any>
  title: string
  name: string
  description: string
  orientation: 'horizontal' | 'vertical'
  control: Control<any>
}) {
  const { t } = useTranslation()
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Primitive.SettingItem
          title={t(title)}
          description={t(description)}
          orientation={orientation}
          error={fieldState.error?.message || ''}
        >
          <Cp
            {...props}
            value={field.value}
            onChange={(e: any) => {
              if (e.target) {
                field.onChange(e.target.value)
              } else {
                field.onChange(e)
              }
            }}
          />
        </Primitive.SettingItem>
      )}
    />
  )
}
