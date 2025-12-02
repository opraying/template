export const content = {
  hero: {
    title: 'Modern Full-Stack Template',
    description:
      'A production-ready template combining Event Log architecture with React router SSR. Build applications that work seamlessly offline with real-time sync and end-to-end encryption.',
  },

  features: {
    core: {
      title: 'Core Features',
      items: [
        {
          icon: 'i-lucide-server',
          title: 'Event Log Architecture',
          description:
            'Built on Event Sourcing principles for robust data management and sync. Perfect for offline-first apps.',
          techDetail: 'Effect-based Event Log System',
        },
        {
          icon: 'i-lucide-database',
          title: 'Local-First Storage',
          description:
            'SQLite WASM for local storage with automatic sync. Your data stays on your device, always available.',
          techDetail: 'SQLite + Event Journal',
        },
        {
          icon: 'i-lucide-code',
          title: 'Type-Safe Stack',
          description:
            'End-to-end type safety with Effect and TypeScript. From database to UI, everything is type-checked.',
          techDetail: 'Effect + TypeScript',
        },
      ],
    },

    advanced: {
      title: 'Advanced Capabilities',
      items: [
        {
          icon: 'i-lucide-shield',
          title: 'End-to-End Encryption',
          description: 'Built-in encryption for data security. Your data is encrypted before it leaves your device.',
          techDetail: 'AES-GCM + RSA Encryption',
        },
        {
          icon: 'i-lucide-git-merge',
          title: 'PWA & Offline Support',
          description:
            'Full Progressive Web App support with service workers and offline caching. Work anywhere, anytime.',
          techDetail: 'Workbox + IndexedDB',
        },
        {
          icon: 'i-lucide-globe',
          title: 'Serverless Native',
          description: 'Deploy globally with Cloudflare Workers. Edge computing with minimal latency.',
          techDetail: 'Cloudflare Workers',
        },
      ],
    },
  },

  technical: {
    architecture: {
      title: 'Architecture Overview',
      items: [
        {
          title: 'UI Components',
          description: 'Radix UI primitives with Tailwind, fully accessible and customizable',
        },
        {
          title: 'Internationalization',
          description: 'Built-in i18n support with type-safe translations',
        },
        {
          title: 'Observability',
          description: 'OpenTelemetry integration for comprehensive monitoring',
        },
        {
          title: 'Edge Computing',
          description: 'Cloudflare Workers for global deployment and edge functions',
        },
      ],
    },

    examples: {
      title: 'Example Applications',
      items: [
        {
          title: 'Offline Notes',
          description: 'Collaborative note-taking with offline support',
        },
        {
          title: 'Task Manager',
          description: 'Real-time task management across devices',
        },
        {
          title: 'Document Editor',
          description: 'Collaborative document editing with offline support',
        },
      ],
    },
  },
} as const
