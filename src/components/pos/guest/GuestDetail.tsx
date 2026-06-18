'use client'

import { memo } from 'react'
import { type GuestData, parseJsonField } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// --- Props ---

interface GuestDetailProps {
  guest: GuestData
  onBack: () => void
  onToggleVip: (_id: string, _isVip: boolean) => void
}

// --- Komponenta: Podrobnosti gosta ---

export const GuestDetail = memo(function GuestDetail({
  guest,
  onBack,
  onToggleVip,
}: GuestDetailProps) {
  return (
    <div className="w-2/3 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-600">← Nazaj</button>
          <h3 className="text-lg font-bold">{guest.firstName} {guest.lastName}</h3>
          <button
            onClick={() => onToggleVip(guest.id, guest.isVip)}
            className={`px-2 py-1 rounded text-xs font-medium ${
              guest.isVip ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {guest.isVip ? '👑 VIP' : 'Označi VIP'}
          </button>
        </div>
      </div>

      {/* Statistične kartice */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{guest.totalVisits}</p>
          <p className="text-xs text-blue-500">Obiski</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">€{safeToFixed(guest.totalSpent, 0)}</p>
          <p className="text-xs text-green-500">Skupaj</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">€{safeToFixed(guest.avgCheckAmount, 2)}</p>
          <p className="text-xs text-purple-500">Povpr. ček</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">
            {guest.loyaltyAccount?.pointsBalance != null ? String(guest.loyaltyAccount.pointsBalance) : 0}
          </p>
          <p className="text-xs text-amber-500">Točke</p>
        </div>
      </div>

      {/* Informacijska mreža */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">KONTAKT</h4>
          <p className="text-sm">📧 {guest.email || '-'}</p>
          <p className="text-sm">📱 {guest.phone || '-'}</p>
          <p className="text-sm">🏢 {guest.company || '-'}</p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">DATUMI</h4>
          <p className="text-sm">🎂 {guest.birthday ? new Date(guest.birthday).toLocaleDateString('sl-SI') : '-'}</p>
          <p className="text-sm">💍 {guest.anniversary ? new Date(guest.anniversary).toLocaleDateString('sl-SI') : '-'}</p>
          <p className="text-sm">📅 Prvi obisk: {guest.firstVisitAt ? new Date(guest.firstVisitAt).toLocaleDateString('sl-SI') : '-'}</p>
        </div>
      </div>

      {/* Alergeni in preference */}
      <div className="bg-white border rounded-lg p-3 mb-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">ALERGENI & PREFERENCE</h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {parseJsonField(guest.allergens).map((a: string) => (
            <span key={a} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">⚠️ {a}</span>
          ))}
          {parseJsonField(guest.allergens).length === 0 && (
            <span className="text-xs text-gray-500">Bez alergenov</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {parseJsonField(guest.dietaryPrefs).map((p: string) => (
            <span key={p} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">🥬 {p}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {parseJsonField(guest.dislikes).map((d: string) => (
            <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">👎 {d}</span>
          ))}
        </div>
      </div>

      {/* Najljubše jedi */}
      <div className="bg-white border rounded-lg p-3 mb-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">NAJLJUBŠE JEDI</h4>
        <div className="flex flex-wrap gap-1.5">
          {parseJsonField(guest.favoriteItems).map((item: string) => (
            <span key={item} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">❤️ {item}</span>
          ))}
          {parseJsonField(guest.favoriteItems).length === 0 && (
            <span className="text-xs text-gray-500">Ni zaznanih preferenc</span>
          )}
        </div>
      </div>

      {/* Zadnji obiski */}
      <div className="bg-white border rounded-lg p-3 mb-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">ZADNJI OBISKI</h4>
        {guest.visits?.slice(0, 5).map((visit, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
            <div>
              <span className="text-sm">{visit.arrivedAt ? new Date(visit.arrivedAt).toLocaleDateString('sl-SI') : '-'}</span>
              {visit.employeeName != null && <span className="text-xs text-gray-500 ml-2"> Strežil: {String(visit.employeeName)}</span>}
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">€{safeToFixed(visit.totalSpent ?? 0, 2)}</span>
              {visit.feedbackScore != null && <span className="text-xs text-amber-500 ml-2">{'⭐'.repeat(visit.feedbackScore)}</span>}
            </div>
          </div>
        ))}
        {(!guest.visits || guest.visits.length === 0) && (
          <p className="text-xs text-gray-500">Ni zabeleženih obiskov</p>
        )}
      </div>

      {/* Opombe */}
      {guest.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-700 mb-1">📝 Opombe</h4>
          <p className="text-sm text-yellow-800">{guest.notes}</p>
        </div>
      )}
    </div>
  )
})
