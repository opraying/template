import React from 'react'
import { Platform } from 'react-native'

const reactNativeVersion = Platform.constants.reactNativeVersion

const ReactVersion = React.version
const ReactNativeVersion = [reactNativeVersion.major, reactNativeVersion.minor, reactNativeVersion.patch].join('.')
const ExpoVersion = '53.0.5'
const PlatformOS = `${Platform.OS} ${Platform.Version}`
const SystemName = (Platform.constants as any).systemName

export const SystemInfo = {
  ReactVersion,
  ReactNativeVersion,
  ExpoVersion,
  PlatformOS,
  SystemName,
}
