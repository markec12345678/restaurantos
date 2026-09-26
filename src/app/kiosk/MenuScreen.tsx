'use client'

import { memo } from 'react'
import Image from 'next/image'
import type { KioskMenu, KioskMenuItem } from './types'
import { formatEUR } from '@/lib/safe-format'
import { grossPrice } from './useKioskCart'

// =====================================================================
// MENU zaslon — kategorije (veliki čipi) + velike kartice artiklov.
// Touch-first: min 64px tarče, velike pisave, visok kontrast; mreža
// prilagodljiva 1280×800 landscape (2–3 stolpci) in portrait (1–2 stolpca).
// Cena: GROSS = NETO × (1 + DDV/100) — ist prikazni kanon kot MenuStep.
// Sold-out (R124): gray-out + badge "Izprodano", tap onemogočen.
// Low stock: badge "Na zalogi: N <enota>".
// =====================================================================

// Kiosk-lokalna kopija alergenov (EU 1169/2011) — isti vzorec kot
// qr-menu/constants.ts (namerna duplikacija, da kiosk ni povezan na /order modul)
const ALLERGEN_DATA: Record<string, { label: string; icon: string }> = {
  '1': { label: 'Gluten', icon: '🌾' },
  '2': { label: 'Raki', icon: '🦐' },
  '3': { label: 'Jajca', icon: '🥚' },
  '4': { label: 'Ribe', icon: '🐟' },
  '5': { label: 'Arašidi', icon: '🥜' },
  '6': { label: 'Soja', icon: '🫘' },
  '7': { label: 'Mleko', icon: '🥛' },
  '8': { label: 'Oreški', icon: '🌰' },
  '9': { label: 'Zeler', icon: '🥬' },
  '10': { label: 'Gorčica', icon: '🟡' },
  '11': { label: 'Sezam', icon: '⚪' },
  '12': { label: 'Sulfiti', icon: '💨' },
  '13': { label: 'Volčji bob', icon: '🫘' },
  '14': { label: 'Mehkužci', icon: '🐚' },
}

interface MenuScreenProps {
  menus: KioskMenu[]
  activeMenuId: string
  setActiveMenuId: (_id: string) => void
  activeCategoryId: string
  setActiveCategoryId: (_id: string) => void
  onSelectItem: (_item: KioskMenuItem) => void
  cartItemCount: number
  cartTotal: number
  onOpenCart: () => void
  /** 400 unavailableItems obvestilo (izprodani artikli odstranjeni iz košarice) */
  unavailableNames: string[]
}

export const MenuScreen = memo(function MenuScreen({
  menus, activeMenuId, setActiveMenuId, activeCategoryId, setActiveCategoryId,
  onSelectItem, cartItemCount, cartTotal, onOpenCart, unavailableNames,
}: MenuScreenProps) {
  const activeMenu = menus.find(m => m.id === activeMenuId) ?? menus[0]
  const activeCategory = activeMenu?.categories.find(c => c.id === activeCategoryId) ?? activeMenu?.categories[0]
  const items = activeCategory?.menuItems ?? []

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-4 pb-40">
        {unavailableNames.length > 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800" role="alert">
            <p className="font-bold">Nekateri artikli so žal izprodani in so odstranjeni:</p>
            <p className="mt-1">{unavailableNames.join(', ')}</p>
          </div>
        )}
        <h1 className="text-2xl font-bold mb-4">{activeMenu?.name ?? 'Meni'}</h1>

        {/* Zavihki menijev (samo če lokacija ima več aktivnih menijev) */}
        {menus.length > 1 && (
          <nav className="flex gap-3 overflow-x-auto pb-3 mb-3" aria-label="Meniji">
            {menus.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMenuId(m.id)}
                className={`flex-shrink-0 min-h-[64px] px-6 rounded-2xl text-lg font-bold transition touch-manipulation ${
                  activeMenu?.id === m.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 shadow-sm border border-gray-200'
                }`}
              >
                {m.name}
              </button>
            ))}
          </nav>
        )}

        {/* Čipi kategorij */}
        {activeMenu && activeMenu.categories.length > 0 && (
          <nav className="flex gap-3 overflow-x-auto pb-2" aria-label="Kategorije menija">
            {activeMenu.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`flex-shrink-0 min-h-[64px] px-6 rounded-2xl text-lg font-semibold transition touch-manipulation ${
                  activeCategory?.id === cat.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 shadow-sm border border-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        {/* Kartice artiklov */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3" aria-hidden="true">🍽</p>
            <p className="text-xl text-gray-500">Za to kategorijo ni artiklov.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map(item => {
              const soldOut = item.stockStatus === 'out'
              const lowStock = item.stockStatus === 'low' && item.stockAvailable != null
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  disabled={soldOut}
                  aria-label={`${item.name}, ${formatEUR(grossPrice(item.price, item.vatRate))}${soldOut ? ', izprodano' : ''}`}
                  className={`text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition active:scale-[0.98] touch-manipulation ${
                    soldOut ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div className="relative w-full h-36">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                        <span className="text-5xl" aria-hidden="true">🍽</span>
                      </div>
                    )}
                    {soldOut && (
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold">
                        Izprodano
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                      <span className="flex-shrink-0 font-bold text-lg text-blue-700">
                        {formatEUR(grossPrice(item.price, item.vatRate))}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {lowStock && (
                      <p className="text-sm font-semibold text-amber-600 mt-1">
                        Na zalogi: {item.stockAvailable}{item.stockUnit ? ` ${item.stockUnit}` : ''}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex flex-wrap gap-1" aria-label="Alergeni">
                        {item.allergens.slice(0, 6).map(a => {
                          const ad = ALLERGEN_DATA[a]
                          return ad ? (
                            <span key={a} className="text-sm" title={ad.label} aria-label={`Alergen: ${ad.label}`}>{ad.icon}</span>
                          ) : null
                        })}
                      </div>
                      <span className={`text-sm font-semibold ${soldOut ? 'text-gray-400' : 'text-blue-600'}`}>
                        {soldOut ? 'Ni na voljo' : 'Dodaj +'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Plavajoča vrstica košarice (min 64px tarča) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30 max-w-5xl mx-auto">
          <button
            onClick={onOpenCart}
            className="w-full min-h-[64px] bg-blue-600 text-white py-3 px-6 rounded-2xl shadow-2xl shadow-blue-600/30 flex items-center justify-between text-lg font-bold hover:bg-blue-700 active:scale-[0.99] transition touch-manipulation"
          >
            <span className="flex items-center gap-3">
              <span className="bg-white/20 rounded-xl px-3 py-1 text-lg tabular-nums">{cartItemCount}</span>
              Košarica
            </span>
            <span className="tabular-nums">{formatEUR(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
})
