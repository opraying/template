import { Emailer } from '@xstack/server/emailer'
import {
  decodeEmailMessage,
  decodeTemplateEmailMessage,
  type EmailMessageEncoded,
  EmailSendError,
  type EmailSendOptionsEncoded,
} from '@xstack/server/emailer/schema'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'

// TODO 将 emailer 改成依赖 layer 注入，避免泄露抽象
export class EmailTemplates<T extends Record<string, Schema.Schema.AnyNoContext>> {
  private readonly schemas: T
  constructor(schemas: T) {
    this.schemas = schemas
  }

  public send = (message: EmailMessageEncoded) =>
    decodeEmailMessage(message).pipe(Effect.flatMap((data) => Effect.flatMap(Emailer, (client) => client.send(data))))

  template = <K extends keyof T>(
    template: K extends string ? K : never,
    options: EmailSendOptionsEncoded,
    variables: T[K]['Type'],
  ) =>
    pipe(
      this.schemas[template]
        ? Schema.encodeUnknown(this.schemas[template])(variables)
        : Effect.dieMessage('template schema not found'),
      Effect.flatMap((_) => decodeTemplateEmailMessage({ options, variables: _ })),
      Effect.flatMap((data) => Effect.flatMap(Emailer, (client) => client.sendTemplate(template, data))),
      Effect.catchTag(
        'ParseError',
        (error) => new EmailSendError({ message: 'email template variable parse failed', cause: error }),
      ),
    )
}

type ExcludeUndefined<A> = Exclude<A, undefined>

type Maskify<K, T> =
  ExcludeUndefined<T> extends object
    ? {
        [key in keyof T]-?: ExcludeUndefined<
          Maskify<`${K extends string ? K : never}_${key extends string ? key : never}`, T[key]>
        >
      }
    : `{{${K extends string ? ExcludeUndefined<K> : never}}}`

export const getDefaultProps = <T extends Schema.Schema.AnyNoContext>(
  schema: T,
  parent?: string,
): {
  [key in keyof T['Encoded']]-?: ExcludeUndefined<Maskify<key, T['Encoded'][key]>>
} =>
  schema.ast._tag === 'TypeLiteral'
    ? schema.ast.propertySignatures.reduce((acc, item) => {
        if (typeof item.name !== 'string') return acc
        acc[item.name] = `{{${item.name}}}`

        if (item.type._tag === 'TypeLiteral') {
          acc[item.name] = getDefaultProps({ ast: item.type } as any, item.name)
        } else {
          acc[item.name] = parent ? `{{${parent}_${item.name}}}` : `{{${item.name}}}`
        }
        return acc
      }, {} as any)
    : ({} as any)
