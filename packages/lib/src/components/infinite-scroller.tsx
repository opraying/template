import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

export const InfiniteScroller = (props: {
  children: ReactNode
  loading: boolean
  loadNext: () => void
  scrollEndDistance?: number | undefined
}) => {
  const { children, loadNext, loading, scrollEndDistance } = props
  const scrollListener = useRef(loadNext)

  useEffect(() => {
    scrollListener.current = loadNext
  }, [loadNext])

  const onScroll = () => {
    const documentHeight = document.documentElement.scrollHeight
    const scrollDifference = Math.floor(window.innerHeight + window.scrollY)
    const scrollEnded = documentHeight - scrollDifference <= (scrollEndDistance || 20)

    if (scrollEnded && !loading) {
      scrollListener.current()
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', onScroll)
    }

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return children
}
