import * as FG from '@xstack/form/generate'
import { AutosaveForm, ChangesForm } from '@xstack/form/wrapper'
import type * as Schema from 'effect/Schema'
import type { Simplify } from 'effect/Types'
import { type ComponentType, type ReactNode, useMemo } from 'react'
import { type Control, type FieldErrors, type FieldValues, FormProvider, type UseFormReturn } from 'react-hook-form'

export type SchemaFormProps<A extends FieldValues, I = A> = {
  schema: Schema.Schema<A, I>
  form: UseFormReturn<A>
  autoSave?: boolean | undefined
  autoSaveWait?: number | undefined
  resolver: any
  values?: Partial<A> | undefined
  // TODO: refactor to exit data type
  onSubmit: (values: A) => Promise<void> | void
  children?: ReactNode
}

export function SchemaForm<
  S extends Schema.Schema.AnyNoContext,
  A extends FieldValues = Schema.Schema.Type<S>,
  I = Schema.Schema.Encoded<S>,
>({ schema: _schema, onSubmit, autoSave, autoSaveWait, form, resolver, children }: Simplify<SchemaFormProps<A, I>>) {
  if (autoSave) {
    /**
     * Copy from react-hook-form
     * @link https://github.com/react-hook-form/react-hook-form/blob/b5863b46346416972c025f4b621cb624ffc4a955/src/logic/createFormControl.ts#L1154
     */
    const onAutoSave = async (data: A) => {
      form.control._subjects.state.next({
        isSubmitting: true,
      })

      let errors: FieldErrors<A> = {}
      let hasError = false

      const result = await resolver(
        data as any,
        {},
        { fields: form.control._fields as any, shouldUseNativeValidation: false },
      )

      if (result.errors && Object.keys(result.errors).length > 0) {
        errors = result.errors
        hasError = true
      }

      let onSubmitError: Error | undefined
      if (!hasError) {
        form.control._subjects.state.next({
          errors: {},
        })
        try {
          await onSubmit(result.values as A)
        } catch (error) {
          onSubmitError = error as Error
        }
      }

      form.control._subjects.state.next({
        isSubmitting: false,
        isSubmitted: true,
        isSubmitSuccessful: !hasError && !onSubmitError,
        submitCount: form.formState.submitCount + 1,
        errors,
      })

      if (onSubmitError) {
        throw onSubmitError
      }
    }

    return (
      <FormProvider {...form}>
        <AutosaveForm<A> onSubmit={onAutoSave} wait={autoSaveWait}>
          {children}
        </AutosaveForm>
      </FormProvider>
    )
  }

  return (
    <FormProvider {...form}>
      <ChangesForm<A> onSubmit={onSubmit}>{children}</ChangesForm>
    </FormProvider>
  )
}

export interface SchemaFormGroup {
  title?: ReactNode | undefined
  description?: ReactNode | undefined
  separator?: boolean | undefined
  prefix?: ReactNode | undefined
  suffix?: ReactNode | undefined
}

export type RenderFormFields = {
  schemaJSON: FG.FormSchemaJson
  groups: Array<SchemaFormGroup>
  skipFirstGroup?: boolean | undefined
  register: any
  components?: Record<string, ComponentType<any>> | undefined
  control: Control<any>
}

export type CustomSchemaFormProps<A extends FieldValues, I = A> = {
  schema: Schema.Schema<A, I>
  form: UseFormReturn<A>
  autoSave?: boolean | undefined
  autoSaveWait?: number | undefined
  resolver: any
  values?: Partial<A> | undefined
  // TODO: refactor to exit data type
  onSubmit: (values: A) => Promise<void> | void
  components?: Record<string, ComponentType<any>> | undefined
  groups?: Array<SchemaFormGroup>
  skipFirstGroup?: boolean | undefined
  render?: (params: RenderFormFields) => ReactNode
}

export const makeSchemaForm = (
  render: ({ schemaJSON, groups, register, components, control, skipFirstGroup }: RenderFormFields) => React.ReactNode,
) =>
  function CustomSchemaForm<
    S extends Schema.Schema.AnyNoContext,
    A extends FieldValues = Schema.Schema.Type<S>,
    I = Schema.Schema.Encoded<S>,
  >({ schema, components, groups = [], ...rest }: Simplify<CustomSchemaFormProps<A, I>>) {
    const { control, register } = rest.form

    const { schemaJSON } = useMemo(() => FG.toJson(schema, control._defaultValues as any), [schema])

    const fields = useMemo(
      () => render({ schemaJSON, groups, register, components, control: control, skipFirstGroup: rest.skipFirstGroup }),
      [schemaJSON, groups, rest.form.register, components, control],
    )

    return (
      <SchemaForm schema={schema} {...rest}>
        {fields}
      </SchemaForm>
    )
  }

export * from './use-schema-form'
