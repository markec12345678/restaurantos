'use client'

import { memo, useEffect, useCallback } from 'react'
import { type GuestFormRow } from '@/lib/types'
import { GuestFormFields } from './GuestFormFields'
import { AllergenSelector } from './AllergenSelector'
import { DietaryPrefsSelector } from './DietaryPrefsSelector'

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
          <GuestFormFields form={form} onFormChange={onFormChange} />
          <AllergenSelector form={form} onFormChange={onFormChange} />
          <DietaryPrefsSelector form={form} onFormChange={onFormChange} />
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
