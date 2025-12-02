import appKitTranslation from '@xstack/app-kit/translation/en'
import authKitTranslation from '@xstack/user-kit/translation/en'

export default {
  '//comment': 'this file is for the english language',
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  nav: {
    home: 'Home',
    pricing: 'Pricing',
    changelog: 'Changelog',
    about: 'About',
    contact: 'Contact us',
    faqs: 'FAQs',
    privacy: 'Privacy policy',
    terms: 'Terms of service',

    product: 'Product',
    company: 'Company',
    legal: 'Legal',

    website: 'Website',
    'get-app': 'Get App',
    feedback: 'Feedback',
  },
  contact: {
    description:
      'We are always looking for new opportunities and partnerships. If you have a project in mind, or just want to say hi, feel free to reach out to us.',
    form: {
      name: 'Name',
      email: 'Email',
      message: 'Message',
      date: 'We will get back to you within 24 hours',
      submit: 'Submit',
      sending: 'Sending...',

      error: 'There was an error sending your message. Please try again.',
      success: 'Your message has been sent.',
    },
  },
  marketing: {
    block1: {
      title: 'Verx App is now in beta!',
      'sub-title': 'A platform for indie developers and small teams',
    },
    block2: {},
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
