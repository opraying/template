import * as Menu from '@xstack/lib/components/menu'
import { Button } from '@xstack/lib/ui/button'
import { Separator } from '@xstack/lib/ui/separator'

const useDropdown1 = Menu.dropdown(() => {
  return [
    {
      label: 'Item 1',
      type: 'text',
      onClick: () => {
        console.log('Dropdown1 Selected:', 'item1')
      },
    },
    {
      label: 'Item 2',
      type: 'text',
      onClick: () => {
        console.log('Dropdown1 Selected:', 'item2')
      },
    },
  ]
})

const useDropdown2 = Menu.dropdown(
  () => {
    return [
      {
        label: 'Hello',
        type: 'text',
        onClick: () => {
          console.log('Dropdown2 Selected:', 'item1')
        },
      },
      {
        label: 'Test',
        type: 'text',
        onClick: () => {
          console.log('Dropdown2 Selected:', 'item2')
        },
      },
    ]
  },
  {
    config: {
      side: 'top',
      align: 'start',
    },
  },
)

const useContextMenu1 = Menu.contextMenu(() => {
  return [
    {
      label: 'Hello',
      type: 'text',
      onClick: () => {
        console.log('ContextMenu Selected:', 'item1')
      },
    },
    {
      label: 'Test',
      type: 'text',
      onClick: () => {
        console.log('ContextMenu Selected:', 'item2')
      },
    },
  ]
})

const useContextMenu2 = Menu.contextMenu(() => {
  return [
    {
      type: 'text',
      label: 'New File',
      icon: <i className="i-lucide-moon size-4" />,
      shortcut: '⌘N',
      onClick: () => console.log('New file'),
    },
    { type: 'separator' },
    {
      type: 'checkbox',
      label: 'Show Hidden Files',
      checked: true,
      onClick: () => console.log('Toggle hidden files'),
    },
    {
      type: 'submenu',
      label: 'More Options',
      children: [
        {
          type: 'text',
          label: 'Sub Item 1',
          icon: <i className="i-lucide-moon size-4" />,
          onClick: () => console.log('Sub item 1'),
        },
      ],
    },
  ]
})

function TestMenus() {
  const dropdown1 = useDropdown1({
    onSelect: (value) => console.log('Dropdown1 onSelect:', value),
    onShow: () => {
      console.log('Dropdown1 onShow')
    },
    onClose: () => {
      console.log('Dropdown1 onClose')
    },
  })
  const dropdown2 = useDropdown2()
  const contextMenu1 = useContextMenu1({
    onSelect: (value) => console.log('ContextMenu onSelect:', value),
    onShow: () => {
      console.log('ContextMenu onShow')
    },
    onClose: () => {
      console.log('ContextMenu onClose')
    },
  })
  const contextMenu2 = useContextMenu2({
    onSelect: (value) => console.log('ContextMenu onSelect:', value),
    onShow: () => {
      console.log('ContextMenu onShow')
    },
    onClose: () => {
      console.log('ContextMenu onClose')
    },
  })

  return (
    <div>
      <h2>Portal Menus</h2>
      <div className="flex gap-4">
        <Button {...dropdown1}>Dropdown1</Button>
        <Button {...dropdown2} {...contextMenu1}>
          Dropdown2
        </Button>
        <Button {...contextMenu2}>Dropdown3</Button>
      </div>
    </div>
  )
}

export function TestComponents() {
  return (
    <div>
      <h1>Test Components</h1>
      <Separator />
      <div className="flex flex-col gap-3">
        <TestMenus />
      </div>
    </div>
  )
}
