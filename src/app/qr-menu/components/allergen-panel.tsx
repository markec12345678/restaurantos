'use client';

import { memo, type RefObject } from 'react';
import { ALLERGEN_DATA } from '../constants';

export interface AllergenPanelProps {
  isDark: boolean;
  isHighContrast: boolean;
  showAllergenInfo: boolean;
  allergenPanelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export const AllergenPanel = memo(function AllergenPanel({
  isDark,
  isHighContrast,
  showAllergenInfo,
  allergenPanelRef,
  onClose,
}: AllergenPanelProps) {
  if (!showAllergenInfo) return null;

  return (
    <div ref={allergenPanelRef} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Informacije o alergenih" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute bottom-0 left-0 right-0 ${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl shadow-2xl max-h-[80vh] overflow-auto`}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold">Alergeni (EU 1169/2011)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Zapri">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            V skladu z Uredbo EU 1169/2011 smo dolžni obvestiti o prisotnosti 14 alergenov. Alergeni so označeni pri vsaki jedi.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ALLERGEN_DATA).map(([num, data]) => (
              <div key={num} className={`flex items-center gap-2 p-2 rounded-xl border ${isHighContrast ? data.highContrastColor : data.color}`}>
                <span className="text-lg" aria-hidden="true">{data.icon}</span>
                <div>
                  <p className="font-bold text-xs">{data.label}</p>
                  <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{data.labelEn}</p>
                </div>
              </div>
            ))}
          </div>
          <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Obvestite osebje o morebitnih alergijah ali intolerancah pred naročilom.
          </p>
        </div>
      </div>
    </div>
  );
});
