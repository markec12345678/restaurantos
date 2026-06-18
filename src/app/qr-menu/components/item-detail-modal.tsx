'use client';

import { memo, type RefObject } from 'react';
import type { MenuItem, Modifier, ModifierGroup } from '../types';
import type { FontSize } from '../use-qr-menu';
import { ALLERGEN_DATA } from '../constants';
import { safeToFixed, safeNum } from '@/lib/safe-format'

export interface ItemDetailModalProps {
  item: MenuItem;
  isDark: boolean;
  isHighContrast: boolean;
  fontSize: FontSize;
  selectedMods: Modifier[];
  itemNotes: string;
  itemDetailRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onToggleModifier: (_mod: Modifier, _mg: ModifierGroup) => void;
  onNotesChange: (_notes: string) => void;
  onAddToCart: () => void;
}

export const ItemDetailModal = memo(function ItemDetailModal({
  item,
  isDark,
  isHighContrast,
  selectedMods,
  itemNotes,
  itemDetailRef,
  onClose,
  onToggleModifier,
  onNotesChange,
  onAddToCart,
}: ItemDetailModalProps) {
  return (
    <div ref={itemDetailRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Podrobnosti: ${item.name}`} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold truncate pr-4">{item.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri podrobnosti">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          {/* ===== ITEM IMAGE ===== */}
          {item.image && (
            <div className="relative w-full h-48 rounded-2xl overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}
          {item.description && (
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>
          )}
          {/* ===== ALLERGENI 2.0: Podrobni prikaz z barvnimi kodi ===== */}
          {item.allergens && (
            <div>
              <p className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                ALERGENI (EU 1169/2011)
              </p>
              <div className="flex flex-wrap gap-1.5" role="list" aria-label="Seznam alergenov">
                {item.allergens.split(',').filter(Boolean).map(a => {
                  const aData = ALLERGEN_DATA[a.trim()];
                  if (!aData) return null;
                  return (
                    <span key={a} role="listitem"
                      className={`text-xs px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${isHighContrast ? aData.highContrastColor : aData.color}`}
                    >
                      <span aria-hidden="true">{aData.icon}</span>
                      {aData.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* Modifier Groups */}
          {item.modifierGroups?.map(({ modifierGroup: mg }) => (
            <div key={mg.id}>
              <div className="flex items-baseline gap-2 mb-2">
                <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{mg.name}</p>
                {mg.required && <span className="text-xs text-red-500 font-bold">*obvezno</span>}
              </div>
              <div className="space-y-1.5" role="group" aria-label={mg.name}>
                {mg.modifiers.map(mod => {
                  const isSelected = selectedMods.find(m => m.id === mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => onToggleModifier(mod, mg)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-sm transition ${
                        isSelected
                          ? `${isDark ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-amber-100 border-amber-300 text-amber-800'} border`
                          : `${isDark ? 'bg-gray-800/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'} border`
                      }`}
                      role="checkbox"
                      aria-checked={!!isSelected}
                      aria-label={`${mod.name}${mod.price > 0 ? ` +€${safeToFixed(mod.price, 2)}` : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                          isSelected ? 'bg-amber-500 border-amber-500' : `${isDark ? 'border-gray-600' : 'border-gray-300'}`
                        }`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        {mod.name}
                      </span>
                      {mod.price > 0 && <span className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>+€{safeToFixed(mod.price, 2)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Notes */}
          <div>
            <label htmlFor="item-notes" className={`text-xs font-semibold mb-1 block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OPOMBE</label>
            <textarea
              id="item-notes"
              value={itemNotes}
              onChange={e => onNotesChange(e.target.value)}
              placeholder="Npr. brez česna, alergija na..."
              rows={2}
              className={`w-full p-3 rounded-xl text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} border focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
            />
          </div>
          {/* Add to cart button */}
          <button
            onClick={onAddToCart}
            className={`w-full ${isDark ? 'bg-amber-500 hover:bg-amber-400 text-gray-900' : 'bg-amber-500 hover:bg-amber-600 text-white'} py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition shadow-lg shadow-amber-500/30`}
            aria-label={`Dodaj v košarico. Skupaj €${((item.price + selectedMods.reduce((s, m) => s + m.price, 0)) * (1 + item.vatRate / 100)).toFixed(2)} z DDV`}
          >
            Dodaj v košarico · €{((item.price + selectedMods.reduce((s, m) => s + m.price, 0)) * (1 + item.vatRate / 100)).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
});
