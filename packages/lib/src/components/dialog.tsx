import NiceModal, { useModal } from '@ebay/nice-modal-react'
import * as Exit from 'effect/Exit'
import { globalValue } from 'effect/GlobalValue'
import type { Simplify } from 'effect/Types'
import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export * from '@/components/ui/alert-dialog'
export * from '@/components/ui/dialog'

let openDialogs: Map<
  React.FC<any>,
  {
    props: DialogProps
  }
>

// ----- DEV -----

if (import.meta.hot) {
  openDialogs = globalValue('@internal/dev-open-dialogs', () => new Map<any, { props: BaseOptions }>())

  import.meta.hot.accept(() => {
    const entries = Array.from(openDialogs)
    entries.forEach(([dialog, item]) => {
      NiceModal.remove(dialog)
      setTimeout(() => {
        NiceModal.show(dialog, item.props)
      }, 10)
    })
  })
}

// ----- BASE -----

type IsPartialRecord<T> = {
  [key in keyof T]?: T[key]
} extends T
  ? true
  : false

type OpenFunction<T> =
  IsPartialRecord<T> extends true ? (props?: Simplify<T> | undefined) => void : (props: Simplify<T>) => void

type EventHandler<T> =
  IsPartialRecord<T> extends true
    ? (props?: Simplify<T> | undefined) => {
        onClick: (event: React.MouseEvent) => void
      }
    : (props: Simplify<T>) => {
        onClick: (event: React.MouseEvent) => void
      }

const REMOVE_TIMEOUT = 200
const CLOSE_DELAY = 300

interface BaseOptions {
  id?: string | undefined
  keepMounted?: boolean | undefined
  title?: React.ReactNode
  closeOnEscapeKeyDown?: boolean | undefined
}

interface BaseProps {
  title?: React.ReactNode
  onConfirm?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}

interface HideOptions {
  closeDelay?: number | undefined
}

interface HideWhenOptions extends HideOptions {
  closeAndConfirm?: boolean | undefined
}

interface PassModal {
  id: string
  hide: (options?: HideOptions | undefined) => void
  hideWhenPromise: <A>(promise: Promise<A>, options?: HideWhenOptions | undefined) => Promise<A>
  hideWhenPromiseExit: <A, E = never>(
    promise: Promise<Exit.Exit<A, E>>,
    options?: HideWhenOptions | undefined,
  ) => Promise<Exit.Exit<A, E>>
  hideWhen: (fn?: (() => void) | undefined, options?: HideWhenOptions | undefined) => () => void
}

const make = <P1 extends BaseProps, O1 extends BaseOptions, DO1 extends O1 = O1>(
  Component: React.FC<
    React.PropsWithChildren<{
      modal: PassModal
      open: boolean
      onOpenChange: (open: boolean) => void
      options: Simplify<O1 & DO1>
      props: P1
    }>
  >,
  defaultOptions: DO1 = {} as DO1,
) =>
  function make<P = {}, O extends O1 & DO1 = DO1>(
    Content: ({
      modal,
      options,
      props,
    }: {
      modal: PassModal
      options: Simplify<O1 & O>
      props: Simplify<P1 & P>
    }) => React.ReactNode,
    options: O,
  ) {
    const mergedOptions = { ...defaultOptions, ...options }

    const dialog = NiceModal.create<P1 & P>((props) => {
      const modal = useModal()

      const onOpenChange = (opened: boolean) => {
        if (import.meta.env.DEV) {
          opened ? openDialogs.set(dialog, { props }) : openDialogs.delete(dialog)
        }

        if (opened) {
          modal.show()
        } else {
          modal.hide()
          modal.resolveHide()

          if (!options.keepMounted) {
            setTimeout(() => {
              modal.remove()
            }, REMOVE_TIMEOUT)
          }
        }
      }

      const passModal = React.useMemo(() => {
        return {
          id: modal.id,
          hide: (options?: HideOptions) => {
            setTimeout(() => {
              modal.hide()
            }, options?.closeDelay ?? 100)

            props.onCancel?.()
          },
          hideWhenPromise: <A,>(promise: Promise<A>, options?: HideWhenOptions | undefined) =>
            promise.then((value) => {
              setTimeout(() => {
                modal.hide()
              }, options?.closeDelay ?? CLOSE_DELAY)

              if (options?.closeAndConfirm) {
                props.onConfirm?.()
              }

              return value
            }),
          hideWhenPromiseExit: <A, E = never>(
            promise: Promise<Exit.Exit<A, E>>,
            options?: HideWhenOptions | undefined,
          ) =>
            promise.then((exit) =>
              Exit.map(exit, (value) => {
                setTimeout(() => {
                  modal.hide()
                }, options?.closeDelay ?? CLOSE_DELAY)

                if (options?.closeAndConfirm) {
                  props.onConfirm?.()
                }

                return value
              }),
            ),
          hideWhen: (fn?: (() => void) | undefined, options?: HideWhenOptions | undefined) => {
            return () => {
              fn?.()

              setTimeout(() => {
                modal.hide()
              }, options?.closeDelay ?? CLOSE_DELAY)

              if (options?.closeAndConfirm) {
                props.onConfirm?.()
              }
            }
          },
        }
      }, [modal, props])

      return (
        <Component
          modal={passModal}
          open={modal.visible}
          onOpenChange={onOpenChange}
          options={mergedOptions as any}
          props={props}
        >
          <Content modal={passModal} options={mergedOptions as any} props={props as any} />
        </Component>
      )
    })

    function open(props: P1 & P) {
      const args = {
        ...(props as any),
        title: props?.title ?? mergedOptions.title,
      }

      if (import.meta.env.DEV) {
        openDialogs.set(dialog, { props: args })
      }

      return NiceModal.show(dialog, args)
    }

    function hide() {
      function cleanup() {
        if (import.meta.env.DEV) {
          openDialogs.delete(dialog)
        }

        NiceModal.hide(dialog)
      }

      return cleanup()
    }

    function eventHandler(props: P1 & P) {
      return {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation()
          open(props)
        },
      }
    }

    return {
      dialog: dialog as React.FC<Simplify<P1 & P>>,
      open: open as OpenFunction<P1 & P>,
      hide,
      eventHandler: eventHandler as unknown as EventHandler<P1 & P>,
    }
  }

