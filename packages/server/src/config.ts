import * as Config from 'effect/Config'

/**
 * The domain of the bucket.
 *
 * @example "https://bucket-studio.com"
 * @example "/internal/r2"
 */
export const BUCKET_DOMAIN = Config.string('BUCKET_DOMAIN')
