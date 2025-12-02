import { useLayoutEffect } from 'react'

export function useLinkHandler(
  handle: (
    href: string,
    {
      replace,
      viewTransition,
    }: {
      replace?: boolean
      viewTransition?: boolean
    },
  ) => void,
) {
  useLayoutEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.target) {
        return
      }
      const link = (e.target as Element).closest('a')
      if (
        link &&
        link instanceof HTMLAnchorElement &&
        link.href &&
        (!link.target || link.target === '_self') &&
        link.origin === location.origin &&
        !link.hasAttribute('download') &&
        e.button === 0 && // left clicks only
        !e.metaKey && // open in new tab (mac)
        !e.ctrlKey && // open in new tab (windows)
        !e.altKey && // download
        !e.shiftKey &&
        !e.defaultPrevented
      ) {
        e.preventDefault()
        const hasReplace = link.hasAttribute('data-replace')
        const hasViewTransition = link.hasAttribute('data-view-transition')

        handle(link.href, {
          replace: hasReplace,
          viewTransition: hasViewTransition,
        })
      }
    }

    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
    }
  }, [handle])
}
