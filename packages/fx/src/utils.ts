import * as Uuid from 'uuid'

export const uuidString = (uuid: Uint8Array<ArrayBufferLike>): string => Uuid.stringify(uuid)

export * from '@xstack/fx/utils/types'
