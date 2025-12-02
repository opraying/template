import type * as Data from 'effect/Data'

type FilterKeyByType<A, T> = {
  [K in keyof A as A[K] extends T ? never : K]: A[K]
}

type ExtractTag<T> = T extends Data.Case.Constructor<infer U> ? U : never

export type UnionTaggedEnum<T extends Record<any, any>> = ExtractTag<
  FilterKeyByType<T, Data.Case.Constructor<any>>[keyof FilterKeyByType<T, Data.Case.Constructor<any>>]
>

export type CastArray<T> = [T] extends [never]
  ? never[]
  : [unknown] extends [T]
    ? unknown[]
    :
        | (T extends any ? (T extends readonly (infer U)[] ? U[] : never) : never)
        | (Exclude<T, readonly any[]> extends never ? never : Exclude<T, readonly any[]>[])
