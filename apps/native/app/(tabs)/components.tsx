import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Screen() {
  return (
    <SafeAreaView edges={['top']}>
      <View>
        <Text className="text-lg font-bold">OK11111111</Text>
      </View>
    </SafeAreaView>
  )
}
