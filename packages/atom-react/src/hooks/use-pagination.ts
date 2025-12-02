import * as Registry from '@effect-atom/atom/Registry'
import * as Result from '@effect-atom/atom/Result'
import * as Atom from '@effect-atom/atom/Atom'
import { useAtomSet, useAtomSuspense, useAtomValue } from '@xstack/atom-react/react'
import * as Deferred from 'effect/Deferred'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import type * as Stream from 'effect/Stream'
/**
 * Creates a pagination that accumulates loaded data in memory.
 *
 * Key features:
 * - Caches loaded data in memory for quick navigation
 * - Supports forward and backward navigation
 * - Maintains data continuity across page transitions
 *
 * Best suited for:
 * - Lists that need quick back/forward navigation
 * - Small to medium tables where caching improves UX
 * - Infinite scroll feeds with preserved scroll position
 * - Any scenario where keeping loaded data improves performance
 *
 * Memory considerations:
 * - Data accumulates in memory as more pages are loaded
 * - Best for scenarios with reasonable data size
 * - Consider cleanup strategies for long-running sessions
 *
 * @example
 * ```tsx
 * const feed = makeCachingPaginationAtom(
 *   { perPage: 20 },
 *   ({ perPage }) => fetchFeedItems({ perPage })
 * )
 *
 * // In your component
 * const { value, loading, next, previous } = feed.use()
 * ```
 */
export const makeCachingPaginationAtom = <A, E>(
  options: { perPage: number },
  handle: (_: { perPage: number }) => ((get: Atom.Context) => Stream.Stream<A, E>) | Stream.Stream<A, E>,
) => {
  const perPage = options.perPage
  const initialPage = 0
  const dataInResult = (page: number, results: ReadonlyArray<A>) => {
    const range = results.slice(page * perPage, (page + 1) * perPage)
    return range.length > 0
  }
  const pageAtom = Atom.make(initialPage)
  const pull = Atom.pull(handle({ perPage })).pipe(Atom.keepAlive)
  const loadingAtom = Atom.map(pull, (pull) => pull.waiting).pipe(Atom.debounce(Duration.millis(50)))
  const doneAtom = Atom.map(pull, (pull) => pull._tag === 'Success' && pull.value.done)
  const hasNextPageAtom = Atom.make((get) => {
    const pullResult = get(pull)

    if (!Result.isSuccess(pullResult)) {
      return true
    }

    const nextPageNumber = get(pageAtom) + 1

    if (get(doneAtom)) {
      const inRange = dataInResult(nextPageNumber, pullResult.value.items)

      return inRange
    }

    return true
  })
  const hasPrevPageAtom = Atom.make((get) => get(pageAtom) > 0)
  const resultsAtom = Atom.make((ctx) =>
    Effect.gen(function* () {
      const pullResult = yield* ctx.result(pull).pipe(Effect.optionFromOptional)
      const pageNumber = ctx.get(pageAtom)

      if (Option.isNone(pullResult)) return [] as Array<A>

      const {
        value: { items },
      } = pullResult

      const data = items.slice(pageNumber * perPage, (pageNumber + 1) * perPage)

      return data
    }),
  )
  const nextAtom = Atom.fn((_: void) =>
    Effect.gen(function* () {
      const reg = yield* Registry.AtomRegistry
      const nextPageNumber = reg.get(pageAtom) + 1
      const pullResult = reg.get(pull)

      if (pullResult._tag !== 'Success') return

      const {
        value: { items },
      } = pullResult

      const hasNextPageData = dataInResult(nextPageNumber, items)
      if (hasNextPageData) {
        reg.set(pageAtom, nextPageNumber)
        return
      }

      const deferred = yield* Deferred.make<void>()

      yield* Deferred.await(deferred).pipe(
        Effect.tap(() => reg.set(pageAtom, nextPageNumber)),
        Effect.forkScoped,
      )

      reg.subscribe(pull, (state) => {
        if (Result.isSuccess(state) && state.value.done) {
          return
        }

        if (!state.waiting) {
          Effect.runSync(Deferred.succeed(deferred, undefined))
        }
      })

      reg.set(pull, undefined)
      const result = reg.get(pull)
      if (result._tag === 'Success' && result.value.done) {
        return
      }
    }),
  )
  const previousAtom = Atom.fn((_: void, ctx) =>
    Effect.gen(function* () {
      const reg = yield* Registry.AtomRegistry
      const page = reg.get(pageAtom)
      if (page === 0) return

      ctx.set(pageAtom, page - 1)
    }),
  )
  const resetAtom = Atom.fn((_: void, ctx) =>
    Effect.gen(function* () {
      ctx.set(pageAtom, initialPage)
      ctx.refresh(pull)
    }),
  )

  return {
    page: pageAtom,
    loading: loadingAtom,
    done: doneAtom,
    hasNextPage: hasNextPageAtom,
    hasPrevPage: hasPrevPageAtom,
    next: nextAtom,
    previous: previousAtom,
    value: resultsAtom,
    use: () => {
      const page = useAtomValue(pageAtom)
      const loading = useAtomValue(loadingAtom)
      const done = useAtomValue(doneAtom)
      const hasNextPage = useAtomValue(hasNextPageAtom)
      const hasPrevPage = useAtomValue(hasPrevPageAtom)
      const next = useAtomSet(nextAtom, { mode: 'promise' })
      const previous = useAtomSet(previousAtom, { mode: 'promise' })
      const { value } = useAtomSuspense(resultsAtom)
      const reset = useAtomSet(resetAtom, { mode: 'promise' })

      return {
        page,
        loading,
        done,
        hasNextPage,
        hasPrevPage,
        next,
        previous,
        value,
        reset,
      }
    },
  }
}

