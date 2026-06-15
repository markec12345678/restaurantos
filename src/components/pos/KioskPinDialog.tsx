'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================
// PIN DIALOG SUB-COMPONENT
// ============================================
interface PinDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  pin: string
  setPin: (_pin: string) => void
  pinError: string
  setPinError: (_error: string) => void
  onPinSubmit: () => void
}

export const KioskPinDialog = memo(function KioskPinDialog({
  open,
  onOpenChange,
  pin,
  setPin,
  pinError,
  setPinError,
  onPinSubmit,
}: PinDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">Izhod iz kiosk načina</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Vnesite administratorski PIN za izhod
          </p>
          {/* PIN prikaz */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-colors ${
                  i < pin.length
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                {i < pin.length && (
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>
          {/* Napaka */}
          {pinError && (
            <div className="text-center text-xs text-red-600 dark:text-red-400">
              {pinError}
            </div>
          )}
          {/* Števčna tipkovnica */}
          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <Button
                key={digit}
                variant="outline"
                className="h-11 text-lg font-bold touch-manipulation"
                onClick={() => {
                  if (pin.length < 6) {
                    setPin(pin + digit)
                    setPinError('')
                  }
                }}
                autoFocus={digit === '1'}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-11 touch-manipulation"
              onClick={() => {
                setPin(pin.slice(0, -1))
                setPinError('')
              }}
            >
              ←
            </Button>
            <Button
              variant="outline"
              className="h-11 text-lg font-bold touch-manipulation"
              onClick={() => {
                if (pin.length < 6) {
                  setPin(pin + '0')
                  setPinError('')
                }
              }}
            >
              0
            </Button>
            <Button
              className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation"
              onClick={onPinSubmit}
              disabled={pin.length < 4}
            >
              ✓
            </Button>
          </div>
          {/* Prekliči */}
          <Button
            variant="ghost"
            className="w-full text-xs"
            onClick={() => {
              onOpenChange(false)
              setPin('')
              setPinError('')
            }}
          >
            Prekliči
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
