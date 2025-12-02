import type { FC, ReactNode } from 'react'

export interface SettingMenuConfig {
  id: string
  title?: string | undefined
  className?: string | undefined
  icon?: ReactNode | undefined
  href?: string | undefined
  active?: boolean | undefined
  component?: FC | undefined
  hoverDisabled?: boolean | undefined
  highlight?: boolean | undefined
  onClick?: (() => void) | undefined
  data: SettingMenuItemConfig[]
}

export interface SettingMenuItemConfig {
  id: string
  title: string
  desc?: string | undefined
  className?: string | undefined
  icon?: ReactNode | undefined
  href?: string | undefined
  active?: boolean | undefined
  hoverDisabled?: boolean | undefined
  highlight?: boolean | undefined
}