// ----- Dialog -----

export interface DialogOptions extends BaseOptions {
  title?: React.ReactNode
  footer?: boolean | React.ReactNode
  styles?:
    | {
        contentContainerClassName?: string
        contentClassName?: string
      }
    | undefined
}

export interface DialogProps extends BaseProps {
  title?: React.ReactNode
}

export const dialog = make<DialogProps, DialogOptions>(
  ({ open, onOpenChange, children, options, props }) => {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal>
        <DialogContent
          className={options.styles?.contentClassName}
          containerClassName={options.styles?.contentContainerClassName}
          onEscapeKeyDown={(event) => {
            if ((event.target as HTMLElement)?.tagName === 'INPUT') {
              event.preventDefault()
              return
            }
            if (options.closeOnEscapeKeyDown === false) {
              event.preventDefault()
            }
          }}
          forceMount
        >
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription className={props.title ? '' : 'hidden'} />
          </DialogHeader>
          {children}
          {typeof options.footer === 'boolean' && options.footer ? (
            <DialogFooter>
              <DialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </DialogCancel>
            </DialogFooter>
          ) : (
            options.footer
          )}
        </DialogContent>
      </Dialog>
    )
  },
  {
    title: 'Untitled Dialog',
    footer: true,
  },
)

// ----- Alert Dialog -----

export interface AlertDialogOptions extends BaseOptions {
  footer?: boolean | React.ReactNode
  styles?:
    | {
        contentContainerClassName?: string
        contentClassName?: string
      }
    | undefined
  ref?: React.RefObject<any>
}

export interface AlertDialogProps extends BaseProps {
  title?: React.ReactNode
}

export const alertDialog = make<AlertDialogProps, AlertDialogOptions>(
  ({ open, onOpenChange, children, options, props }) => {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent
          className={options.styles?.contentClassName}
          containerClassName={options.styles?.contentContainerClassName}
          onEscapeKeyDown={(event) => {
            if ((event.target as HTMLElement)?.tagName === 'INPUT') {
              event.preventDefault()
              return
            }
            if (options.closeOnEscapeKeyDown === false) {
              event.preventDefault()
            }
          }}
          forceMount
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{props.title}</AlertDialogTitle>
            <AlertDialogDescription className={props.title ? '' : 'hidden'} />
          </AlertDialogHeader>
          {children}
          {typeof options.footer === 'boolean' && options.footer ? (
            <AlertDialogFooter>
              <AlertDialogCancel asChild onClick={props.onCancel}>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction
                asChild
                onClick={(event) => {
                  if (options.ref?.current) {
                    const element = options.ref.current as HTMLElement

                    if (element.tagName === 'FORM') {
                      event.preventDefault()
                      element.dispatchEvent(new Event('submit', { cancelable: false, bubbles: true }))
                      return
                    }

                    // TODO: check more clickable element
                    const clickable = ['BUTTON', 'A']
                    if (clickable.includes(element.tagName)) {
                      event.preventDefault()
                      element.click()
                      return
                    }
                  }

                  props.onConfirm?.()
                }}
              >
                <Button>Confirm</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          ) : (
            options.footer
          )}
        </AlertDialogContent>
      </AlertDialog>
    )
  },
  {
    title: 'Untitled Alert Dialog',
    footer: true,
    ref: React.createRef(),
  },
)
