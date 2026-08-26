'use client'

import { memo } from 'react'
import type { MenuItem, Modifier, ModifierGroup } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// =====================================================================
// MODAL ZA PODROBNOSTI ARTIKLA
// =====================================================================

interface ItemDetailModalProps {
  isDark: boolean
  showItemDetail: MenuItem
  itemNotes: string
  setItemNotes: (_notes: string) => void
  selectedMods: Modifier[]
  toggleModifier: (_mod: Modifier, _group: ModifierGroup) => void
  addToCart: (_item: MenuItem, _modifiers?: Modifier[], _notes?: string) => void
  setShowItemDetail: (_item: MenuItem | null) => void
}

export const ItemDetailModal = memo(function ItemDetailModal({
  isDark, showItemDetail, itemNotes, setItemNotes, selectedMods,
  toggleModifier, addToCart, setShowItemDetail,
}: ItemDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowItemDetail(null)} />
      <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">{showItemDetail.name}</h3>
          <button onClick={() => setShowItemDetail(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          {showItemDetail.image && (
            <img src={showItemDetail.image} alt={showItemDetail.name} className="w-full h-48 object-cover rounded-xl" />
          )}
          {showItemDetail.description && <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{showItemDetail.description}</p>}
          <p className={`font-bold text-lg ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            €{(showItemDetail.price * (1 + showItemDetail.vatRate / 100)).toFixed(2)} <span className="text-xs text-gray-400">z DDV</span>
          </p>

          {showItemDetail.modifierGroups?.map(mg => (
            <div key={mg.modifierGroup.id}>
              <p className="font-semibold text-sm mb-2">
                {mg.modifierGroup.name}
                {mg.modifierGroup.required && <span className="text-red-500 ml-1">*Obvezno</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {mg.modifierGroup.modifiers.map(mod => {
                  const selected = selectedMods.some(m => m.id === mod.id)
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModifier(mod, mg.modifierGroup)}
                      className={`p-2 rounded-xl border text-left text-sm transition ${
                        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : `${isDark ? 'border-gray-700' : 'border-gray-200'}`
                      }`}
                    >
                      <span className="font-medium">{mod.name}</span>
                      {mod.price > 0 && <span className="text-xs text-gray-500 ml-1">+€{safeToFixed(mod.price, 2)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <textarea
            placeholder="Opombe za to jed..."
            value={itemNotes}
            onChange={e => setItemNotes(e.target.value)}
            rows={2}
            className={`w-full px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'} border focus:ring-2 focus:ring-blue-500/50 focus:outline-none`}
          />

          <button
            onClick={() => addToCart(showItemDetail, selectedMods, itemNotes)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Dodaj v košarico
          </button>
        </div>
      </div>
    </div>
  )
})
