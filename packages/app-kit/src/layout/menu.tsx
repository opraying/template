import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMenuOpened } from '@xstack/app-kit/global-state'
import { useNavigate } from '@xstack/router'
import { AnimatePresence, m } from 'motion/react'
import { type ReactNode, startTransition, useMemo, useState } from 'react'
import { useMenuInteractions } from './use-menu-state'

export interface NavGroupConfig {
  /** Additional CSS classes for the group */
  className?: string
  /** CSS classes applied when group is active */
  activeClassName?: string
  /** Group title/label */
  title?: ReactNode
  /** Icon for the group */
  icon?: ReactNode
  /** Optional link for the group */
  href?: string
  /** Whether the group can be collapsed/expanded */
  allowCollapse?: boolean
  /** Whether the group is collapsed by default */
  defaultCollapsed?: boolean
  /** Child navigation items */
  data: NavItemConfig[]
  /** Whether the group is currently active */
  active?: boolean
  /** Right-side content (badges, actions, etc.) */
  right?: ReactNode
  /** Whether to show separator after group */
  separator?: boolean
  /** Whether to add padding to child items */
  childPadding?: boolean
  /** Whether hover is disabled */
  hoverDisabled?: boolean
  /** Callback when nav item is clicked */
  onClick?: (item: NavItemConfig) => void
  /** Callback when group header is clicked */
  onGroupClick?: (item: NavGroupConfig) => void
  /** Test id for testing */
  'data-testid'?: string
}

/**
 * Navigation group component that can contain multiple navigation items.
 * Supports collapsible behavior and active state detection.
 */
export function NavGroup(props: NavGroupConfig) {
  const [collapsed, setCollapsed] = useState(() => props.defaultCollapsed ?? true)
  const [, setOpened] = useMenuOpened()
  const { handleItemFocus, handleItemBlur } = useMenuInteractions()

  const Cp = props.href ? 'a' : 'div'
  const groupId = props.title?.toString() || `group-${Math.random()}`

  // Determine if group is active based on props or children
  const groupActive = useMemo(() => {
    if (typeof props.active !== 'undefined') {
      return props.active
    }
    // Check if any child is active
    return props.data.some((item) => item.active)
  }, [props.active, props.data])

  const childItems = useMemo(
    () =>
      props.data.map((item) => (
        <NavItem
          {...item}
          key={item.id}
          onClick={() => {
            setOpened(false)
            item.onClick?.()
          }}
          onFocus={() => handleItemFocus(item.id)}
          onBlur={handleItemBlur}
        />
      )),
    [props.data, setOpened, handleItemFocus, handleItemBlur],
  )

  return (
    <>
      <div className="relative" data-testid={props['data-testid']}>
        {props.title && (
          <Cp
            href={props.href}
            className={cn(
              'flex items-center justify-between px-fl-xs py-1.5 rounded',
              props.allowCollapse ? 'active:bg-accent/60 group cursor-pointer' : '',
              groupActive ? props.activeClassName : '',
              props.className,
            )}
            onClick={(e) => {
              if (props.allowCollapse) {
                e.preventDefault()
                setCollapsed(!collapsed)
              }
              props.onGroupClick?.(props)
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && props.allowCollapse) {
                e.preventDefault()
                setCollapsed(!collapsed)
              }
            }}
            role={props.allowCollapse ? 'button' : undefined}
            tabIndex={props.allowCollapse ? 0 : undefined}
            aria-expanded={props.allowCollapse ? !collapsed : undefined}
            aria-label={typeof props.title === 'string' ? props.title : undefined}
          >
            <div className={cn('flex items-center flex-1 gap-1')}>
              {props.icon && <i className="size-5 scale-90 flex items-center justify-center">{props.icon}</i>}
              <span className="text-foreground text-sm font-medium text-[hsl(var(--sidebar-foreground))]">
                {props.title}
              </span>
            </div>
            {props.allowCollapse ? (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {props.right}
                </div>
                <i
                  className={cn(
                    'size-4 i-lucide-chevron-up transform transition-all duration-150 group-hover:opacity-100 opacity-0',
                    collapsed ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {props.right}
              </div>
            )}
          </Cp>
        )}
        {props.allowCollapse ? (
          <AnimatePresence initial={false}>
            {collapsed && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.1 }}
                className={cn('flex flex-col gap-y-1.5', props.childPadding && 'px-fl-3xs')}
              >
                {childItems}
              </m.div>
            )}
          </AnimatePresence>
        ) : (
          <div className={cn('flex flex-col py-[2px] gap-1.5', props.childPadding && 'px-fl-3xs')}>{childItems}</div>
        )}
      </div>
      {props.separator && <Separator />}
    </>
  )
}

