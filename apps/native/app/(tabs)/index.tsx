import { hide } from 'expo-splash-screen'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function HomePage() {
  useEffect(() => {
    hide()
  }, [])

  return (
    <SafeAreaView edges={['top']}>
      <View>
        <Text>Welcome to XStack Native</Text>
        <Text className="text-2xl font-bold">
          A modern React Native app with Expo Router, Effect, and local-first architecture
        </Text>
      </View>
    </SafeAreaView>
  )
}
