import { useHotkeysContext } from 'react-hotkeys-hook'
import { Button } from '@/components/ui/button'

function KeyboardShortcutItem({ description, keybinding }: { description: string; keybinding: string }) {
  return (
    <div className="flex items-center">
      <div className="w-[240px]">{description}</div>
      <div className="flex items-center gap-x-1 flex-1 pl-2">
        <span className="tracking-widest opacity-60">{keybinding}</span>
      </div>
      <div className="flex justify-end w-[100px]">
        <Button className="" size={'icon'} variant={'ghost'} disabled>
          <i className="i-lucide-pencil" />
        </Button>
      </div>
    </div>
  )
}

function getOS() {
  const { platform } = window.navigator
  if (platform.includes('Mac')) return 'Mac'
  if (platform.includes('Win')) return 'Win'
  return 'Others'
}

const modifiers = {
  Mac: {
    mod: '⌘',
    meta: '⌥',
    ctrl: '⌃',
    alt: '⌥',
    shift: '⇧',
  },
  Win: {
    mod: 'Ctrl',
    meta: 'Meta',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
  },
  Others: {
    mod: 'Mod',
    meta: 'Meta',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
  },
}

export function KeyboardShortsSettings() {
  const { hotkeys } = useHotkeysContext()

  const os = getOS()
  const mapping = hotkeys.map((item) => {
    const { alt, ctrl, keys, meta, mod, shift } = item

    const symbols = modifiers[os]

    // 连接每个键名
    const combinedKeys = keys ? keys.join('+') : ''

    const keybinding = [
      mod && symbols.mod,
      os !== 'Mac' && meta && symbols.meta, // 在Mac上，'meta'通常与'alt'等同
      ctrl && symbols.ctrl,
      alt && symbols.alt,
      shift && symbols.shift,
      combinedKeys,
    ]
      .filter(Boolean)
      .join('')

    return {
      command: item.description || 'Unknown',
      keybinding,
    }
  })

  return (
    <div className={'py-3'}>
      <div className="mb-4">Keyboard Shortcuts</div>
      <div className="flex">
        <div className="opacity-60 w-[240px]">Command</div>
        <div className="opacity-60 pl-2">Keybinding</div>
      </div>
      <div className="flex flex-col space-y-1">
        {mapping.map((hotkey) => {
          return (
            <KeyboardShortcutItem key={hotkey.command} description={hotkey.command} keybinding={hotkey.keybinding} />
          )
        })}
      </div>
    </div>
  )
}
