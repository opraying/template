import { init } from '@client/boot'
import { Live } from '@client/native-context'
import { Boot } from '@xstack/app/components/boot'
import { NavigationProvider } from '@xstack/router/provider'
import { Stack } from 'expo-router'
import { HotUpdater, getUpdateSource } from '@hot-updater/react-native'

export const unstable_settings = {
  anchor: '(tabs)',
}

function RootLayout() {
  return (
    <Layout>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </Layout>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <Boot layer={Live} init={init}>
        {children}
      </Boot>
    </NavigationProvider>
  )
}
export default HotUpdater.wrap({
  source: getUpdateSource('https://hot-updater.opraying.workers.dev/api/check-update', {
    updateStrategy: 'fingerprint',
  }),
})(RootLayout)
