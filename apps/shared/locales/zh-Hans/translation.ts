import appKitTranslation from '@xstack/app-kit/translation/zh-Hans'
import authKitTranslation from '@xstack/user-kit/translation/zh-Hans'

export default {
  '//comment': '这个文件是用于中文（香港）语言',
  theme: {
    light: '浅色模式',
    dark: '深色模式',
    system: '跟随系统',
  },
  nav: {
    home: '首页',
    pricing: '定价',
    changelog: '更新日志',
    about: '关于',
    contact: '联系我们',
    faqs: '常见问题',
    privacy: '隐私政策',
    terms: '服务条款',

    product: '产品',
    company: '公司',
    legal: '法律',

    website: '网站',
    'get-app': '获取应用',
    feedback: '反馈',
  },
  contact: {
    description: '我们一直在寻找新的机会和合作伙伴。如果您有项目想法，或者只是想打个招呼，请随时与我们联系。',
    form: {
      name: '姓名',
      email: '邮箱',
      message: '留言',
      date: '我们将在24小时内回复您',
      submit: '提交',
      sending: '正在发送...',
      error: '出现错误，请稍后再试',
      success: '您的消息已成功发送',
    },
  },
  marketing: {
    block1: {
      title: '使用 Verx.App 获得更棒的产品开发体验',
      'sub-title': '通过全新设计的交互方式，使用 Cloudflare pages、workers，配置 DNS, KV, SSL等变得简单而直观。',
      button1: '正在开发中',
    },
    block2: {
      title: '',
      desc1:
        'Verx.App 是为专业开发人员设计的工具，它采用了一种新的、简明的用户交互方式来帮助用户使用 cloudflare pages、workers，以及配置 dns, kv, ssl 等各项功能。本次改进主要旨在优化用户的交互体验，使操作更加流畅和理解。',
    },
  },
  auth: {
    ...authKitTranslation.auth,
  },
  pricing: {
    ...appKitTranslation.pricing,
  },
  sync: {
    ...appKitTranslation.sync,
  },
  misc: {
    ...appKitTranslation.misc,
  },
  settings: {
    ...appKitTranslation.settings,
  },
}
