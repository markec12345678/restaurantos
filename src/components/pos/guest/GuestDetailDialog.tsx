'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import type { GuestData } from './constants'
import type { GuestFormRow } from '@/lib/types'

// Lazy-loaded podkomponente
const GuestDetail = dynamic(() => import('./GuestDetail').then(m => ({ default: m.GuestDetail })), { ssr: false })
const GuestFormModal = dynamic(() => import('./GuestFormModal').then(m => ({ default: m.GuestFormModal })), { ssr: false })

// ============================================
// GUEST DETAIL DIALOG — Podrobnosti in obrazec gosta
// ============================================

interface GuestDetailDialogProps {
  tab: 'list' | 'detail'
  selectedGuest: GuestData | null
  showForm: boolean
  form: GuestFormRow
  onFormChange: (_form: GuestFormRow) => void
  onBack: () => void
  onToggleVip: (_id: string, _isVip: boolean) => void
  onCloseForm: () => void
  onSubmitForm: () => void
}

export const GuestDetailDialog = memo(function GuestDetailDialog({
  tab,
  selectedGuest,
  showForm,
  form,
  onFormChange,
  onBack,
  onToggleVip,
  onCloseForm,
  onSubmitForm,
}: GuestDetailDialogProps) {
  return (
    <>
      {/* Podrobnosti gosta */}
      {tab === 'detail' && selectedGuest && (
        <GuestDetail
          guest={selectedGuest}
          onBack={onBack}
          onToggleVip={onToggleVip}
        />
      )}
      {/* Modal za dodajanje novega gosta */}
      <GuestFormModal
        open={showForm}
        form={form}
        onFormChange={onFormChange}
        onClose={onCloseForm}
        onSubmit={onSubmitForm}
      />
    </>
  )
})
