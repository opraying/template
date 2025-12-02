import type * as SqlClient from '@effect/sql/SqlClient'
import type { Row } from '@effect/sql/SqlConnection'
import type { CastArray } from '@xstack/fx/utils/types'
import { createQueryHooks, type LiveEffectQueryOptions, type LiveSqlQueryOptions } from '@xstack/sqlite/live'
import type { SqlError } from '@xstack/sqlite/schema'
import type * as Effect from 'effect/Effect'
import type { LazyArg } from 'effect/Function'

export const useLiveQuery: {
  /**
   * React hook for live SQL queries
   * @param sqlQuery The SQL query to execute
   * @param options Configuration options
   * @returns The query results
   *
   * @example
   * ```tsx
   * // Basic usage
   * const users = useLiveQuery<User[]>(() => "SELECT * FROM users")
   *
   * // With transformation
   * const userCount = useLiveQuery<number>(
   *   () => "SELECT COUNT(*) as count FROM users",
   *   { transform: rows => rows[0].count }
   * )
   *
   * // With parameters
   * const userPosts = useLiveQuery<Post[]>(
   *   () => "SELECT * FROM posts WHERE user_id = ?",
   *   { params: [userId] }
   * )
   * ```
   */
  <A extends Row>(sql: LazyArg<string>, options?: LiveSqlQueryOptions): CastArray<A> /**
   * React hook for live Effect queries
   * @param effect The Effect Query
   * @param options Configuration options
   * @returns The query results
   *
   * @example
   * ```tsx
   * // Basic usage
   * const users = useLiveQuery<User[]>(() => sql`SELECT * FROM users`))
   */
  <A>(effect: Effect.Effect<A, SqlError, SqlClient.SqlClient>, options?: LiveEffectQueryOptions): CastArray<A>
} = createQueryHooks(null as any)
