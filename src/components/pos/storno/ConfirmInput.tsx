'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { ConfirmInputProps } from './constants'

// ============================================
// POTRDITVENO BESEDILO ZA STORNO/PREKIC
// ============================================
export const ConfirmInput = memo(function ConfirmInput({
  isPaid,
  canSubmit,
  confirmText,
  onConfirmTextChange,
}: ConfirmInputProps) {
  if (!canSubmit) return null

  const label = isPaid ? 'STORNO' : 'PREKLIČI'

  return (
    <>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">
          Za potrditev vpišite <strong>{label}</strong>:
        </p>
        <Input
          placeholder={label}
          value={confirmText}
          onChange={e => onConfirmTextChange(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>
    </>
  )
})
