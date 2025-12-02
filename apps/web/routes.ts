import { index, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  route('/sitemap.xml', '../shared/marketing/sitemap.tsx'),
  route('/rss.xml', '../shared/marketing/rss.tsx'),
  route('/', '../shared/marketing/layout.route.tsx', [
    route('home', '../shared/marketing/home.tsx', { id: 'home' }),
    route('pricing', '../shared/marketing/pricing.tsx', { id: 'pricing' }),
    route('changelog', '../shared/marketing/changelog.tsx', { id: 'changelog' }),
    route('contact', '../shared/marketing/contact.tsx'),
    route('privacy', '../shared/marketing/privacy.tsx'),
    route('terms', '../shared/marketing/terms.tsx'),
  ]),
  route('/login/*', '../shared/auth/screen.route.tsx'),
  route('/', '../shared/layout.route.tsx', [
    index('../shared/screen.route.tsx', { id: 'app-home' }),
    route('test/*', '../shared/test/screen.route.tsx'),
    route('*', '../shared/not-found.tsx'),
  ]),
] satisfies RouteConfig
