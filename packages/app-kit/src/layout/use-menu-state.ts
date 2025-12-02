import { useCallback, useState } from 'react'

/**
 * Hook for managing menu item interactions and state
 */
export function useMenuInteractions() {
  const [focusedItem, setFocusedItem] = useState<string | null>(null)
  const [pressedItem, setPressedItem] = useState<string | null>(null)

  const handleItemFocus = useCallback((itemId: string) => {
    setFocusedItem(itemId)
  }, [])

  const handleItemBlur = useCallback(() => {
    setFocusedItem(null)
  }, [])

  const handleItemPress = useCallback((itemId: string) => {
    setPressedItem(itemId)
    // Clear pressed state after animation
    setTimeout(() => setPressedItem(null), 150)
  }, [])

  return {
    focusedItem,
    pressedItem,
    handleItemFocus,
    handleItemBlur,
    handleItemPress,
    isItemFocused: (itemId: string) => focusedItem === itemId,
    isItemPressed: (itemId: string) => pressedItem === itemId,
  }
}
