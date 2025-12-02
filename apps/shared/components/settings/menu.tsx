import { buildModules, type SettingMenuConfig } from '@xstack/app-kit/settings'

const ProfileSettings = () =>
  import('@shared/components/settings/module/profile').then((m) => ({ default: m.ProfileSettings }))

const PreferenceSettings = () =>
  import('@shared/components/settings/module/preference').then((m) => ({ default: m.PreferenceSettings }))

const SyncSettings = () =>
  import('@xstack/app-kit/settings/module/sync-settings').then((m) => ({ default: m.SyncSettings }))

const SubscriptionSettings = () =>
  import('@xstack/app-kit/settings/module/subscription').then((m) => ({ default: m.SubscriptionSettings }))

const ShortcutsSettings = () =>
  import('@shared/components/settings/module/keyboard-shorts').then((m) => ({ default: m.KeyboardShortsSettings }))

const DownloadApps = () =>
  import('@shared/components/settings/module/download-apps').then((m) => ({ default: m.DownloadApp }))

const Changelog = () =>
  import('@shared/components/settings/module/changelog').then((m) => ({ default: m.ChangelogList }))

const SendFeedback = () => import('@shared/components/settings/module/feedback').then((m) => ({ default: m.Feedback }))

const userLinks = {
  id: 'user-settings',
  title: 'settings.user-settings',
  data: [
    {
      id: 'user-profile',
      title: 'settings.profile.title',
      icon: <i className="i-lucide-user-circle" />,
    },
  ],
} as const satisfies SettingMenuConfig

const appLinks = {
  id: 'app-settings',
  title: 'settings.app-settings',
  data: [
    {
      id: 'app-preferences',
      title: 'settings.preferences.title',
      icon: <i className="i-lucide-settings-2" />,
    },
    {
      id: 'sync-settings',
      title: 'settings.sync.title',
      desc: 'settings.sync.desc',
      icon: <i className="i-lucide-box-select" />,
    },
    {
      id: 'billing-subscriptions',
      title: 'settings.subscriptions.title',
      desc: 'settings.subscriptions.desc',
      icon: <i className="i-lucide-box-select" />,
    },
    {
      id: 'app-shortcuts',
      title: 'settings.shortcuts.title',
      icon: <i className="i-lucide-keyboard" />,
    },
  ],
} as const satisfies SettingMenuConfig

const miscLinks = {
  id: 'misc-settings',
  data: [
    {
      id: 'misc-download',
      title: 'settings.download.title',
      icon: <i className="i-lucide-download" />,
    },
    {
      id: 'misc-changelog',
      title: 'settings.changelog.title',
      icon: <i className="i-lucide-rocket" />,
      highlight: true,
    },
    {
      id: 'misc-feedback',
      title: 'settings.feedback.title',
      desc: 'settings.feedback.desc',
      icon: <i className="i-lucide-message-circle" />,
    },
  ],
} as const satisfies SettingMenuConfig

export const settingsMenuModule = buildModules([userLinks, appLinks, miscLinks], {
  'user-profile': ProfileSettings,
  'app-preferences': PreferenceSettings,
  'billing-subscriptions': SubscriptionSettings,
  'sync-settings': SyncSettings,
  'app-shortcuts': ShortcutsSettings,
  'misc-download': DownloadApps,
  'misc-changelog': Changelog,
  'misc-feedback': SendFeedback,
})
