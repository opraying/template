import { generateMnemonic as bip39GenerateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import * as Types from '@xstack/event-log/Types'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export class Bip39 extends Context.Tag('@xstack/event-log/Bip39')<
  Bip39,
  {
    readonly generateMnemonic: (strength?: 128 | 256) => Effect.Effect<Types.Mnemonic, never>
    readonly validateMnemonic: (mnemonic: string) => Effect.Effect<boolean, never>
    readonly mnemonicToSeed: (mnemonic: string, password?: string) => Effect.Effect<Uint8Array, never>
  }
>() {
  static Default = Layer.effect(
    Bip39,
    Effect.gen(function* () {
      const generateMnemonic = (strength: 128 | 256 = 128) =>
        Effect.sync(() => Types.Mnemonic.make(bip39GenerateMnemonic(wordlist, strength)))

      const validateMnemonic_ = (mnemonic: string) => Effect.sync(() => validateMnemonic(mnemonic.trim(), wordlist))

      const mnemonicToSeed_ = (mnemonic: string, password = '') =>
        Effect.promise(() => mnemonicToSeed(mnemonic.trim(), password))

      return {
        generateMnemonic,
        validateMnemonic: validateMnemonic_,
        mnemonicToSeed: mnemonicToSeed_,
      } satisfies Context.Tag.Service<Bip39>
    }),
  )
}
