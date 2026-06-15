'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard, ShoppingBag } from 'lucide-react'

// ============================================
// SUBMIT BUTTONS — Oddaj in plačaj / Oddaj naročilo
// ============================================

interface SubmitButtonsProps {
  cartLength: number
  isPending: boolean
  editingOrderId: string | null
  editingOrderNumber: number | null
  onSubmit: () => void
}

export const SubmitButtons = memo(function SubmitButtons({
  cartLength, isPending, editingOrderId, editingOrderNumber, onSubmit,
}: SubmitButtonsProps) {
  return (
    <div className="px-3 pb-3 space-y-2">
      <Button
        className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
        disabled={cartLength === 0 || isPending}
        onClick={() => onSubmit()}
      >
        {isPending
          ? (editingOrderId ? 'Dodajam...' : 'Naročam...')
          : (editingOrderId ? `Dodaj k naročilu #${editingOrderNumber}` : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Oddaj in plačaj
            </>
          ))
        }
      </Button>
      {!editingOrderId && (
        <Button
          variant="outline"
          className="w-full h-9 text-sm"
          disabled={cartLength === 0 || isPending}
          onClick={() => onSubmit()}
        >
          <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
          Oddaj naročilo (plačaj kasneje)
        </Button>
      )}
    </div>
  )
})
