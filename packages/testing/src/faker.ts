// FILE HAS SIDE EFFECTS!
// SOURCE: https://github.com/effect-ts-app/libs/blob/c0e16308f563a9eb118825670541ed211720aab3/packages/prelude/src/faker.ts#L27

import type { Faker } from '@faker-js/faker'
import type * as FC from 'effect/FastCheck'

// TODO: inject faker differently, so we dont care about multiple instances of library.

let faker: Faker = undefined as any as Faker
export function setFaker(f: Faker) {
  faker = f
}

export function getFaker() {
  if (!faker) throw new Error('You forgot to load faker library')
  return faker
}

export const fakerToArb =
  <T>(fakerGen: () => T) =>
  (fc: typeof FC) => {
    return fc
      .integer()
      .noBias() // same probability to generate each of the allowed integers
      .noShrink() // shrink on a seed makes no sense
      .map((seed) => {
        faker.seed(seed) // seed the generator
        return fakerGen() // call it
      })
  }

export const fakerArb = <T>(gen: (fake: Faker) => () => T): ((a: any) => FC.Arbitrary<T>) =>
  fakerToArb(() => gen(getFaker())())
