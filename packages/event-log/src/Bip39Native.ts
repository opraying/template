import { generateMnemonic as bip39GenerateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { Bip39 } from '@xstack/event-log/Bip39'
import * as Types from '@xstack/event-log/Types'
import type * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import ExpoBip39 from '@xstack/expo-bip39'

export const Bip39Live = Layer.effect(
  Bip39,
  Effect.gen(function* () {
    const generateMnemonic = (strength: 128 | 256 = 128) =>
      Effect.sync(() => Types.Mnemonic.make(bip39GenerateMnemonic(wordlist, strength)))

    const validateMnemonic_ = (mnemonic: string) => Effect.sync(() => validateMnemonic(mnemonic.trim(), wordlist))

    const mnemonicToSeed = (mnemonic: string, password = '') =>
      Effect.promise(() => ExpoBip39.mnemonicToSeed(mnemonic.trim(), password))

    return {
      generateMnemonic,
      validateMnemonic: validateMnemonic_,
      mnemonicToSeed,
    } satisfies Context.Tag.Service<Bip39>
  }),
)
