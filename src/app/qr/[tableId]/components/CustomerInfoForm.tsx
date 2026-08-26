'use client'

import { memo } from 'react'
import { User, Phone, MessageSquare } from 'lucide-react'
import type { TranslationValue } from '../translations'

interface CustomerInfoFormProps {
  t: TranslationValue
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  orderNotes: string
  setOrderNotes: (_notes: string) => void
}

export const CustomerInfoForm = memo(function CustomerInfoForm({
  t,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  orderNotes,
  setOrderNotes,
}: CustomerInfoFormProps) {
  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="qr-customer-name" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <User className="h-3 w-3" /> {t.name}
          </label>
          <input
            id="qr-customer-name"
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder={t.optional}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="qr-customer-phone" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Phone className="h-3 w-3" /> {t.phone}
          </label>
          <input
            id="qr-customer-phone"
            type="tel"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            placeholder="+386"
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
      <div>
        <label htmlFor="qr-order-notes" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> {t.orderNotes}
        </label>
        <input
          id="qr-order-notes"
          type="text"
          value={orderNotes}
          onChange={e => setOrderNotes(e.target.value)}
          placeholder={t.notePlaceholder}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
    </div>
  )
})
