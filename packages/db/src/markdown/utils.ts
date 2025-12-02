import type { DMMF } from '@prisma/generator-helper'

export const take =
  <Key, T>(dict: Map<Key, T>) =>
  (key: Key, generator: () => T): T => {
    const oldbie: T | undefined = dict.get(key)
    if (oldbie) return oldbie

    const value: T = generator()
    dict.set(key, value)
    return value
  }

export const tagValues =
  (kind: string) =>
  (model: DMMF.Model | DMMF.Field): string[] => {
    if (!model.documentation?.length) return []

    const output: string[] = []
    const splitted: string[] = model.documentation.split('\r\n').join('\n').split('\n')
    for (const line of splitted) {
      const first: number = line.indexOf(`@${kind} `)
      if (first === -1) continue

      output.push(line.slice(first + kind.length + 2).trim())
    }
    return output.map((str) => str.trim()).filter((str) => !!str.length)
  }
