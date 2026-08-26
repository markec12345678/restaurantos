// --- Pomožni tipi za komponente ---

import type { LucideIcon } from 'lucide-react'

/** Ikona v konfiguraciji komponente */
export interface IconConfig<_T extends string = string> {
  label: string
  icon: LucideIcon
  color?: string
  desc?: string
  step?: number
}

/** Komponenta z ikono (za stat kartice) */
export interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

/** Komponenta za plačilno vrstico */
export interface PaymentRowProps {
  icon: LucideIcon
  label: string
  value: number
  total: number
  color: string
}

/** PWA beforeinstallprompt dogodek */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Razširjen Window za vendor prefixes */
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
    deferredPrompt?: BeforeInstallPromptEvent
  }
}
