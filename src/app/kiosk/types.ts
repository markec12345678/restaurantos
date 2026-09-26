// =====================================================================
// Tipi za kiosk samopostrežni UI (R135-c, epic #115 P1-11)
// Kiosk-lokalni tipi — zrcalijo GET /api/public/kiosk odgovor in POST
// kioskOrderSchema (ruta NI dotaknjena). Cena (MenuItem.price) je NETO EUR;
// stranka vidi GROSS = price × (1 + vatRate/100) — isti prikazni kanon kot
// src/app/order (MenuStep: priceWithVat) in src/app/qr-menu.
// =====================================================================

export interface KioskModifier {
  id: string
  name: string
  price: number
  allergens: string[]
}

export interface KioskModifierGroup {
  id: string
  name: string
  required: boolean
  minSelect: number | null
  maxSelect: number | null
  modifiers: KioskModifier[]
}

export interface KioskMenuItem {
  id: string
  name: string
  description: string
  /** NETO EUR (MenuItem.price) — prikaz vedno × (1 + vatRate/100) */
  price: number
  vatRate: number
  /** EU 1169/2011 številke alergenov ("1,3,7" → ['1','3','7']) */
  allergens: string[]
  image: string | null
  modifierGroups: { sortOrder: number; modifierGroup: KioskModifierGroup }[]
  /** R124 stock kanon ('ok' | 'low' | 'out') */
  stockStatus: 'ok' | 'low' | 'out'
  stockAvailable: number | null
  stockUnit: string | null
}

export interface KioskCategory {
  id: string
  name: string
  sortOrder: number
  menuItems: KioskMenuItem[]
}

export interface KioskMenu {
  id: string
  name: string
  categories: KioskCategory[]
}

/** Izbrani modifier v košarici (ista oblika kot online-order Modifier) */
export interface SelectedModifier {
  id: string
  name: string
  price: number
}

/**
 * Postavka košarice. V pomnilniku (useState) — refresh NAMERNO resetira
 * (kiosk je anonimna javna naprava; brez persistanse, brez osebnih podatkov).
 */
export interface KioskCartItem {
  menuItemId: string
  name: string
  /** NETO EUR osnova artikla (brez modifierjev) */
  netoPrice: number
  vatRate: number
  quantity: number
  modifiers: SelectedModifier[]
  /** Opomba stranke (≤200 znakov, gre v orderItems.notes) */
  notes: string
}

/** Rezultat uspešnega POST (201 / 200 idempotentReplay — ista oblika) */
export interface KioskOrderResult {
  orderNumber: number
  total: number
  /** 'gotovina' | 'kartica' (server label) */
  paymentMethod: string
  message: string
}

/** Korak toka kioska */
export type KioskFlowStep = 'attract' | 'menu' | 'cart' | 'checkout' | 'confirmation'

/** Celozaslonska stanja izven običajnega toka */
export type KioskFatalScreen = 'config' | 'closed' | 'rate-limited' | null
