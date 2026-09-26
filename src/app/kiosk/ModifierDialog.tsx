'use client'

import { memo, useMemo, useState } from 'react'
import Image from 'next/image'
import type { KioskMenuItem, KioskModifierGroup, SelectedModifier } from './types'
import { formatEUR } from '@/lib/safe-format'
import { grossPrice } from './useKioskCart'

// =====================================================================
// MODIFIER dialog — odpri se ob tapu artikla Z modifierGroups (P1-11).
//  - obvezne skupine morajo biti izpolnjene PRED add-to-cart
//  - minSelect mora biti dosežen, maxSelect se spoštuje
//    (presežek zamenja najstarejšo izbiro — isti vzorec kot
//    useOnlineOrder/cart-utils toggleModifierLogic)
//  - vsaka izbira doda svojo ceno (prikaz skupaj v gumbu "Dodaj")
// Opombe per artikel niso tukaj — urejajo se v košarici (brief: cart notes).
// =====================================================================

interface ModifierDialogProps {
  item: KioskMenuItem
  onConfirm: (_modifiers: SelectedModifier[]) => void
  onClose: () => void
}

/** Minimalno št. izbir za skupino: required → vsaj 1; minSelect lahko dvigne */
function minNeeded(group: KioskModifierGroup): number {
  return Math.max(group.required ? 1 : 0, group.minSelect ?? 0)
}

function toggleSelected(
  prev: SelectedModifier[],
  mod: SelectedModifier,
  group: KioskModifierGroup,
): SelectedModifier[] {
  const groupMods = prev.filter(m => group.modifiers.some(gm => gm.id === m.id))
  const otherMods = prev.filter(m => !group.modifiers.some(gm => gm.id === m.id))
  const exists = groupMods.find(m => m.id === mod.id)
  if (exists) return [...otherMods, ...groupMods.filter(m => m.id !== mod.id)]
  if (group.maxSelect != null && groupMods.length >= group.maxSelect) {
    return [...otherMods, ...groupMods.slice(1), mod]
  }
  return [...otherMods, mod]
}

export const ModifierDialog = memo(function ModifierDialog({ item, onConfirm, onClose }: ModifierDialogProps) {
  const [selected, setSelected] = useState<SelectedModifier[]>([])

  const unsatisfiedGroups = useMemo(
    () => item.modifierGroups
      .map(g => g.modifierGroup)
      .filter(group => selected.filter(m => group.modifiers.some(gm => gm.id === m.id)).length < minNeeded(group)),
    [item, selected],
  )

  const modSum = selected.reduce((s, m) => s + (m.price || 0), 0)
  const totalGross = grossPrice(item.price + modSum, item.vatRate)
  const canAdd = unsatisfiedGroups.length === 0

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white rounded-t-3xl">
          <h3 className="font-bold text-xl">{item.name}</h3>
          <button
            onClick={onClose}
            className="w-16 h-16 -mr-2 flex items-center justify-center text-3xl text-gray-400 hover:text-gray-700 touch-manipulation"
            aria-label="Zapri"
          >
            &times;
          </button>
        </div>
        <div className="p-4 space-y-5">
          {item.image && (
            <div className="relative w-full h-44">
              <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover rounded-xl" />
            </div>
          )}
          {item.description && <p className="text-base text-gray-600">{item.description}</p>}
          <p className="font-bold text-xl text-blue-700">
            {formatEUR(grossPrice(item.price, item.vatRate))} <span className="text-sm font-normal text-gray-400">z DDV</span>
          </p>

          {item.modifierGroups.map(({ modifierGroup: group }) => {
            const inGroup = selected.filter(m => group.modifiers.some(gm => gm.id === m.id)).length
            return (
              <div key={group.id}>
                <p className="font-semibold text-lg mb-2">
                  {group.name}
                  {group.required && <span className="text-red-600 ml-2">*Obvezno</span>}
                  {group.maxSelect != null && <span className="text-sm font-normal text-gray-500 ml-2">(največ {group.maxSelect})</span>}
                  {inGroup > 0 && <span className="text-sm font-normal text-gray-500 ml-2 tabular-nums">izbrano {inGroup}</span>}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.modifiers.map(mod => {
                    const isSelected = selected.some(m => m.id === mod.id)
                    return (
                      <button
                        key={mod.id}
                        onClick={() => setSelected(prev => toggleSelected(prev, { id: mod.id, name: mod.name, price: mod.price }, group))}
                        aria-pressed={isSelected}
                        className={`min-h-[64px] px-4 py-3 rounded-2xl border text-left text-lg transition active:scale-[0.98] touch-manipulation ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 font-semibold'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className="font-medium">{mod.name}</span>
                        {mod.price > 0 && <span className="text-blue-700 ml-2">+{formatEUR(mod.price)}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            onClick={() => onConfirm(selected)}
            disabled={!canAdd}
            className={`w-full min-h-[64px] rounded-2xl text-xl font-bold transition active:scale-[0.99] touch-manipulation ${
              canAdd
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canAdd
              ? <>Dodaj v košarico · {formatEUR(totalGross)}</>
              : <>Izberite: {unsatisfiedGroups.map(g => g.name).join(', ')}</>}
          </button>
        </div>
      </div>
    </div>
  )
})
