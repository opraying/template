import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { cn } from '@/lib/utils'
import * as React from 'react'
import * as R from 'remeda'

type BaseConfig<A = unknown> = {
  modal?: boolean | undefined
  config?: Partial<A>
}

interface BaseOptions<A = unknown> extends BaseConfig<A> {
  //
}

interface BaseProps<A = unknown> extends BaseConfig<A> {
  onClose?: (() => void) | undefined
  onShow?: (() => void) | undefined
  onSelect?: ((item: MenuItem) => void) | undefined
}

export type MenuItem =
  | {
      type?: 'text' | 'checkbox' | 'radio' | 'submenu' | 'link'
      label: React.ReactNode
      onClick?: () => void
      disabled?: boolean
      icon?: React.ReactNode
      shortcut?: string | undefined
      description?: string | undefined
      checked?: boolean | undefined
      inset?: boolean | undefined
      children?: MenuItem[] | undefined
      className?: string | undefined
      onHover?: (() => void) | undefined
      href?: string | undefined
    }
  | {
      type: 'separator'
    }

export interface MenuEventDetail<A = unknown> {
  id: string
  x: number
  y: number
  rect: DOMRect
  items: MenuItem[]
  options?: Partial<BaseConfig<A>> | undefined
  eventStub?: Partial<{
    onClose: (() => void) | undefined
    onShow: (() => void) | undefined
    onSelect: ((item: MenuItem) => void) | undefined
  }>
}

function makePortalProvider<A = {}>(
  Component: (
    _: React.PropsWithChildren<{
      ref: React.Ref<HTMLButtonElement>
      modal: boolean
      open: boolean
      onOpenChange: (open: boolean) => void
      config: Partial<A>
      nodes: React.ReactNode
      hydrated: boolean
    }>,
  ) => React.ReactElement,
  portal: {
    dispatchEvent: string
    triggerEvent: string
    generateMenus: (id: string, items: MenuItem[], onSelect: (item: MenuItem) => void) => React.ReactNode[]
  },
) {
  return ({ children }: React.PropsWithChildren) => {
    const ref = React.useRef<HTMLButtonElement>(null)
    const [isOpen, setIsOpen] = React.useState(false)
    const [nodes, setNodes] = React.useState<React.ReactNode>([])
    const [modal, setModal] = React.useState(false)
    const [config, setConfig] = React.useState<Partial<A>>({})
    const [eventStub, setEventStub] = React.useState<Partial<MenuEventDetail<A>['eventStub']>>({})
    const hydrated = useHydrated()

    const onOpenChange = (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        eventStub?.onClose?.()
      }
    }

    React.useEffect(() => {
      const handler = (event: CustomEvent<MenuEventDetail<A>>) => {
        const { detail } = event
        if (!detail || !Array.isArray(detail.items)) return

        const fakeElement = ref.current
        if (!fakeElement) return
        const rect = detail.rect
        fakeElement.style.left = `${rect.left}px`
        fakeElement.style.top = `${rect.top}px`
        fakeElement.style.width = `${rect.width}px`
        fakeElement.style.height = `${rect.height}px`

        requestAnimationFrame(() => {
          fakeElement.dispatchEvent(
            new MouseEvent(portal.triggerEvent, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: detail.x,
              clientY: detail.y,
            }),
          )
        })

        const { modal, config } = detail.options ?? {}

        setModal(modal ?? false)
        if (config) {
          setConfig(config)
        }
        setEventStub({
          onClose: detail.eventStub?.onClose,
          onShow: detail.eventStub?.onShow,
          onSelect: detail.eventStub?.onSelect,
        })

        const nodes = portal.generateMenus(detail.id, detail.items, (item) => detail.eventStub?.onSelect?.(item))
        setNodes(nodes)

        setIsOpen(true)

        detail.eventStub?.onShow?.()
      }

      document.addEventListener(portal.dispatchEvent, handler as EventListener)

      return () => {
        document.removeEventListener(portal.dispatchEvent, handler as EventListener)
      }
    }, [portal.dispatchEvent, portal.generateMenus, portal.triggerEvent])

    return (
      <Component
        ref={ref}
        modal={modal}
        open={isOpen}
        onOpenChange={onOpenChange}
        config={config}
        nodes={nodes}
        hydrated={hydrated}
      >
        {children}
      </Component>
    )
  }
}