export interface NavItemConfig {
  /** Unique identifier for the nav item */
  id: string
  /** Display title/label */
  title: string
  /** Optional description text */
  desc?: string | undefined
  /** Additional CSS classes */
  className?: string | undefined
  /** Icon for the nav item */
  icon?: ReactNode | undefined
  /** Optional link URL */
  href?: string | undefined
  /** Whether the item is currently active */
  active?: boolean | undefined
  /** Whether hover effects are disabled */
  hoverDisabled?: boolean | undefined
  /** Whether to show highlight indicator */
  highlight?: boolean | undefined
  /** Whether the item is disabled */
  disabled?: boolean | undefined
  /** Click handler */
  onClick?: (() => void) | undefined
  /** Focus handler */
  onFocus?: (() => void) | undefined
  /** Blur handler */
  onBlur?: (() => void) | undefined
  /** Test id for testing */
  'data-testid'?: string | undefined
  /** Accessibility label */
  'aria-label'?: string | undefined
}

/**
 * Individual navigation item component with support for links, click handlers,
 * and various visual states (active, highlight, disabled).
 */
export const NavItem = (props: NavItemConfig) => {
  const {
    icon,
    title: label,
    className,
    href,
    onClick,
    onFocus,
    onBlur,
    hoverDisabled = true,
    highlight = false,
    active,
    disabled = false,
    'data-testid': testId,
    'aria-label': ariaLabel,
  } = props
  const navigate = useNavigate()

  const content = (
    <div className="flex w-full items-center gap-1.5 relative">
      {icon && <i className="size-5 flex items-center justify-center">{icon}</i>}
      <div className="text-fl-sm text-left flex-1 truncate">{label}</div>
      {highlight && (
        <div className="absolute -right-2 size-2 bg-blue-400 text-accent-foreground rounded-full flex items-center justify-center" />
      )}
    </div>
  )

  const wrap = href ? (
    <a draggable="false" href={href}>
      {content}
    </a>
  ) : (
    content
  )

  return (
    <Button
      variant={'ghost'}
      size="default"
      type="button"
      className={cn(
        'mih-h-auto h-auto py-2 pl-fl-xs pr-fl-sm text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] active:bg-[hsl(var(--sidebar-accent))] max-w-[220px] md:max-w-none',
        active && 'bg-[hsl(var(--sidebar-accent))]',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      asChild={!!href}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          startTransition(() => {
            onClick?.()
          })
        }
      }}
      data-testid={testId}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      aria-current={active ? 'page' : undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      onMouseEnter={(e) => {
        if (import.meta.env.DEV && !disabled) {
          e.stopPropagation()

          const isLargeScreen = window.innerWidth > 640
          if (!hoverDisabled && isLargeScreen) {
            startTransition(() => {
              if (onClick) {
                onClick()
              }
              if (href) {
                navigate.replace(href)
                return
              }
            })
          }
        }
      }}
    >
      {wrap}
    </Button>
  )
}

const Separator = () => <div className={'px-2 my-fl-3xs shrink-0 bg-border h-[1px] w-[95%] mx-auto'} />

export { Separator }
