'use client'

import { memo } from 'react'
import { type GuestFormRow } from '@/lib/types'

// --- Props ---

interface GuestFormFieldsProps {
  form: GuestFormRow
  onFormChange: (_form: GuestFormRow) => void
}

// --- Osnovna polja obrazca (ime, priimek, telefon, email, podjetje, datumi) ---

export const GuestFormFields = memo(function GuestFormFields({
  form,
  onFormChange,
}: GuestFormFieldsProps) {
  return (
    <>
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
    </>
  )
})
