// https://github.com/oslo-project/crypto/blob/main/src/random/index.ts

export function bigIntFromBytes(bytes: Uint8Array<ArrayBufferLike>): bigint {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return BigInt(`0x${hex}`)
}

export function generateRandomInteger(max: bigint): bigint {
  if (max < 2) {
    throw new Error("Argument 'max' must be a positive integer larger than 1")
  }
  const inclusiveMaxBitLength = (max - 1n).toString(2).length
  const shift = inclusiveMaxBitLength % 8
  const bytes = new Uint8Array(Math.ceil(inclusiveMaxBitLength / 8))

  try {
    crypto.getRandomValues(bytes)
  } catch (e) {
    throw new Error('Failed to retrieve random bytes', {
      cause: e,
    })
  }

  // This zeroes bits that can be ignored to increase the chance `result` < `max`.
  // For example, if `max` can be represented with 10 bits, the leading 6 bits of the random 16 bits (2 bytes) can be ignored.
  if (shift !== 0) {
    bytes[0] &= (1 << shift) - 1
  }
  let result = bigIntFromBytes(bytes)
  while (result >= max) {
    try {
      crypto.getRandomValues(bytes)
    } catch (e) {
      throw new Error('Failed to retrieve random bytes', {
        cause: e,
      })
    }
    if (shift !== 0) {
      bytes[0] &= (1 << shift) - 1
    }
    result = bigIntFromBytes(bytes)
  }
  return result
}

export function generateRandomIntegerNumber(max: number): number {
  if (max < 2 || max > Number.MAX_SAFE_INTEGER) {
    throw new Error("Argument 'max' must be a positive integer larger than 1")
  }
  return Number(generateRandomInteger(BigInt(max)))
}

export function generateRandomString(length: number, alphabet: string): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet[generateRandomIntegerNumber(alphabet.length)]
  }
  return result
}

export function alphabet(...args: string[]) {
  const chars = args
    .map((arg) => {
      if (arg === '0-9') return '0123456789'
      if (arg === 'a-z') return 'abcdefghijklmnopqrstuvwxyz'
      if (arg === 'A-Z') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      return arg
    })
    .join('')
  return chars
}
