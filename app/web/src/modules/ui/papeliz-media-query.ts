import { useCallback, useSyncExternalStore } from 'react'

// True while the CSS media query matches; follows window resizes.
export function usePapelizMediaQuery(mediaQueryText: string): boolean {
  const subscribeToMediaQuery = useCallback(
    (onMediaQueryChange: () => void) => {
      const mediaQueryList = window.matchMedia(mediaQueryText)
      mediaQueryList.addEventListener('change', onMediaQueryChange)
      return () => mediaQueryList.removeEventListener('change', onMediaQueryChange)
    },
    [mediaQueryText],
  )
  return useSyncExternalStore(subscribeToMediaQuery, () => window.matchMedia(mediaQueryText).matches)
}
