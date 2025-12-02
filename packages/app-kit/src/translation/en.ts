export default {
  pricing: {
    slider: {
      'feature-1': {
        title: 'Unique Design',
        description: 'Crafted for ultimate user experience',
      },
      'feature-2': {
        title: 'Exclusive Benefits',
        description: 'VIP early access and milestone rewards',
      },
      'feature-3': {
        title: 'Fast Response',
        description: 'Optimized architecture for smooth experience',
      },
      'feature-4': {
        title: 'Data Security',
        description: 'End-to-end encryption with multi-device sync',
      },
    },
    comparison: {
      title: 'Feature Comparison',
      description: 'Compare the features of the free and professional plans',
      columns: {
        name: 'Feature',
        free: 'Free',
        pro: 'Pro',
      },
      'feature-1': {
        name: 'Basic',
        description: 'Core features and basic usage',
      },
      'feature-2': {
        name: 'Storage',
        description: 'Cloud storage capacity',
        free: '5GB',
        pro: 'Unlimited',
      },
      'feature-3': {
        name: 'Team Size',
        description: 'Number of team members',
        free: '3',
        pro: 'Unlimited',
      },
      'feature-4': {
        name: 'Version History',
        description: 'Data versioning duration',
        free: '7 days',
        pro: 'Permanent',
      },
      'feature-5': {
        name: 'Advanced Analysis',
        description: 'Advanced data analysis capabilities',
        free: 'No',
        pro: 'Yes',
      },
      'feature-6': {
        name: 'API Access',
        description: 'System API access',
        free: 'No',
        pro: 'Yes',
      },
    },
    faq: {
      q1: {
        question: 'What is App Stack and how does it work?',
        answer: 'Yes. It adheres to the WAI-ARIA design pattern.',
      },
      q2: {
        question: 'How do keys work?',
        answer: "Yes. It comes with default styles that matches the other components's aesthetic.",
      },
      q3: {
        question: 'Is it animated?',
        answer: "Yes. It's animated by default, but you can disable it if you prefer.",
      },
    },
    billing: {
      interval: {
        day: 'Daily',
        week: 'Weekly',
        month: 'Monthly',
        year: 'Yearly',
      },
      period: {
        perMonth: '/ month',
        perYear: '/ year',
        perFiveYears: '/ 5 years',
        monthlyYearly: '/ month, paid yearly',
      },
      type: {
        oneTime: 'One-time',
        recurring: 'Recurring',
        believer: 'Believer',
      },
      info: {
        cancelAnytime: 'Cancel anytime',
        oneTimeAccess: 'Pay once, get access for 5 years',
        monthlyBilling: 'Billed monthly until cancelled',
        yearlyBilling: 'Billed {{price}} yearly',
        yearlyDiscount: 'Save {{percent}}%',
        yearlyTotal: 'Billed {{price}} yearly',
      },
    },
    subscription: {
      status: {
        active: 'Active',
        trialing: 'Trial',
        past_due: 'Past Due',
        canceled: 'Canceled',
        paused: 'Paused',
      },
      period: {
        current: 'Current Period',
        trial: {
          title: 'Trial Period',
          description: 'Your trial ends on {{date}}.',
          info: '{{days}}-{{interval}} free trial',
        },
        payment: {
          title: 'Payment Required',
          description: 'Your payment is past due. Please update your payment method to continue using our services.',
        },
      },
      actions: {
        upgrade: 'Upgrade',
        upgradeToYearly: 'Upgrade to Yearly',
        manage: 'Manage Payment',
        cancel: 'Cancel',
        cancelSubscription: 'Cancel Subscription',
        cancelPlan: 'Cancel Plan',
        subscribe: 'Subscribe',
        purchase: 'Purchase',
        contact: 'Contact Sales',
        processing: 'Processing...',
        trial: 'Start free trial',
        trialDescription: 'Start {{days}} {{interval}} free trial, then {{price}}',
      },
      upgrade: {
        refundInfo: "When upgrading, we'll automatically refund your current plan and start the new one",
      },
      transactions: {
        title: 'Transaction History',
        description: 'View your transaction history and download invoices',
        noTransactions: 'No transactions found',
        columns: {
          date: 'Date',
          description: 'Description',
          status: 'Status',
          amount: 'Amount',
          receipt: 'Receipt',
        },
        status: {
          completed: 'Succeeded',
          failed: 'Failed',
          pending: 'Pending',
        },
      },
    },
    display: {
      title: 'Simple, transparent pricing',
      subtitle: 'Choose the plan that best suits your needs',
      free: {
        title: 'Free Version',
        subtitle: 'Core features available for free',
        feature1: 'Basic Storage',
        feature2: 'Core Features',
        feature3: 'Standard Support',
      },
      pro: {
        title: 'Pro Version',
        subtitle: 'Core features available for free',
        feature1: 'Basic Storage',
        feature2: 'Core Features',
        feature3: 'Standard Support',
        'learn-more': 'Learn more',
      },
      footer: {
        more: 'More details and features',
        viewPricing: 'View pricing page',
      },
      badges: {
        popular: 'Popular',
        selected: 'Selected',
        new: 'New',
        limited: 'Limited Time',
      },
      payments: {
        securedWith: 'Payments secured with {{provider}}',
      },
    },
    error: {
      title: 'Error',
      noPlans: 'No pricing plans available',
      paymentFailed: 'Payment failed. Please try again.',
      invalidProvider: 'Invalid payment provider',
      initFailed: 'Failed to initialize payment system',
    },
    interval: {
      daily: 'Daily',
      day: 'Day',
      weekly: 'Weekly',
      week: 'Week',
      monthly: 'Monthly',
      month: 'Month',
      yearly: 'Yearly',
      year: 'Year',
      days: 'Days',
      weeks: 'Weeks',
      months: 'Months',
      years: 'Years',
    },
    billingInterval: {
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
      year: 'Yearly',
    },
    features: {
      monthly: {
        1: {
          title: 'Basic Storage',
          description: 'Basic storage space',
        },
        2: {
          title: 'More Features',
          description: 'More features and capabilities.',
        },
        3: {
          title: 'Standard Support',
          description: 'Standard support.',
        },
      },
      yearly: {
        1: {
          title: 'More Storage',
          description: 'More storage space',
        },
        2: {
          title: 'More Features',
          description: 'More features and capabilities.',
        },
        3: {
          title: 'Standard Support',
          description: 'Fast response and support',
        },
      },
    },
  },
  sync: {
    connectionStatus: {
      online: 'Online',
      offline: 'Offline',
      offlineReason: 'Offline {{reason}}',
      connecting: 'Connecting',
      reconnecting: 'Reconnecting',
      reconnectingSeconds: 'Reconnecting, next retry in {{seconds}} seconds',
      error: 'Error',
    },
    overview: {
      title: 'Sync Status',
      syncing: 'Syncing',
      currentDevice: 'Current Device',
      devices: 'Connected Devices',
    },
    storage: {
      local: {
        title: 'Local Storage',
        description: 'Storage used on this device',
      },
      server: {
        title: 'Cloud Storage',
        description: 'Your cloud storage usage',
      },
    },
    autoSync: {
      title: 'Auto Sync',
      description: 'Sync changes across devices',
    },
    backup: {
      title: 'Backup',
      description: 'Backup and restore your data',
      create: 'Create Backup',
      restore: 'Restore Backup',
    },
    devices: {
      title: 'Connected Devices',
      limit: '{{count}} / {{max}}',
      status: {
        current: 'Current Device',
        lastSeen: 'Last seen {{time}}',
      },
    },
    upgrade: {
      limitedFeatures: 'Limited Features',
      message: 'Upgrade to unlock more features',
      learnMore: 'Learn More',
    },
    error: {
      title: 'Sync Error',
      description: 'There was an error syncing your data',
    },
    lastSync: 'Last Synced',
    mnemonic: {
      title: 'Recovery Phrase',
      description: 'Manage your recovery phrase',
      display: {
        show: 'Show Phrase',
        hide: 'Hide',
        copy: 'Copy Recovery Phrase',
        copied: 'Copied!',
      },
      warning: 'Never share your recovery phrase with anyone. Store it securely.',
      import: {
        warning: 'Make sure you are in a secure environment before importing your recovery phrase.',
        placeholder: 'Enter your 12-word recovery phrase...',
        validation: {
          invalid: 'Invalid recovery phrase',
        },
      },
      security: {
        store: 'Store your recovery phrase in a secure location',
        backup: 'Make multiple backups in different locations',
        share: 'Never share your recovery phrase with anyone',
      },
      importInfo: {
        backup: 'Make sure you have backed up your recover phrase.',
        clear: 'This will replace your existing data',
      },
      viewMnemonic: 'View Recovery Phrase',
      importMnemonic: 'Import Recovery Phrase',
    },
    dangerZone: {
      title: 'Danger Zone',
      description: 'Be careful with these actions',
    },
    clearLocalData: {
      title: 'Clear Local Data',
      description: 'Delete all data from this device',
      warning: 'This will delete all data from this device',
    },
    identities: {
      current: 'Current',
      remove: 'Remove',
      storageUsed: 'Used',
      lastSync: 'Last Synced',
    },
    identity: {
      title: 'Secure Local-First App',
      description:
        'This is a privacy-focused local-first app where your data is encrypted with a recovery phrase and stored locally.',
      learnMore: 'Learn more about technical details',
      setup: {
        title: 'Choose one of the following ways to set up your identity',
        create: {
          title: 'Create New Identity',
          description: 'System will automatically create a new identity for you, which you can view or change later',
          button: 'Create New Identity',
        },
        import: {
          title: 'Import Existing Identity',
          description: 'Restore your previous identity using an existing recovery phrase',
          button: 'Import Existing Identity',
        },
      },
      ready: {
        title: 'Create Success',
        description: 'Please save your recovery phrase in a secure location.',
        mnemonic: {
          title: 'Your Recovery Phrase',
          description: 'This is your identity credential, please back it up securely',
          display: {
            show: 'Show Recovery Phrase',
            hide: 'Hide',
            copy: 'Copy Recovery Phrase',
            copied: 'Copied!',
          },
        },
        import: {
          button: 'Import Existing Identity',
        },
      },
      advanced: {
        title: 'Advanced Operations',
        reset: {
          title: 'Data Reset',
          description: 'This operation will clear the locally stored recovery phrase. Please ensure:',
          requirements: {
            backup: 'You have securely backed up your recovery phrase',
            confirm: 'Or you really want to abandon the current data and start a new account',
          },
          warning:
            "⚠️ If you haven't backed up your recovery phrase, you won't be able to recover existing data after clearing",
          clearData: 'Clear Data',
        },
      },
      technical: {
        title: 'Understanding Our Technology',
        overview:
          'We use an innovative technical architecture to ensure your data security, privacy and availability. You can access and manage your data anytime, whether online or offline.',
        features: {
          localStorage: {
            title: 'Local-First Storage',
            description: 'Your data is primarily stored on your local device, which means:',
            benefits: {
              offline: 'Most features work normally even without network',
              control: 'Data is fully under your control, not dependent on cloud services',
              desktop: 'Can be installed as a desktop app, use anytime anywhere',
            },
          },
          encryption: {
            title: 'End-to-End Encryption',
            description: 'Using high-strength encryption technology to protect your data:',
            benefits: {
              local: 'All data is encrypted locally',
              transfer: 'Data transmission is encrypted end-to-end',
              private: 'Even we cannot view your data content',
            },
          },
          eventLog: {
            title: 'Event Log Architecture',
            description: 'Based on event sourcing design, providing reliable data management:',
            benefits: {
              history: 'Records all data changes, supports historical tracking',
              sync: 'Multi-device data synchronization, smart conflict resolution',
              integrity: 'Data integrity verification, prevents accidental corruption',
            },
          },
        },
        mnemonic: {
          title: 'Importance of Recovery Phrase',
          description:
            "The recovery phrase is your identity credential, used to generate encryption keys, restore identity and ensure data security. It's like your digital identity key, please:",
          requirements: {
            backup: 'Back up the recovery phrase securely',
            private: 'Do not share with others',
          },
        },
      },
    },
  },
  misc: {
    language: 'Language',
    next: 'Next',
    previous: 'Previous',
    more: 'More',
    back: 'Back',
    submit: 'Submit',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',

    'app-reload': 'Reload App',
  },
  settings: {
    title: 'Settings',
    appearance: {},
    account: {},
    user: {},
    'user-settings': 'User settings',
    'app-settings': 'App settings',
    profile: {
      title: 'Profile',
      desc: 'Manage your profile',
    },
    preferences: {
      title: 'Preferences',
      desc: 'Manage your preferences',
      language: 'Language',
      'language.desc': 'Select your preferred language',
      theme: 'Theme',
      'theme.desc': 'Select your preferred theme',
      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'theme.system': 'System',
      fontSize: 'Font Size',
      'fontSize.desc': 'Select your preferred font size',
      'fontSize.small': 'Small',
      'fontSize.default': 'Default',
      'fontSize.medium': 'Medium',
      'fontSize.large': 'Large',
      transparentSidebar: 'Transparent Sidebar',
      'transparentSidebar.desc': 'Enable transparent sidebar',
      usePointerCursor: 'Use Pointer Cursor',
      'usePointerCursor.desc': 'Enable pointer cursor',
      useDefaultHomeView: 'Use Default Home View',
      'useDefaultHomeView.desc': 'Enable default home view',
    },
    integrations: {
      title: 'Integration',
      desc: 'Manage your integrations',
    },
    sync: {
      title: 'Sync',
      desc: 'Manage your sync and backup settings',
    },
    subscriptions: {
      title: 'Subscriptions',
      desc: 'Here are your active subscriptions. Each subscription will be billed on the same billing cycle. Subscriptions can be updated or cancelled at any time.',
    },
    shortcuts: { title: 'Shortcuts' },
    download: { title: 'Download apps' },
    changelog: { title: 'Changelog' },
    feedback: {
      title: 'Send Feedback',
      desc: 'Let us know what you think and feel free to include a link to a video or screenshot :)',
    },
    'misc-settings': 'Misc settings',
    signOut: { title: 'Logout' },
  },
  support: {
    title: 'Support',
    desc: 'Have questions or suggestions? Contact us anytime',
    contact: 'Contact Support',
    documentation: 'Documentation',
  },
}
