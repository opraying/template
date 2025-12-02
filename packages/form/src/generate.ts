import * as Array from 'effect/Array'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as AST from 'effect/SchemaAST'

const FormTypeId = Symbol.for('@form:form-type-id')

const _FormConfig = Symbol.for('@form:form-config')

type HTMLInputTypeAttribute =
  | 'color'
  | 'date'
  | 'email'
  | 'file'
  | 'hidden'
  | 'number'
  | 'password'
  | 'text'
  | (string & {})

interface BaseConfig {
  title?: string
  description?: string
  orientation?: 'horizontal' | 'vertical'
  order?: number | undefined
  group?: string | undefined
}

export type FormConfig = InputConfig | BoolConfig | SelectConfig | CustomConfig

interface InputConfig extends BaseConfig {
  componentType?: 'input' | 'textarea' | undefined
  htmlType?: HTMLInputTypeAttribute | undefined
}

interface BoolConfig extends BaseConfig {
  componentType?: 'switch' | 'checkbox' | undefined
}

interface SelectConfig extends BaseConfig {
  componentType?: 'select' | 'radio' | 'checkbox' | undefined
  options?: Record<string, string | number>
}

interface CustomConfig extends BaseConfig {
  componentType?: 'custom' | undefined
  component: string
}

export const config =
  (config: Partial<FormConfig>) =>
  <S extends Schema.Annotable.All>(self: S): Schema.Annotable.Self<S> =>
    self.annotations({
      [FormTypeId]: {
        ...config,
        order: config.order ?? 0,
        group: config.group ?? '',
      },
    })

interface Restriction {
  minLength?: number | undefined
  maxLength?: number | undefined
  pattern?: string | undefined
}

const getRestriction = (astType: AST.AST): Restriction => {
  const baseRestriction: {
    minLength?: number
    maxLength?: number
    pattern?: string
  } = {}

  if (astType._tag === 'Refinement') {
    const nestedRestriction = getRestriction(astType.from)
    const jsonSchemaAnnotation = AST.getJSONSchemaAnnotation(astType).pipe(Option.getOrUndefined)

    return {
      ...nestedRestriction,
      ...jsonSchemaAnnotation,
    }
  }

  return baseRestriction
}

const getFieldType = (formConfig: FormConfig | undefined, defaultType = 'input') => {
  const t = formConfig?.componentType || defaultType

  return t || defaultType
}

const makeSwitchField = (_type: AST.AST, config: FormConfig | undefined) => {
  return {
    componentType: getFieldType(config, 'switch'),
    ...config,
  }
}

const makeSingleField = (type: AST.AST, config: SelectConfig | undefined) => {
  const getOptions = (type: AST.AST) => {
    let options: { label: string; value: string | number }[] = []

    if (type._tag === 'Enums') {
      options = Object.entries(type.enums).map(([_, [label, value]]) => {
        return {
          label,
          value,
        }
      })
    }

    if (type._tag === 'Union') {
      if (type.types.find((type) => type._tag === 'UndefinedKeyword')) {
        const firstType = type.types[0]
        const config = type.annotations[FormTypeId] as any

        const ret: any = getOptions(firstType)

        const config_ = config || firstType.annotations[FormTypeId]

        return {
          options: ret.options,
          ...config_,
        }
      }

      options = type.types.map((type) => {
        switch (type._tag) {
          case 'Literal':
            return {
              label: type.literal?.toString() || '',
              value: type.literal?.toString() || '',
            }
          default:
            throw new Error(`Unsupported type: ${type._tag}`)
        }
      })
    }

    if (config?.options) {
      options = Object.entries(config.options).map(([label, value]) => ({
        label,
        value,
      }))
    }

    return { ...config, options: options || [] }
  }

  const ret = {
    componentType: getFieldType(config, 'select'),
    ...getOptions(type),
  }

  return ret
}

const makeMultipleField = (type: AST.AST, config: SelectConfig | undefined) => {
  const getOptions = (type: AST.AST) => {
    let options: { label: string; value: string | number }[] = []

    if (type._tag === 'TupleType') {
      const item = type.rest[0].type
      if (item._tag === 'Enums') {
        options = Object.entries(item.enums).map(([_, [label, value]]) => {
          return {
            label,
            value,
          }
        })
      } else if (item._tag === 'Union') {
        options = config?.options
          ? Object.entries(config.options).map(([label, value]) => {
              return {
                label,
                value,
              }
            })
          : item.types.map((item: any) => {
              return {
                label: item.literal,
                value: item.literal,
              }
            })
      } else {
        throw new Error(`Unsupported type: ${item._tag}`)
      }
    }

    return { ...config, options }
  }
  return {
    componentType: getFieldType(config, 'checkbox'),
    ...config,
    ...getOptions(type),
  }
}

const makeDefaultField = (type: AST.AST, config: FormConfig | undefined) => {
  return {
    componentType: getFieldType(config, 'input'),
    ...config,
    htmlType: (config as InputConfig)?.htmlType || 'text',
    restriction: getRestriction(type),
  }
}

/**
 * @deprecated
 */
export const Options = <A extends Schema.EnumsDefinition>(data: A) => {
  return Schema.Enums(data)
}