const CONTEXT_MENU_SHOW_EVENT = 'CONTEXT-MENU-SHOW-EVENT'

interface ContentMenuConfig {
  alignOffset: number
  avoidCollisions: boolean
  collisionBoundary: Boundary[]
  collisionPadding: number
  sticky: 'partial' | 'always'
}

const linkProps = (href: string | undefined) => {
  if (!href) return {}

  if (href.startsWith('http')) {
    return {
      target: '_blank',
      rel: 'noopener noreferrer',
    }
  }

  return {}
}

const ContextMenuProvider = makePortalProvider<ContentMenuConfig>(
  ({ ref, modal, onOpenChange, config, nodes, children, hydrated }) => {
    return (
      <ContextMenu modal={modal} onOpenChange={onOpenChange}>
        {children}
        {hydrated && (
          <ContextMenuTrigger
            ref={ref}
            style={{
              position: 'fixed',
              pointerEvents: 'none',
              opacity: 0,
              zIndex: -1,
            }}
          />
        )}
        <ContextMenuContent {...config}>{nodes}</ContextMenuContent>
      </ContextMenu>
    )
  },
  {
    dispatchEvent: CONTEXT_MENU_SHOW_EVENT,
    triggerEvent: 'contextmenu',
    generateMenus: (id: string, items: MenuItem[], onSelect: (item: MenuItem) => void) => {
      const process = (id: string, items: MenuItem[], onSelect: (item: MenuItem) => void) =>
        items.filter(Boolean).map((item, index) => {
          if (item.type === 'separator') {
            return <ContextMenuSeparator key={id + index} />
          }

          const key = `${id}-${item.label}`
          const commonProps = {
            disabled: item.disabled ?? false,
            className: item.className,
            onMouseEnter: item.onHover,
          }

          switch (item.type ?? 'text') {
            case 'text': {
              return (
                <ContextMenuItem
                  {...commonProps}
                  key={key}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {item.icon}
                  {typeof item.label === 'string' ? (
                    <span className={item.icon ? 'pl-2' : ''}>{item.label}</span>
                  ) : (
                    item.label
                  )}
                  {item.shortcut && <span className="ml-auto text-muted-foreground">{item.shortcut}</span>}
                  {item.description && <span className="ml-2 text-muted-foreground">{item.description}</span>}
                </ContextMenuItem>
              )
            }
            case 'link': {
              return (
                <ContextMenuItem {...commonProps} key={key} asChild>
                  <a href={item.href} {...linkProps(item.href)} className="flex items-center justify-between">
                    {typeof item.label === 'string' ? (
                      <span className={item.icon ? 'pl-2' : ''}>{item.label}</span>
                    ) : (
                      item.label
                    )}
                    {item.icon}
                  </a>
                </ContextMenuItem>
              )
            }
            case 'checkbox': {
              return (
                <ContextMenuCheckboxItem
                  {...commonProps}
                  key={key}
                  defaultChecked={item.checked ?? false}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {item.label}
                </ContextMenuCheckboxItem>
              )
            }
            case 'radio': {
              return (
                <ContextMenuRadioItem
                  {...commonProps}
                  key={key}
                  defaultChecked={item.checked ?? false}
                  value={item.label!.toString()}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {item.label}
                </ContextMenuRadioItem>
              )
            }
            case 'submenu': {
              return (
                <ContextMenuSub key={key}>
                  <ContextMenuSubTrigger {...commonProps}>
                    {item.icon && <span className="mr-2 flex items-center justify-center">{item.icon}</span>}
                    {typeof item.label === 'string' ? <span>{item.label}</span> : item.label}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>{process(key, item.children || [], onSelect)}</ContextMenuSubContent>
                </ContextMenuSub>
              )
            }
            default: {
              return null
            }
          }
        })

      return process(id, items, onSelect)
    },
  },
)

