import { standardSchemaResolver } from '@xstack/form/resolver'
import { defaultRegistry, useAtomMount, useAtomSet, useAtomSuspense, Atom, Result } from '@xstack/atom-react'
import * as Effect from 'effect/Effect'
import * as Equal from 'effect/Equal'
import { pipe } from 'effect/Function'
import { globalValue } from 'effect/GlobalValue'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import type { Simplify } from 'effect/Types'
import * as React from 'react'
import { type FieldValues, type UseFormReturn, useForm } from 'react-hook-form'
import * as R from 'remeda'
import { useLazyRef } from '@/lib/hooks/use-lazy-ref'

/**
 * Represents form submission data with values and changed fields
 */
export interface FormSubmitData<A> {
  values: A
  changed: Partial<A>
}

export type ReadOrWriteAtomParams<A> = Option.Option<FormSubmitData<A>>

export type ReadOrWriteAtomFn<A, _I = A, E = never> = Atom.AtomResultFn<
  Option.Option<Simplify<FormSubmitData<A>>>,
  A,
  E
>

export type ReadOrWriteEffect<A, I = A, E = never, R = never> = (
  input: Option.Option<FormSubmitData<A>>,
  schema: Schema.Schema<A, I>,
) => Effect.Effect<A, E, R>

export type ReadOrWritePromise<A, I = A> = (
  input: Option.Option<FormSubmitData<A>>,
  schema: Schema.Schema<A, I>,
) => Promise<A>

export type ReadOrWrite<A, I = A, E = never, R = never> =
  | ReadOrWriteEffect<A, I, E, R>
  | ReadOrWriteAtomFn<A, I, E>
  | ReadOrWritePromise<A, I>

// Track which schemas have been processed to avoid duplicate processing
const processingWeakSet = globalValue('form-processing-weak-set', () => new WeakSet<any>())

// Cache successful results to prevent re-fetching
const successfullyWeakMap = globalValue('form-successfully-weak-map', () => new WeakMap<any, any>())

// Create a writable Atom for form data with schema validation
const makeWriteableAtom: {
  /**
   * effect writeable
   */
  <A, I, E = never>(
    schema: Schema.Schema<A, I>,
    readOrWriteFn: ReadOrWriteEffect<A, I, E>,
  ): Atom.Writable<Result.Result<A, E>, typeof Atom.Reset | Option.Option<FormSubmitData<A>>>
  /**
   * rx writable
   */
  <A, I, E = never>(
    schema: Schema.Schema<A, I>,
    rx: Atom.AtomResultFn<A, A, E>,
  ): Atom.Writable<Result.Result<A, E>, typeof Atom.Reset | Option.Option<FormSubmitData<A>>>
  /**
   * promise writable
   */
  <A, I, E = never>(
    schema: Schema.Schema<A, I>,
    readOrWriteFn: ReadOrWritePromise<A, I>,
  ): Atom.Writable<Result.Result<A, E>, typeof Atom.Reset | Option.Option<FormSubmitData<A>>>
} = <A, I, E = never>(
  schema: Schema.Schema<A, I>,
  readOrWriteFn: any,
): Atom.Writable<Result.Result<A, E>, typeof Atom.Reset | Option.Option<FormSubmitData<A>>> => {
  // Convert the provided function to an Atom function
  const atomFn =
    typeof readOrWriteFn === 'function'
      ? Atom.fn((input: Option.Option<FormSubmitData<A>>) => {
          const fn = (readOrWriteFn as ReadOrWritePromise<A, I> | ReadOrWriteEffect<A, I, E>)(input, schema)

          if (Effect.isEffect(fn)) {
            return fn
          }

          return Effect.promise(() => fn)
        })
      : (readOrWriteFn as ReadOrWriteAtomFn<A, I, E>)

  // Flag to track first successful result
  let hasProcessedSuccessfully = false

  // If it is successful, it is not allowed to return to the initial state again
  // because suspense will throw and cause rx to be re-mounted
  const rx = pipe(
    atomFn,
    Atom.map((result) => {
      // Return cached result if available and we've already processed once
      if (successfullyWeakMap.has(schema)) {
        const cachedResult = successfullyWeakMap.get(schema) as typeof result

        if (hasProcessedSuccessfully) {
          hasProcessedSuccessfully = false
          return cachedResult
        }

        return result
      }

      // Cache successful results
      if (result._tag === 'Success') {
        successfullyWeakMap.set(schema, result)
        hasProcessedSuccessfully = true
        return result
      }

      return result
    }),
  )

  // Avoid duplicate processing of the same schema
  if (processingWeakSet.has(schema)) {
    return rx
  }

  // Mark schema as processed
  processingWeakSet.add(schema)

  // Register rx with default initial value of Option.none()
  defaultRegistry.set(rx, Option.none())

  return rx
}

export interface SchemaForm<A extends FieldValues, I = A> {
  schema: Schema.Schema<A, I, never>
  form: UseFormReturn<A>
  resolver: ReturnType<typeof standardSchemaResolver>
  values: A
  onSubmit: (values: A) => Promise<void> | void
}

/**
 * Basic hook that creates form props with schema validation
 *
 * @param schema - The schema to validate against
 * @param readOrWrite - Function to read or write data
 * @returns Form props with schema, values, and onSubmit handler
 */
