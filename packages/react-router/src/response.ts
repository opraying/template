import type { ExcludeInternalError } from '@xstack/react-router/errors/common'
import type { LoaderFunctionArgs } from 'react-router'

export type TypedResponse<T = unknown> = Omit<globalThis.Response, 'json'> & {
  json(): Promise<T>
}

export type ReactRouterResult<A, E> = ReactRouterResultSuccess<A> | ReactRouterResultFailure<E>

export interface ReactRouterResultSuccess<A> {
  _tag: 'ReactRouterResultSuccess'
  readonly success: true
  readonly result: A
  headers: HeadersInit
}

export interface ReactRouterResultFailure<E> {
  _tag: 'ReactRouterResultFailure'
  readonly success: false
  readonly error: E
  headers: HeadersInit
}

export const ReactRouterResult = {
  Success: <A, E>(_: { result: A; headers: HeadersInit }): ReactRouterResult<A, E> => ({
    _tag: 'ReactRouterResultSuccess',
    success: true,
    result: _.result,
    headers: _.headers,
  }),
  Failure: <A, E>(_: { error: E; headers: HeadersInit }): ReactRouterResult<A, E> => ({
    _tag: 'ReactRouterResultFailure',
    success: false,
    error: _.error,
    headers: _.headers,
  }),
}

export interface ReactRouterDataSuccess<A> {
  readonly success: true
  readonly result: A
}

export interface ReactRouterDataFailure<E> {
  readonly success: false
  readonly error: E
}

export type ReactRouterData<A, E> = ReactRouterDataSuccess<A> | ReactRouterDataFailure<E>

export declare namespace ReactRouterData {
  export type Data<A, E> = ReactRouterData<A, E>

  export type Failure<E> = ReactRouterDataFailure<E>

  export type Success<A> = ReactRouterDataSuccess<A>

  export type ReduceError<T extends ReactRouterData<any, any>> =
    T extends ReactRouterDataFailure<infer E> ? (E extends never ? never : T) : T

  export type ExtractSuccess<T> = T extends ReactRouterDataSuccess<infer A> ? A : never

  export type ExtractFailure<T> = T extends ReactRouterDataFailure<infer E> ? E : never

  export type SafeData<T extends (args: LoaderFunctionArgs) => Promise<ReactRouterData<any, any>>> =
    ReturnType<T> extends Promise<ReactRouterData<infer A, infer E>>
      ? ReactRouterData<A, ExcludeInternalError<E>>
      : never

  export type ErrorData<T extends (args: LoaderFunctionArgs) => Promise<ReactRouterData<any, any>>> =
    ReturnType<T> extends Promise<ReactRouterData<any, infer E>> ? E : never
}