const generateFormField = (type: AST.AST) => {
  const formTypeConfig = type.annotations[FormTypeId] as any

  if (formTypeConfig?.componentType === 'select' && formTypeConfig?.options) {
    return makeSingleField(type, formTypeConfig)
  }

  switch (type._tag) {
    case 'Suspend':
    case 'Declaration':
      throw new Error(`${type._tag} is not supported`)
    case 'BooleanKeyword':
      return makeSwitchField(type, formTypeConfig)
    case 'TupleType':
      return makeMultipleField(type, formTypeConfig)
    case 'Enums':
    case 'Union':
      return makeSingleField(type, formTypeConfig)
    case 'AnyKeyword':
    case 'UndefinedKeyword':
    case 'NeverKeyword':
    case 'StringKeyword':
    case 'NumberKeyword':
    case 'BigIntKeyword':
    case 'SymbolKeyword':
    case 'ObjectKeyword':
    case 'Literal':
    case 'UniqueSymbol':
    case 'VoidKeyword':
    case 'UnknownKeyword':
    case 'TemplateLiteral':
    case 'TypeLiteral':
    case 'Refinement':
    case 'Transformation':
      return makeDefaultField(type, formTypeConfig)
  }
}

type ChildField =
  | {
      id: string
      name: string
      title: string
      description: string
      componentType: 'input' | 'textarea'
      htmlType: HTMLInputTypeAttribute
      orientation: FormConfig['orientation']
      order: number
      group: string
      defaultValue: string | number | undefined
      restriction: Restriction
    }
  | {
      id: string
      name: string
      title: string
      description: string
      componentType: 'select' | 'checkbox' | 'radio'
      orientation: FormConfig['orientation']
      options: { label: string; value: any }[]
      order: number
      group: string
    }
  | {
      id: string
      name: string
      title: string
      description: string
      componentType: 'switch'
      orientation: FormConfig['orientation']
      order: number
      group: string
      defaultValue: string | number | undefined
    }
  | {
      id: string
      name: string
      title: string
      description: string
      componentType: 'custom'
      orientation: FormConfig['orientation']
      order: number
      group: string
      defaultValue: string | number | undefined
      component: string
    }

export type FormSchemaJson = Array<{
  id: string
  children: Array<ChildField>
}>

export const toJson = <A, I>(
  schema: Schema.Schema<A, I>,
  values: Partial<A> = {},
): { schemaJSON: FormSchemaJson; defaultValues: Partial<A> } => {
  // for each ast.property , collect all field and field type, description, value, ...
  const ast = schema.ast
  let results: Array<{
    id: string
    children: Array<ChildField>
  }> = []
  const defaultValues: Partial<A> = {}

  const go = (
    properties: readonly AST.PropertySignature[],
    options: {
      getDefaultValue: (name: string) => any
    },
  ) => {
    const res = properties
      .map((property) => {
        const name = property.name.toString()
        const fieldProps = generateFormField(property.type)
        const id = Math.random().toString().slice(2, 10)

        const item = {
          id,
          ...fieldProps,
          name,
          defaultValue: options.getDefaultValue(name),
        }

        defaultValues[name as keyof Partial<A>] = values[name as keyof Partial<A>] ?? item.defaultValue

        return item
      })
      .sort((a, b) => {
        if (typeof a.order === 'undefined' || typeof b.order === 'undefined') {
          return -1
        }

        // keep the order
        if (a.order === 0 && b.order === 0) {
          return 0
        }

        // order 越大，越靠前
        return b.order - a.order > 0 ? 1 : -1
      })

    results = pipe(
      Array.groupBy(res, (item) => item.group) as any,
      Object.entries,
      Array.sort((a: any, b: any) => {
        if (typeof a[0] === 'undefined' || typeof b[0] === 'undefined') {
          return -1
        }

        // sort group
        return a[0].localeCompare(b[0]) > 0 ? 1 : -1
      }),
      Object.fromEntries,
      Object.values,
      Array.map((items) => {
        return {
          id: Math.random().toString().slice(2, 10),
          children: items,
        }
      }),
    )
  }

  if (ast._tag === 'TypeLiteral') {
    go(ast.propertySignatures, {
      getDefaultValue: () => undefined,
    })

    return { schemaJSON: results, defaultValues }
  }

  if (ast._tag === 'Transformation') {
    const to = ast.to
    const transformation = ast.transformation as AST.TypeLiteralTransformation
    const transforms = transformation.propertySignatureTransformations

    const getDefaultValue = (name: string): any => {
      const item = transforms.find((transform) => transform.from === name)

      if (item) {
        return item.decode(Option.none()).pipe(Option.getOrUndefined)
      }

      return undefined
    }

    if (to._tag === 'TypeLiteral') {
      go(to.propertySignatures, {
        getDefaultValue,
      })
    }

    return { schemaJSON: results, defaultValues }
  }

  throw new Error(`Unexpected AST, ast: ${ast._tag}`)
}

export const LiteralToOptionsRecord = <A extends readonly [string, ...string[]]>(
  prefix: string,
  schema: Schema.Literal<A>,
) => Object.fromEntries(schema.literals.map((literal) => [`${prefix}.${literal}`, literal]))
