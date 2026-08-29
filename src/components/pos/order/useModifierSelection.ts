'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { SelectedModifier } from '@/lib/store'
import type { ModifierGroupType, MenuItemType } from './types'

// ============================================
// HOOK: Stanje in logika za modifier dialog
// ============================================

interface UseModifierSelectionParams {
  onAddToCart: (_item: { id: string; name: string; price: number; categoryId: string; image: string; modifiers?: SelectedModifier[] }) => void
  onSetLastAddedId: (_id: string | null) => void
}

export function useModifierSelection({
  onAddToCart,
  onSetLastAddedId,
}: UseModifierSelectionParams) {
  const [modifierDialogItem, setModifierDialogItem] = useState<MenuItemType | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, SelectedModifier>>(new Map())

  const handleItemClick = useCallback((item: MenuItemType, stockInfo?: { status: string; available: number }) => {
    if (stockInfo?.status === 'out') {
      toast.error(`"${item.name}" ni na zalogi!`, { description: 'Artikla ni mogoče naročiti.' })
      return
    }
    if (stockInfo?.status === 'low') {
      toast.warning(`Nizka zaloga: "${item.name}"`, { description: `Na voljo samo ${stockInfo.available} servisov.` })
    }
    // FIX: Preveri ali artikel dejansko ima modifierGroups z vsaj enim modifierjem.
    // Prej: if (item.modifierGroups?.length > 0) — to je odprlo dialog tudi za prazne skupine
    // (modifierGroup brez modifiers). Uporabnik je moral klikniti "Potrdi" za nič.
    // Sedaj: dialog se odpre samo če vsaj ena skupina ima vsaj 1 modifier.
    const hasAvailableModifiers = item.modifierGroups?.some(
      mg => mg.modifierGroup?.modifiers && mg.modifierGroup.modifiers.length > 0
    ) ?? false

    if (hasAvailableModifiers) {
      setModifierDialogItem(item)
      setSelectedModifiers(new Map())
    } else {
      // Artikel brez modifierjev (ali s praznimi skupinami) — direktno v košarico
      onAddToCart({ id: item.id, name: item.name, price: item.price, categoryId: item.categoryId, image: item.image })
      onSetLastAddedId(item.id)
      setTimeout(() => onSetLastAddedId(null), 500)
    }
  }, [onAddToCart, onSetLastAddedId])

  const handleModifierToggle = useCallback((group: ModifierGroupType['modifierGroup'], modifier: { id: string; name: string; price: number }) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev)
      const key = modifier.id
      if (group.maxSelect && !newMap.has(key)) {
        const currentCount = Array.from(newMap.values()).filter(m => m.modifierGroupId === group.id).length
        if (currentCount >= group.maxSelect) {
          const toRemove = Array.from(newMap.entries()).find(([_, v]) => v.modifierGroupId === group.id)
          if (toRemove) newMap.delete(toRemove[0])
        }
      }
      if (newMap.has(key)) { newMap.delete(key) }
      else {
        newMap.set(key, { id: modifier.id, name: modifier.name, price: modifier.price, modifierGroupId: group.id, modifierGroupName: group.name })
      }
      return newMap
    })
  }, [])

  const handleModifierConfirm = useCallback(() => {
    if (!modifierDialogItem) return
    const unmetRequired = modifierDialogItem.modifierGroups
      .filter(mg => mg.modifierGroup.required)
      .filter(mg => {
        const selected = Array.from(selectedModifiers.values()).filter(m => m.modifierGroupId === mg.modifierGroup.id)
        return selected.length < (mg.modifierGroup.minSelect || 1)
      })
    if (unmetRequired.length > 0) {
      toast.error(`Obvezna izbira: ${unmetRequired.map(mg => mg.modifierGroup.name).join(', ')}`)
      return
    }
    const modifiers = Array.from(selectedModifiers.values())
    onAddToCart({ id: modifierDialogItem.id, name: modifierDialogItem.name, price: modifierDialogItem.price, categoryId: modifierDialogItem.categoryId, image: modifierDialogItem.image, modifiers })
    onSetLastAddedId(modifierDialogItem.id)
    setTimeout(() => onSetLastAddedId(null), 500)
    setModifierDialogItem(null)
    setSelectedModifiers(new Map())
  }, [modifierDialogItem, selectedModifiers, onAddToCart, onSetLastAddedId])

  const closeModifierDialog = useCallback(() => {
    setModifierDialogItem(null)
    setSelectedModifiers(new Map())
  }, [])

  const modifierExtraPrice = modifierDialogItem ? Array.from(selectedModifiers.values()).reduce((s, m) => s + m.price, 0) : 0

  return {
    modifierDialogItem,
    selectedModifiers,
    modifierExtraPrice,
    handleItemClick,
    handleModifierToggle,
    handleModifierConfirm,
    closeModifierDialog,
  }
}
