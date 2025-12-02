import {
  type Field,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  get,
  type InternalFieldName,
  type Ref,
  type ResolverOptions,
  set,
} from 'react-hook-form'

export const toNestErrors = <TFieldValues extends FieldValues>(
  errors: FieldErrors,
  options: ResolverOptions<TFieldValues>,
): FieldErrors<TFieldValues> => {
  options.shouldUseNativeValidation && validateFieldsNatively(errors, options)

  const fieldErrors = {} as FieldErrors<TFieldValues>
  for (const path in errors) {
    const field = get(options.fields, path) as Field['_f'] | undefined
    const error = Object.assign(errors[path] || {}, {
      ref: field?.ref,
    })

    if (isNameInFieldArray(options.names || Object.keys(errors), path)) {
      const fieldArrayErrors = Object.assign({}, get(fieldErrors, path))

      set(fieldArrayErrors, 'root', error)
      set(fieldErrors, path, fieldArrayErrors)
    } else {
      set(fieldErrors, path, error)
    }
  }

  return fieldErrors
}

const isNameInFieldArray = (names: InternalFieldName[], name: InternalFieldName) =>
  names.some((n) => n.match(`^${name}\\.\\d+`))

const setCustomValidity = (ref: Ref, fieldPath: string, errors: FieldErrors) => {
  if (ref && 'reportValidity' in ref) {
    const error = get(errors, fieldPath) as FieldError | undefined
    ref.setCustomValidity(error?.message || '')

    ref.reportValidity()
  }
}

// Native validation (web only)
export const validateFieldsNatively = <TFieldValues extends FieldValues>(
  errors: FieldErrors,
  options: ResolverOptions<TFieldValues>,
): void => {
  for (const fieldPath in options.fields) {
    const field = options.fields[fieldPath]
    if (field?.ref && 'reportValidity' in field.ref) {
      setCustomValidity(field.ref, fieldPath, errors)
    } else if (field?.refs) {
      field.refs.forEach((ref: HTMLInputElement) => setCustomValidity(ref, fieldPath, errors))
    }
  }
}
