export default {
  pricing: {
    slider: {
      'feature-1': {
        title: '独特设计',
        description: '精心打造的极致用户体验',
      },
      'feature-2': {
        title: '专属特权',
        description: 'VIP早期访问和里程碑奖励',
      },
      'feature-3': {
        title: '快速响应',
        description: '优化架构，流畅操作体验',
      },
      'feature-4': {
        title: '数据安全',
        description: '端到端加密，多设备同步',
      },
    },
    comparison: {
      title: '功能对比',
      description: '对比免费和专业版的功能',
      columns: {
        name: '功能',
        free: '免费',
        pro: '专业版',
      },
      'feature-1': {
        name: '基础功能',
        description: '核心功能与基础使用',
      },
      'feature-2': {
        name: '存储空间',
        description: '云端数据存储容量',
        free: '5GB',
        pro: '无限制',
      },
      'feature-3': {
        name: '团队规模',
        description: '可协作的团队成员数量',
        free: '最多3人',
        pro: '无限制',
      },
      'feature-4': {
        name: '版本历史',
        description: '数据版本记录时长',
        free: '7天',
        pro: '永久',
      },
      'feature-5': {
        name: '高级分析',
        description: '深度数据分析能力',
        free: '否',
        pro: '是',
      },
      'feature-6': {
        name: 'API访问',
        description: '系统API调用权限',
        free: '否',
        pro: '是',
      },
    },
    faq: {
      q1: {
        question: 'App Stack是什么？',
        answer: 'App Stack是一个应用程序开发工具。',
      },
      q2: {
        question: '如何使用密钥？',
        answer: '密钥是应用程序开发工具。',
      },
      q3: {
        question: '是否支持动画？',
        answer: '动画是应用程序开发工具。',
      },
    },
    billing: {
      interval: {
        day: '每日',
        week: '每周',
        month: '每月',
        year: '每年',
      },
      period: {
        perMonth: '/ 月',
        perYear: '/ 年',
        perFiveYears: '/ 5年',
        monthlyYearly: '/ 月（年付）',
      },
      type: {
        oneTime: '一次性付款',
        recurring: '定期付款',
        believer: '支持者',
      },
      info: {
        cancelAnytime: '随时可取消',
        oneTimeAccess: '一次付款，获得5年访问权限',
        monthlyBilling: '按月计费直至取消',
        yearlyBilling: '年付 {{price}}',
        yearlyDiscount: '节省 {{percent}}%',
        yearlyTotal: '年付总额 {{price}}',
      },
    },
    subscription: {
      status: {
        active: '已激活',
        trialing: '试用中',
        past_due: '已逾期',
        canceled: '已取消',
        paused: '已暂停',
      },
      period: {
        current: '当前周期',
        trial: {
          title: '试用期',
          description: '您的试用期将于 {{date}} 结束。',
          info: '{{days}}-{{interval}} 免费试用',
        },
        payment: {
          title: '需要付款',
          description: '您的付款已逾期。请更新支付方式以继续使用我们的服务。',
        },
      },
      actions: {
        upgrade: '升级',
        upgradeToYearly: '升级至年度计划',
        manage: '管理支付',
        cancel: '取消',
        cancelSubscription: '取消订阅',
        cancelPlan: '取消计划',
        subscribe: '订阅',
        purchase: '购买',
        contact: '联系销售',
        processing: '处理中...',
        trial: '开始免费试用',
        trialDescription: '开始 {{days}} {{interval}} 免费试用，之后 {{price}}',
      },
      upgrade: {
        refundInfo: '升级时，我们会自动退还当前计划的费用并开通新计划',
      },
      transactions: {
        title: '交易记录',
        description: '查看您的交易历史并下载发票',
        noTransactions: '未找到交易记录',
        columns: {
          date: '日期',
          description: '描述',
          status: '状态',
          amount: '金额',
          receipt: '收据',
        },
        status: {
          completed: '成功',
          failed: '失败',
          pending: '处理中',
        },
      },
    },
    display: {
      title: '简单透明的定价',
      subtitle: '选择最适合您需求的方案',
      footer: {
        more: '更多详情和功能',
        viewPricing: '查看定价页面',
      },
      badges: {
        popular: '热门',
        selected: '已选',
        new: '新',
        limited: '限时',
      },
      payments: {
        securedWith: '由 {{provider}} 提供安全支付',
      },
      free: {
        title: '免费版',
        subtitle: '免费使用核心功能',
        feature1: '基本存储',
        feature2: '核心功能',
        feature3: '标准支持',
      },
      pro: {
        title: 'Pro',
        subtitle: '更多专业功能',
        feature1: 'Basic Storage',
        feature2: 'Core Features',
        feature3: 'Standard Support',
        'learn-more': '了解更多',
      },
    },
    error: {
      title: '错误',
      noPlans: '暂无可用定价方案',
      paymentFailed: '支付失败，请重试。',
      invalidProvider: '无效的支付提供商',
      initFailed: '支付系统初始化失败',
    },
    interval: {
      daily: '每日',
      day: '天',
      weekly: '每周',
      week: '周',
      monthly: '每月',
      month: '月',
      yearly: '每年',
      year: '年',
      days: '天',
      weeks: '周',
      months: '月',
      years: '年',
    },
    billingInterval: {
      day: '每日',
      week: '每周',
      month: '每月',
      year: '每年',
    },
    features: {
      monthly: {
        1: {
          title: '基本存储',
          description: '基本存储空间',
        },
        2: {
          title: '更多功能',
          description: '更多功能和能力',
        },
        3: {
          title: '标准支持',
          description: '标准支持',
        },
      },
      yearly: {
        1: {
          title: '更多存储',
          description: '更多存储空间',
        },
        2: {
          title: '更多功能',
          description: '更多功能和能力',
        },
        3: {
          title: '标准支持',
          description: '快速响应和支持',
        },
      },
    },
  },
  sync: {
    overview: {
      title: '同步状态',
      syncing: '同步中',
      currentDevice: '当前设备',
      devices: '已连接设备',
      connectionStatus: {
        online: '在线',
        offline: '离线',
        offlineReason: '离线 {{reason}}',
      },
    },
    storage: {
      local: {
        title: '本地存储',
        description: '此设备已使用的存储空间',
      },
      server: {
        title: '云端存储',
        description: '您的云存储使用情况',
      },
    },
    autoSync: {
      title: '自动同步',
      description: '在设备间同步更改',
    },
    backup: {
      title: '备份',
      description: '备份和恢复您的数据',
      create: '创建备份',
      restore: '恢复备份',
    },
    devices: {
      title: '已连接设备',
      limit: '{{count}} / {{max}}',
      status: {
        current: '当前设备',
        lastSeen: '最后在线 {{time}}',
      },
    },
    upgrade: {
      limitedFeatures: '功能受限',
      message: '升级以解锁更多功能',
      learnMore: '了解更多',
    },
    error: {
      title: '同步错误',
      description: '同步数据时出现错误',
    },
    lastSync: '上次同步',
    mnemonic: {
      title: '恢复短语',
      description: '管理您的恢复短语',
      display: {
        show: '显示短语',
        hide: '隐藏',
        copy: '复制恢复短语',
        copied: '已复制！',
      },
      warning: '切勿与任何人分享您的恢复短语。请安全保管。',
      import: {
        warning: '导入恢复短语前，请确保您处于安全的环境中。',
        placeholder: '请输入您的12个单词恢复短语...',
        validation: {
          invalid: '无效的恢复短语',
        },
      },
      security: {
        store: '将恢复短语存储在安全的位置',
        backup: '在不同位置进行多个备份',
        share: '切勿与任何人分享您的恢复短语',
      },
      importInfo: {
        backup: '请确保您已备份当前数据',
        clear: '这将替换您现有的数据',
      },
      viewMnemonic: '查看恢复短语',
      importMnemonic: '导入恢复短语',
    },
    dangerZone: {
      title: '危险区域',
      description: '请谨慎操作以下功能',
    },
    clearLocalData: {
      title: '清除本地数据',
      description: '删除此设备上的所有数据',
      warning: '这将删除此设备上的所有数据',
    },
    identity: {
      title: '安全本地优先应用',
      description: '这是一个注重隐私的本地优先应用，您的数据通过恢复短语加密并本地存储。',
      learnMore: '了解更多技术细节',
      setup: {
        title: '请选择以下方式之一来设置您的身份',
        create: {
          title: '创建新身份',
          description: '系统将自动为您创建新身份，您可以稍后查看或更改',
          button: '创建新身份',
        },
        import: {
          title: '导入现有身份',
          description: '使用现有恢复短语恢复您的身份',
          button: '导入现有身份',
        },
      },
      ready: {
        title: '准备就绪',
        description: '请审查并安全备份您的恢复短语。您也可以选择导入现有身份以替换当前身份。',
        mnemonic: {
          title: '您的恢复短语',
          description: '这是您的身份凭证，请安全备份',
          display: {
            show: '显示恢复短语',
            hide: '隐藏',
            copy: '复制恢复短语',
            copied: '已复制！',
          },
        },
        import: {
          button: '导入现有身份',
        },
      },
      advanced: {
        title: '高级操作',
        reset: {
          title: '数据重置',
          description: '此操作将清除本地存储的恢复短语和全部数据。请确保：',
          requirements: {
            backup: '您已安全备份恢复短语',
            confirm: '或者您真的想要放弃当前数据并开始新的账号',
          },
          warning: '⚠️ 如果您没有备份恢复短语，清除后将无法恢复现有数据',
          clearData: '清除数据',
        },
      },
      technical: {
        title: '理解我们的技术',
        overview:
          '我们使用创新的技术架构来确保您的数据安全、隐私和可用性。您可以随时随地访问和管理数据，无论在线还是离线。',
        features: {
          localStorage: {
            title: '本地优先存储',
            description: '您的数据主要存储在本地设备上，这意味着：',
            benefits: {
              offline: '大多数功能在没有网络的情况下也能正常工作',
              control: '数据完全由您控制，不受云服务依赖',
              desktop: '可以作为桌面应用程序安装，随时随地使用',
            },
          },
          encryption: {
            title: '端到端加密',
            description: '使用高强度加密技术保护您的数据：',
            benefits: {
              local: '所有数据都在本地加密',
              transfer: '数据传输是端到端加密的',
              private: '即使我们也不能查看您的数据内容',
            },
          },
          eventLog: {
            title: '事件日志架构',
            description: '基于事件源设计，提供可靠的数据管理：',
            benefits: {
              history: '记录所有数据变化，支持历史跟踪',
              sync: '多设备数据同步，智能冲突解决',
              integrity: '数据完整性验证，防止意外损坏',
            },
          },
        },
        mnemonic: {
          title: '恢复短语的重要性',
          description: '恢复短语是您的身份凭证，用于生成加密密钥、恢复身份和确保数据安全。它就像您的数字身份密钥，请：',
          requirements: {
            backup: '安全备份恢复短语',
            private: '不要与他人分享',
          },
        },
      },
    },
  },
  misc: {
    language: '语言',
    next: '下一个',
    previous: '上一个',
    back: '返回',
    submit: '提交',
    cancel: '取消',
    save: '保存',
    close: '关闭',
    delete: '删除',
    edit: '编辑',

    'app-reload': '重新加载应用',
  },
  settings: {
    title: '设置',
    appearance: {},
    account: {},
    user: {},
    'user-settings': '用户设置',
    'app-settings': '应用设置',
    profile: {
      title: '个人资料',
      desc: '管理您的个人资料',
    },
    preferences: {
      title: '偏好设置',
      desc: '管理您的偏好设置',
      language: '语言',
      'language.desc': '选择您的首选语言',
      theme: '主题',
      'theme.desc': '选择您的首选主题',
      'theme.light': '亮色',
      'theme.dark': '暗色',
      'theme.system': '跟随系统',
      fontSize: '字体大小',
      'fontSize.desc': '选择您的首选字体大小',
      'fontSize.small': '小',
      'fontSize.default': '默认',
      'fontSize.medium': '中',
      'fontSize.large': '大',
      transparentSidebar: '透明侧边栏',
      'transparentSidebar.desc': '启用透明侧边栏',
      usePointerCursor: '使用指针光标',
      'usePointerCursor.desc': '启用指针光标',
      useDefaultHomeView: '使用默认首页',
      'useDefaultHomeView.desc': '启用默认首页',
    },
    integrations: {
      title: '集成',
      desc: '管理您的集成',
    },
    sync: {
      title: '同步',
      desc: '管理您的同步和备份设置',
    },
    subscriptions: {
      title: '订阅',
      desc: '这里显示您的有效订阅。每个订阅将在相同的账单周期内计费。订阅可以随时更新或取消。',
    },
    shortcuts: { title: '快捷方式' },
    download: { title: '下载应用程序' },
    changelog: { title: '更新日志' },
    feedback: {
      title: '发送反馈',
      desc: '请告诉我们您的想法，并随意附上视频或截图的链接 :)',
    },
    'misc-settings': '其他设置',
    signOut: { title: '登出' },
  },
  support: {
    title: '支持',
    desc: '遇到问题或有建议？欢迎随时与我们联系',
    contact: '联系支持',
    documentation: '使用文档',
  },
}
