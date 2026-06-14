'use client'

import { memo, useEffect, useCallback } from 'react'
import { type GuestFormRow } from '@/lib/types'
import { ALLERGEN_LIST, DIETARY_OPTIONS } from './constants'

// --- Props ---

interface GuestFormModalProps {
  open: boolean
  form: GuestFormRow
  onFormChange: (_form: GuestFormRow) => void
  onClose: () => void
  onSubmit: () => void
}

// --- Komponenta: Modal za dodajanje novega gosta ---

export const GuestFormModal = memo(function GuestFormModal({
  open,
  form,
  onFormChange,
  onClose,
  onSubmit,
}: GuestFormModalProps) {
  // Escape key handler za zaprtje modala
  const closeForm = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeForm()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeForm])

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Nov gost" className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">Nov gost</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl" aria-label="Zapri">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-firstName" className="text-xs font-medium text-gray-500">Ime</label>
              <input
                id="guest-firstName"
                value={form.firstName || ''}
                onChange={e => onFormChange({ ...form, firstName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="Ime"
              />
            </div>
            <div>
              <label htmlFor="guest-lastName" className="text-xs font-medium text-gray-500">Priimek *</label>
              <input
                id="guest-lastName"
                value={form.lastName || ''}
                onChange={e => onFormChange({ ...form, lastName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="Priimek"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-phone" className="text-xs font-medium text-gray-500">Telefon</label>
              <input
                id="guest-phone"
                value={form.phone || ''}
                onChange={e => onFormChange({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="+386 ..."
              />
            </div>
            <div>
              <label htmlFor="guest-email" className="text-xs font-medium text-gray-500">Email</label>
              <input
                id="guest-email"
                value={form.email || ''}
                onChange={e => onFormChange({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="email@primer.si"
              />
            </div>
          </div>
          <div>
            <label htmlFor="guest-company" className="text-xs font-medium text-gray-500">Podjetje</label>
            <input
              id="guest-company"
              value={form.company || ''}
              onChange={e => onFormChange({ ...form, company: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-birthday" className="text-xs font-medium text-gray-500">Rojstni dan</label>
              <input
                id="guest-birthday"
                type="date"
                value={form.birthday || ''}
                onChange={e => onFormChange({ ...form, birthday: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label htmlFor="guest-anniversary" className="text-xs font-medium text-gray-500">Obletnica</label>
              <input
                id="guest-anniversary"
                type="date"
                value={form.anniversary || ''}
                onChange={e => onFormChange({ ...form, anniversary: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Alergeni</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ALLERGEN_LIST.map(a => {
                const code = a.split('-')[0]
                const selected = (form.allergens || []).includes(code)
                return (
                  <button
                    key={code}
                    onClick={() => onFormChange({
                      ...form,
                      allergens: selected
                        ? (form.allergens ?? []).filter((x: string) => x !== code)
                        : [...(form.allergens ?? []), code],
                    })}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                      selected ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Prehranske preference</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {DIETARY_OPTIONS.map(pref => {
                const selected = (form.dietaryPrefs || []).includes(pref)
                return (
                  <button
                    key={pref}
                    onClick={() => onFormChange({
                      ...form,
                      dietaryPrefs: selected
                        ? (form.dietaryPrefs ?? []).filter((x: string) => x !== pref)
                        : [...(form.dietaryPrefs ?? []), pref],
                    })}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                      selected ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {pref}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="guest-notes" className="text-xs font-medium text-gray-500">Opombe</label>
            <textarea
              id="guest-notes"
              value={form.notes || ''}
              onChange={e => onFormChange({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              rows={2}
              placeholder="Posebne želje, preference sedeža..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="guest-isVip"
              type="checkbox"
              checked={form.isVip || false}
              onChange={e => onFormChange({ ...form, isVip: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="guest-isVip" className="text-sm font-medium">👑 VIP gost</label>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Prekliči
          </button>
          <button
            onClick={onSubmit}
            disabled={!form.lastName}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Shrani gosta
          </button>
        </div>
      </div>
    </div>
  )
})
