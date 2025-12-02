import { init } from '@client/boot'
import { Live } from '@client/native-context'
import { Boot } from '@xstack/app/components/boot'
import { NavigationProvider } from '@xstack/router/provider'
import { Stack } from 'expo-router'

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout() {
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