/**
 * Creates a traditional pagination with page numbers and total count.
 *
 * Key features:
 * - Maintains only current page data in memory
 * - Supports direct page navigation
 * - Provides total items and pages count
 *
 * Best suited for:
 * - Data tables with server-side pagination
 * - Search results with known total count
 * - Admin interfaces and dashboards
 * - Any scenario requiring explicit page navigation
 *
 * Performance considerations:
 * - Efficient memory usage (only current page)
 * - Each page navigation triggers a new request
 * - Ideal for large datasets where caching is impractical
 *
 * @example
 * ```tsx
 * const table = makeTablePaginationAtom(
 *   { perPage: 10 },
 *   ({ page, perPage }) => fetchTableData({ page, perPage })
 * )
 *
 * // In your component
 * const { value, page, totalPages, goToPage } = table.use()
 * ```
 */
export const makeTablePaginationAtom = <A, E>(
  options: { perPage: number },
  handle: (_: { page: number; perPage: number }) => Effect.Effect<{ items: A; total: number }, E>,
) => {
  const perPage = options.perPage
  const initialPage = 1
  const pageAtom = Atom.make(initialPage)
  const totalItemsAtom = Atom.make(0)
  const totalPagesAtom = Atom.map(totalItemsAtom, (totalItems) => Math.ceil(totalItems / perPage))
  const pull = Atom.make((get) =>
    Effect.gen(function* () {
      const page = get(pageAtom)
      const result = yield* handle({ page, perPage })
      if (get(totalItemsAtom) !== result.total) {
        get.set(totalItemsAtom, result.total)
      }
      return result.items
    }),
  ).pipe(Atom.keepAlive)
  const loadingAtom = Atom.map(pull, (pull) => pull.waiting).pipe(Atom.debounce(Duration.millis(50)))
  const hasNextPageAtom = Atom.make((get) => get(pageAtom) < get(totalPagesAtom))
  const hasPrevPageAtom = Atom.make((get) => get(pageAtom) > 1)
  const goToPageAtom = Atom.fn((page: number) =>
    Effect.gen(function* () {
      const reg = yield* Registry.AtomRegistry
      const totalPages = reg.get(totalPagesAtom)
      const targetPage = Math.max(1, Math.min(page, totalPages))
      if (targetPage === reg.get(pageAtom)) return
      reg.set(pageAtom, targetPage)
    }),
  )
  const nextAtom = Atom.fn((_: void) =>
    Effect.gen(function* () {
      const reg = yield* Registry.AtomRegistry
      const page = reg.get(pageAtom)
      const totalPages = reg.get(totalPagesAtom)
      if (page >= totalPages) return
      reg.set(goToPageAtom, page + 1)
    }),
  )
  const previousAtom = Atom.fn((_: void) =>
    Effect.gen(function* () {
      const reg = yield* Registry.AtomRegistry
      const page = reg.get(pageAtom)
      if (page <= 1) return
      reg.set(goToPageAtom, page - 1)
    }),
  )
  const resetAtom = Atom.fn((_: void, ctx) =>
    Effect.gen(function* () {
      ctx.set(pageAtom, initialPage)
    }),
  )

  return {
    page: pageAtom,
    totalItems: totalItemsAtom,
    totalPages: totalPagesAtom,
    loading: loadingAtom,
    hasNextPage: hasNextPageAtom,
    hasPrevPage: hasPrevPageAtom,
    goToPage: goToPageAtom,
    next: nextAtom,
    previous: previousAtom,
    value: pull,
    reset: resetAtom,
    use: () => {
      const page = useAtomValue(pageAtom)
      const totalItems = useAtomValue(totalItemsAtom)
      const totalPages = useAtomValue(totalPagesAtom)
      const loading = useAtomValue(loadingAtom)
      const hasNextPage = useAtomValue(hasNextPageAtom)
      const hasPrevPage = useAtomValue(hasPrevPageAtom)
      const goToPage = useAtomSet(goToPageAtom, { mode: 'promise' })
      const next = useAtomSet(nextAtom, { mode: 'promise' })
      const previous = useAtomSet(previousAtom)
      const { value } = useAtomSuspense(pull)
      const reset = useAtomSet(resetAtom, { mode: 'promise' })

      return {
        page,
        totalItems,
        totalPages,
        loading,
        hasNextPage,
        hasPrevPage,
        goToPage,
        next,
        previous,
        value,
        reset,
      }
    },
  }
}

