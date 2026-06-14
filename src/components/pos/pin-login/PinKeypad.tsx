'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { KeyRound, LogIn } from 'lucide-react'
import type { PinKeypadProps } from './constants'

// ============================================
// STEVCNA TIPKOVNICA — Numerična tipkovnica za PIN vnos
// ============================================

export const PinKeypad = memo(function PinKeypad({ onDigit, onBackspace, onSubmit, disabled, firstDigitRef }: PinKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit, idx) => (
        <Button
          key={digit}
          ref={idx === 0 ? firstDigitRef : undefined}
          variant="outline"
          className="h-14 text-xl font-bold"
          onClick={() => onDigit(digit)}
          aria-label={`Stevka ${digit}`}
        >
          {digit}
        </Button>
      ))}
      <Button variant="ghost" className="h-14" onClick={onBackspace} aria-label="Izbrisi zadnjo stevko">
        <KeyRound className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        className="h-14 text-xl font-bold"
        onClick={() => onDigit('0')}
      >
        0
      </Button>
      <Button
        className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={onSubmit}
        disabled={disabled}
        aria-label="Potrdi PIN"
      >
        <LogIn className="h-5 w-5" />
      </Button>
    </div>
  )
})