export const useSchemaForm: {
  /**
   * form schema (effect)
   */
  <A extends FieldValues, I = A, E = never>(
    schema: Schema.Schema<A, I>,
    readOrWrite: ReadOrWriteEffect<A, I, E>,
  ): Simplify<SchemaForm<A, I>>
  /**
   * form schema (rx)
   */
  <A extends FieldValues, I = A, E = never>(
    schema: Schema.Schema<A, I>,
    readOrWrite: ReadOrWriteAtomFn<A, I, E>,
  ): Simplify<SchemaForm<A, I>>
  /**
   * form schema (promise)
   */
  <A extends FieldValues, I = A, _E = never>(
    schema: Schema.Schema<A, I>,
    readOrWrite: ReadOrWritePromise<A, I>,
  ): Simplify<SchemaForm<A, I>>
} = <A extends FieldValues, I = A, _E = never>(
  schema: Schema.Schema<A, I>,
  readOrWrite: any,
): Simplify<SchemaForm<A, I>> => {
  const writeableAtom = useLazyRef(() => makeWriteableAtom(schema, readOrWrite))
  const { value: values } = useAtomSuspense(writeableAtom.current)
  const setValues = useAtomSet(writeableAtom.current)
  const valueRef = React.useRef(values)

  const resolver = React.useMemo(() => standardSchemaResolver(Schema.standardSchemaV1(schema) as any), [schema])

  const form = useForm({
    resolver,
    defaultValues: values,
    values: values as any,
    shouldUseNativeValidation: false,
  })

  // Clean up cache when component unmounts
  React.useEffect(() => {
    return () => {
      processingWeakSet.delete(schema)
      successfullyWeakMap.delete(schema)
    }
  }, [schema])

  return React.useMemo(
    () => ({
      schema,
      form,
      resolver,
      values,
      onSubmit: (values: A) => {
        const prevValues = valueRef.current as Record<string, any>
        const newValuesRecord = values as Record<string, any>

        setValues(() => {
          const changed = {} as Record<string, any>

          // Detect changed fields by comparing old and new values
          Object.keys(newValuesRecord).forEach((key) => {
            if (!Equal.equals(prevValues[key], newValuesRecord[key])) {
              changed[key] = newValuesRecord[key]
            }
          })

          return Option.some({
            values,
            changed: changed as Partial<A>,
          })
        })

        // Update reference to current values
        valueRef.current = values
      },
    }),
    [schema, form, resolver, values, setValues],
  )
}

// ----- Streaming Schema Form -----

/**
 * Interface for extended form props with react-hook-form integration
 */
export interface StreamingSchemaForm<A extends FieldValues, I = A> {
  schema: Schema.Schema<A, I, never>
  form: UseFormReturn<A>
  resolver: ReturnType<typeof standardSchemaResolver>
  values: A
  onSubmit: (values: A) => Promise<void> | void
}

/**
 * Interface for read/write operations with streaming
 */
export interface ReactiveServiceBinding<A, _I = A, E = never> {
  /** Reactive read operation that returns the current value */
  read: Atom.Atom<Result.Result<A, E>>
  /** Reactive write operation that updates the value */
  write: Atom.Writable<any, any>
  /** Creates a stream that emits when values change based on a predicate */
  stream: (predicate: (value: A) => boolean) => Atom.Atom<void>
}

/**
 * Enhanced hook for schema form with react-hook-form integration and streaming updates
 * Connects a service-provided reactive binding to a form with streaming updates
 *
 * @param schema - The schema to validate against
 * @param serviceBinding - Object with read, write, and stream functions from a service
 * @returns Extended form props with react-hook-form integration
 */
export function useStreamingSchemaForm<A extends FieldValues, I = A, E = never>(
  schema: Schema.Schema<A, I>,
  serviceBinding: ReactiveServiceBinding<A, I, E>,
): Simplify<StreamingSchemaForm<A, I>> {
  const { value: values } = useAtomSuspense(serviceBinding.read)
  const valueRef = React.useRef(values)
  const setValues = useAtomSet(serviceBinding.write)

  const resolver = React.useMemo(() => standardSchemaResolver(Schema.standardSchemaV1(schema) as any), [schema])

  const form = useForm({
    resolver,
    defaultValues: values,
    values,
    shouldUseNativeValidation: false,
  })

  const changesStream = React.useMemo(
    () =>
      serviceBinding.stream((results) => {
        if (R.isDeepEqual(valueRef.current, results)) {
          return false
        }

        valueRef.current = results
        return true
      }),
    [serviceBinding.stream],
  )

  // Mount the changes stream
  useAtomMount(changesStream)

  return React.useMemo(
    () => ({
      schema,
      form,
      resolver,
      values,
      onSubmit: (values: A) => {
        const prevValuesRecord = valueRef.current as Record<string, any>
        const newValuesRecord = values as Record<string, any>

        // Skip if no changes
        if (R.isDeepEqual(prevValuesRecord, newValuesRecord)) {
          return
        }

        setValues(() => {
          const changed = {} as Record<string, any>

          // Detect changed fields by comparing old and new values
          Object.keys(newValuesRecord).forEach((key) => {
            if (!Equal.equals(prevValuesRecord[key], newValuesRecord[key])) {
              changed[key] = newValuesRecord[key]
            }
          })

          return {
            values,
            changed: changed as Partial<A>,
          }
        })

        // Update reference to current values
        valueRef.current = values
      },
    }),
    [schema, form, resolver, values, setValues],
  )
}