/**
 * Creates a continuous loading stream without page slicing.
 *
 * Key features:
 * - Continuous data loading without pagination breaks
 * - Maintains accumulated data for smooth display
 * - Simple loadMore-based navigation
 *
 * Best suited for:
 * - Infinite scroll layouts
 * - Masonry/Pinterest style grids
 * - Dynamic content feeds
 * - Any scenario requiring seamless data continuation
 *
 * Implementation notes:
 * - Works well with virtual scrolling
 * - Can be combined with lazy loading
 * - Suitable for both uniform and variable-sized content
 *
 * @example
 * ```tsx
 * const feed = makeContinuousLoadAtom(
 *   { batchSize: 20 },
 *   ({ batchSize }) => fetchItems({ batchSize })
 * )
 *
 * // In your component
 * const { value, loading, loadMore } = feed.use()
 * ```
 */
export const makeContinuousLoadAtom = <A, E>(
  options: { batchSize: number },
  handle: (_: { batchSize: number }) => ((get: Atom.Context) => Stream.Stream<A, E>) | Stream.Stream<A, E>,
) => {
  const batchSize = options.batchSize
  const pull = Atom.pull(handle({ batchSize })).pipe(Atom.keepAlive)
  const loadingAtom = Atom.map(pull, (pull) => pull.waiting).pipe(Atom.debounce(Duration.millis(50)))
  const doneAtom = Atom.map(pull, (pull) => pull._tag === 'Success' && pull.value.done)
  const hasNextAtom = Atom.make((get) => !get(doneAtom))
  const resultsAtom = Atom.make((ctx) =>
    Effect.gen(function* () {
      const pullResult = yield* ctx.result(pull).pipe(Effect.optionFromOptional)

      if (Option.isNone(pullResult)) return [] as Array<A>

      const {
        value: { items },
      } = pullResult

      return items
    }),
  )
  const loadMoreAtom = Atom.fn((_: void, ctx) => Effect.sync(() => ctx.set(pull, undefined)))
  const resetAtom = Atom.fn((_: void, ctx) => Effect.sync(() => ctx.refresh(pull)))

  return {
    loading: loadingAtom,
    done: doneAtom,
    hasNext: hasNextAtom,
    loadMore: loadMoreAtom,
    value: resultsAtom,
    reset: resetAtom,
    use: () => {
      const loading = useAtomValue(loadingAtom)
      const done = useAtomValue(doneAtom)
      const hasNext = useAtomValue(hasNextAtom)
      const loadMore = useAtomSet(loadMoreAtom, { mode: 'promise' })
      const { value } = useAtomSuspense(resultsAtom)
      const reset = useAtomSet(resetAtom, { mode: 'promise' })

      return {
        loading,
        done,
        hasNext,
        loadMore,
        value,
        reset,
      }
    },
  }
}
