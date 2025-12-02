import { NativeModule, requireNativeModule } from 'expo-modules-core'
import type { ExpoBip39ModuleEvents } from './ExpoBip39.types.js'

declare class ExpoBip39ModuleNative extends NativeModule<ExpoBip39ModuleEvents> {
  mnemonicToSeed(mnemonic: string, password?: string | undefined): Promise<string[]>
}

// This call loads the native module object from the JSI.
const nativeModule = requireNativeModule<ExpoBip39ModuleNative>('ExpoBip39')

// Wrapper class that converts string array to Uint8Array
class ExpoBip39Module {
  async mnemonicToSeed(mnemonic: string, password = ''): Promise<Uint8Array> {
    const stringArray = await nativeModule.mnemonicToSeed(mnemonic, password)
    // Convert string array back to Uint8Array
    const uint8Array = new Uint8Array(stringArray.map((str) => Number.parseInt(str, 10)))
    return uint8Array
  }
}

export default new ExpoBip39Module()