const DROPDOWN_MENU_SHOW_EVENT = 'DROPDOWN-MENU-SHOW-EVENT'

interface DropdownContentConfig {
  side: Side
  sideOffset: number
  align: 'start' | 'center' | 'end'
  alignOffset: number
  avoidCollisions: boolean
  collisionBoundary: Boundary[]
  collisionPadding: number | Partial<Record<Side, number>>
  arrowPadding: number
  sticky: 'partial' | 'always'
  className?: string | undefined
}

const DropdownMenuProvider = makePortalProvider<DropdownContentConfig>(
  ({ ref, modal, open, onOpenChange, config, nodes, children, hydrated }) => {
    return (
      <DropdownMenu modal={modal} open={open} onOpenChange={onOpenChange}>
        {children}
        {hydrated && (
          <DropdownMenuTrigger
            ref={ref}
            style={{
              position: 'fixed',
              pointerEvents: 'none',
              opacity: 0,
              zIndex: -1,
            }}
          />
        )}
        <DropdownMenuContent {...config} className={cn('min-w-48', config.className)}>
          {nodes}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
  {
    dispatchEvent: DROPDOWN_MENU_SHOW_EVENT,
    triggerEvent: 'contextmenu',
    generateMenus: (id: string, items: MenuItem[], onSelect: (item: MenuItem) => void) => {
      const process = (id: string, items: MenuItem[], onSelect: (item: MenuItem) => void) =>
        items.filter(Boolean).map((item, index) => {
          if (item.type === 'separator') {
            return <DropdownMenuSeparator key={id + index} />
          }

          const key = `${id}-${item.label}`
          const commonProps = {
            disabled: item.disabled ?? false,
            className: cn('w-full', item.className),
            onMouseEnter: item.onHover,
          }

          switch (item.type ?? 'text') {
            case 'text': {
              return (
                <DropdownMenuItem
                  {...commonProps}
                  key={key}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {item.icon && <span className="mr-2 flex items-center justify-center">{item.icon}</span>}
                  {typeof item.label === 'string' ? <span>{item.label}</span> : item.label}
                  {item.shortcut && <span className="ml-auto text-muted-foreground">{item.shortcut}</span>}
                  {item.description && <span className="ml-2 text-muted-foreground">{item.description}</span>}
                </DropdownMenuItem>
              )
            }
            case 'link': {
              return (
                <DropdownMenuItem {...commonProps} key={key} asChild>
                  <a href={item.href} {...linkProps(item.href)} className="flex items-center justify-between">
                    {typeof item.label === 'string' ? <span>{item.label}</span> : item.label}
                    {item.icon && <span className="mr-2 flex items-center justify-center">{item.icon}</span>}
                  </a>
                </DropdownMenuItem>
              )
            }
            case 'checkbox': {
              return (
                <DropdownMenuCheckboxItem
                  {...commonProps}
                  key={key}
                  defaultChecked={item.checked ?? false}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {typeof item.label === 'string' ? <span>{item.label}</span> : item.label}
                </DropdownMenuCheckboxItem>
              )
            }
            case 'radio': {
              return (
                <DropdownMenuRadioItem
                  {...commonProps}
                  key={key}
                  defaultChecked={item.checked ?? false}
                  value={item.label!.toString()}
                  onClick={() => {
                    item.onClick?.()
                    onSelect(item)
                  }}
                >
                  {item.label}
                </DropdownMenuRadioItem>
              )
            }
            case 'submenu': {
              return (
                <DropdownMenuSub key={key}>
                  <DropdownMenuSubTrigger {...commonProps}>
                    {item.icon && <span className="mr-2 flex items-center justify-center">{item.icon}</span>}
                    {typeof item.label === 'string' ? <span>{item.label}</span> : item.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>{process(key, item.children || [], onSelect)}</DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            }
            default: {
              return null
            }
          }
        })

      return process(id, items, onSelect)
    },
  },
)

export function MenuPortalProvider({ children }: React.PropsWithChildren) {
  return (
    <ContextMenuProvider>
      <DropdownMenuProvider>{children}</DropdownMenuProvider>
    </ContextMenuProvider>
  )
}

function makePortal<A, O1 extends BaseOptions = {}>(
  dispatchEvent: string,
  make: (_: { publish: (event: React.MouseEvent) => void }) => A,
  defaultOptions?: O1,
) {
  return <O extends BaseOptions, P extends BaseProps>(useMenus: () => Array<MenuItem>, inputOptions?: Partial<O>) => {
    const defaultConf = R.mergeDeep(defaultOptions?.config || {}, inputOptions?.config || {})
    const elementRef = React.createRef<HTMLElement | null>()

    const use = (props: Partial<P> = {}): A => {
      const instanceId = React.useId()
      const items = useMenus()
      const mergedModal = props.modal ?? inputOptions?.modal ?? defaultOptions?.modal

      const publish = (event: React.MouseEvent) => {
        const targetElement = event.currentTarget
        elementRef.current = targetElement as HTMLElement
        const rect = targetElement.getBoundingClientRect()

        const onClose = () => {
          if (elementRef.current?.dataset.contextMenuOpen) {
            // delete the dataset
            delete elementRef.current.dataset.contextMenuOpen
            elementRef.current = null
          }
          props.onClose?.()
        }

        const onShow = props.onShow
        const onSelect = props.onSelect
        const mergedConfig = R.mergeDeep(defaultConf, props.config || {}) as Partial<O['config'] & P['config']>
        const detail: MenuEventDetail = {
          id: instanceId,
          items: items.filter(Boolean),
          x: event.clientX,
          y: event.clientY,
          rect,
          options: {
            config: mergedConfig,
            modal: mergedModal,
          },
          eventStub: {
            onClose,
            onShow,
            onSelect,
          },
        }

        document.dispatchEvent(new CustomEvent<MenuEventDetail>(dispatchEvent, { detail }))
      }

      return make({ publish })
    }

    return use
  }
}

type Side = 'top' | 'right' | 'bottom' | 'left'

type Boundary = Element | null

interface ContextMenuOptions extends BaseOptions<ContentMenuConfig> {}

interface ContextMenuProps extends BaseProps<ContentMenuConfig> {}

export const contextMenu = makePortal(
  CONTEXT_MENU_SHOW_EVENT,
  ({ publish }) => ({
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault()

      if (event.target instanceof HTMLElement) {
        event.target.dataset.contextMenuOpen = 'true'
      }

      publish(event)
    },
  }),
  {
    modal: true,
    config: {
      alignOffset: 0,
      avoidCollisions: true,
      collisionBoundary: [],
      collisionPadding: 0,
      sticky: 'partial',
    },
  } satisfies Partial<ContextMenuOptions>,
)<ContextMenuOptions, ContextMenuProps>

interface DropdownOptions extends BaseOptions<DropdownContentConfig> {}

interface DropdownProps extends BaseProps<DropdownContentConfig> {}

export const dropdown = makePortal(
  DROPDOWN_MENU_SHOW_EVENT,
  ({ publish }) => ({
    onClick: (event: React.MouseEvent) => {
      publish(event)
    },
  }),
  {
    modal: false,
    config: {
      side: 'bottom',
      sideOffset: 5,
      align: 'start',
      alignOffset: 0,
      avoidCollisions: true,
      collisionBoundary: [],
      collisionPadding: 0,
      arrowPadding: 0,
      sticky: 'partial',
    },
  } satisfies Partial<DropdownOptions>,
)<DropdownOptions, DropdownProps>
