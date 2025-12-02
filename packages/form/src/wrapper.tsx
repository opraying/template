import useDebounceFn from 'ahooks/es/useDebounceFn'
import useDeepCompareEffect from 'ahooks/es/useDeepCompareEffect'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'

type onSubmit<A> = (value: A) => void

export function AutosaveForm<A>({
  onSubmit,
  wait = 300,
  children,
}: {
  onSubmit: onSubmit<A>
  wait?: number | undefined
  children: ReactNode
}) {
  // Do not use handleSubmit from hooks-form because it will trigger the form submission and change focus.
  const { control, getValues } = useFormContext()
  const watchedData = useWatch({ control })
  const initial = useRef(false)
  const debouncedSave = useDebounceFn(
    (_: any) => {
      if (!initial.current) {
        initial.current = true
        return Promise.resolve()
      }

      return handleSubmit(onSubmit as any)()
    },
    {
      wait,
      leading: false,
      trailing: true,
    },
  )

  const handleSubmit = (onValid: onSubmit<A>) => (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault()
      e.persist()
    }

    const values = getValues()

    onValid(values as A)
  }

  useDeepCompareEffect(() => {
    debouncedSave.run(watchedData)
  }, [watchedData])

  return <form onSubmit={handleSubmit(onSubmit as any)}>{children}</form>
}

// allow manual save
export function ChangesForm<A>({ onSubmit, children }: { onSubmit: onSubmit<A>; children: ReactNode }) {
  const { handleSubmit, control, reset } = useFormContext()
  const formState = useFormState({ control })

  return (
    <form onSubmit={handleSubmit(onSubmit as any)}>
      {children}
      {formState.isDirty && (
        <div className="flex justify-end gap-x-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => reset()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!formState.isValid}>
            Save
          </Button>
        </div>
      )}
    </form>
  )
}
