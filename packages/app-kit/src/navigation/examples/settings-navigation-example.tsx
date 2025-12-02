import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  createNavigationItem,
  SettingToggle,
  SettingSection,
  SettingButton,
  SettingInput,
  StatusBadge,
} from '../navigation-components'
import type { NavigationLevel } from '../drill-down-navigator'
import { openMobileNavigationDialog } from '../mobile-navigation-dialog'

// Example settings data
interface AppSettings {
  notifications: {
    push: boolean
    email: boolean
    desktop: boolean
    sound: boolean
  }
  privacy: {
    analytics: boolean
    crashReporting: boolean
    shareData: boolean
  }
  account: {
    name: string
    email: string
    plan: string
  }
  storage: {
    cache: string
    documents: string
  }
}

export function SettingsNavigationExample() {
  const [settings, setSettings] = useState<AppSettings>({
    notifications: {
      push: true,
      email: false,
      desktop: true,
      sound: true,
    },
    privacy: {
      analytics: false,
      crashReporting: true,
      shareData: false,
    },
    account: {
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'Pro',
    },
    storage: {
      cache: '2.3 GB',
      documents: '1.2 GB',
    },
  })

  // Update settings helper
  const updateSettings = <K extends keyof AppSettings, T extends keyof AppSettings[K]>(
    category: K,
    key: T,
    value: AppSettings[K][T],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }))
  }

  // Notification settings component
  const NotificationSettings = () => (
    <div className="space-y-4">
      <SettingSection title="Push Notifications">
        <SettingToggle
          title="Enable Push Notifications"
          description="Receive notifications on your device"
          checked={settings.notifications.push}
          onCheckedChange={(checked) => updateSettings('notifications', 'push', checked)}
        />
        <SettingToggle
          title="Sound"
          description="Play sound when notifications arrive"
          checked={settings.notifications.sound}
          onCheckedChange={(checked) => updateSettings('notifications', 'sound', checked)}
          disabled={!settings.notifications.push}
        />
      </SettingSection>

      <SettingSection title="Other Notifications">
        <SettingToggle
          title="Email Notifications"
          description="Receive notifications via email"
          checked={settings.notifications.email}
          onCheckedChange={(checked) => updateSettings('notifications', 'email', checked)}
        />
        <SettingToggle
          title="Desktop Notifications"
          description="Show notifications on desktop"
          checked={settings.notifications.desktop}
          onCheckedChange={(checked) => updateSettings('notifications', 'desktop', checked)}
        />
      </SettingSection>
    </div>
  )

  // Create the navigation structure
  const createSettingsNavigation = (): NavigationLevel => ({
    title: 'Settings',
    items: [
      createNavigationItem('account', 'Account')
        .subtitle(`${settings.account.name} • ${settings.account.plan}`)
        .icon(<i className="i-lucide-user size-5" />)
        .onPress(() => alert('Account settings...'))
        .build(),

      createNavigationItem('notifications', 'Notifications')
        .subtitle(settings.notifications.push ? 'Enabled' : 'Disabled')
        .icon(<i className="i-lucide-bell size-5" />)
        .component(<NotificationSettings />)
        .build(),

      createNavigationItem('appearance', 'Appearance')
        .subtitle('Theme and display options')
        .icon(<i className="i-lucide-palette size-5" />)
        .children([
          createNavigationItem('theme', 'Theme')
            .subtitle('Light, Dark, or System')
            .icon(<i className="i-lucide-moon size-5" />)
            .onPress(() => alert('Theme settings...'))
            .build(),

          createNavigationItem('display', 'Display')
            .subtitle('Text size and display options')
            .icon(<i className="i-lucide-monitor size-5" />)
            .onPress(() => alert('Display settings...'))
            .build(),
        ])
        .build(),

      createNavigationItem('advanced', 'Advanced')
        .subtitle('Developer and advanced options')
        .icon(<i className="i-lucide-settings size-5" />)
        .children([
          createNavigationItem('developer', 'Developer Options')
            .subtitle('For advanced users')
            .icon(<i className="i-lucide-code size-5" />)
            .onPress(() => alert('Developer options...'))
            .build(),

          createNavigationItem('debug', 'Debug Mode')
            .subtitle('Enable debug logging')
            .icon(<i className="i-lucide-bug size-5" />)
            .onPress(() => alert('Debug mode toggled'))
            .build(),

          createNavigationItem('reset', 'Reset App')
            .subtitle('Reset all settings to defaults')
            .icon(<i className="i-lucide-rotate-ccw size-5" />)
            .onPress(() => alert('App reset...'))
            .build(),
        ])
        .build(),
    ],
  })

  const handleOpenSettings = () => {
    openMobileNavigationDialog({
      initialLevel: createSettingsNavigation(),
      showBreadcrumb: true,
    })
  }

  return (
    <div className="p-8 space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Navigation System Demo</h2>
        <p className="text-muted-foreground">
          A native-like drill-down navigation experience for settings and complex UIs
        </p>
      </div>

      <Button onClick={handleOpenSettings} className="w-full sm:w-auto">
        <i className="i-lucide-settings size-4 mr-2" />
        Open Settings Navigation
      </Button>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>Features:</p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Native-like slide animations</li>
          <li>Breadcrumb navigation</li>
          <li>Back button support</li>
          <li>Touch-friendly interactions</li>
          <li>Responsive design</li>
          <li>Customizable components</li>
        </ul>
      </div>
    </div>
  )
}
