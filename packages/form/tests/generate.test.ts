import { describe, expect, it } from '@effect/vitest'
import * as Schema from 'effect/Schema'
import * as FG from '../src/generate'

describe('form-schema', () => {
  it('include restriction', () => {
    const Case = Schema.Struct({
      email: Schema.Any.pipe(
        Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        Schema.maxLength(20),
        Schema.minLength(3),
        FG.config({
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true }),
        Schema.withDecodingDefault(() => 'example@gmail.com'),
      ),
    })

    const { schemaJSON, defaultValues } = FG.toJson(Case)

    // console.dir(schemaJSON, { depth: null })

    expect(defaultValues).toEqual({
      email: 'example@gmail.com',
    })
  })

  it('complex case', () => {
    const Case1 = Schema.Struct({
      // Input
      input: Schema.String.pipe(
        Schema.minLength(3),
        Schema.maxLength(20),
        FG.config({
          // order: 1,
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true, default: () => 'Ray' }),
      ),
      noEmptyInput: Schema.NonEmptyString.pipe(
        FG.config({
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
      ),
      textarea: Schema.String.pipe(
        FG.config({
          componentType: 'textarea',
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true, default: () => '1' }),
      ),

      // Bool
      switch: Schema.Boolean.pipe(
        FG.config({
          // order: 2,
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true, default: () => false }),
      ),

      // Select
      select: FG.Options({
        a: 'option1',
        b: 'option2',
        c: 'option3',
      }).pipe(
        FG.config({
          // order: 3,
          title: 'settings.profile.name1',
          description: 'settings.profile.1',
          componentType: 'select',
        }),
        Schema.optionalWith({ exact: true }),
        Schema.withDefaults({
          constructor: () => 'option1' as const,
          decoding: () => 'option1' as const,
        }),
      ),
      selectLiteral: Schema.Literal('option1', 'option2', 'option3').pipe(
        FG.config({
          title: 'settings.profile.name2',
          description: 'settings.profile.2',
          componentType: 'select',
        }),
        Schema.optional,
        Schema.withDefaults({
          constructor: () => 'option1' as const,
          decoding: () => 'option1' as const,
        }),
      ),
      radio: FG.Options({
        a: 'option1',
        b: 'option2',
        c: 'option3',
      }).pipe(
        FG.config({
          componentType: 'radio',
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true, default: () => 'option1' }),
      ),

      // Multiple
      checkbox: Schema.Array(
        FG.Options({
          a: 'option1',
          b: 'option2',
          c: 'option3',
        }),
      ).pipe(
        FG.config({
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
        }),
        Schema.optionalWith({ exact: true, default: () => ['option2'] }),
      ),

      // Account & Updates

      inviteAccepted: Schema.Boolean.pipe(
        FG.config({
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
          group: 'account',
        }),
        Schema.optionalWith({ exact: true, default: () => false }),
      ),
      changelog: Schema.Boolean.pipe(
        FG.config({
          title: 'settings.profile.name',
          description: 'settings.profile.nameDesc',
          group: 'account',
        }),
        Schema.optionalWith({ exact: true, default: () => true }),
      ),
    })

    const _decoded = Schema.decodeSync(Case1)
    const _encoded = Schema.encodeSync(Case1)

    const { schemaJSON, defaultValues } = FG.toJson(Case1)

    // console.dir(schemaJSON, { depth: null })

    expect(defaultValues).toEqual({
      changelog: true,
      checkbox: ['option2'],
      input: 'Ray',
      inviteAccepted: false,
      textarea: '1',
      switch: false,
      select: 'option1',
      selectLiteral: 'option1',
      radio: 'option1',
    })
  })
})
