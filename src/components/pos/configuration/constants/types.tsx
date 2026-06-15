import React from 'react'
import {
  Percent, UtensilsCrossed, Building2,
  FolderTree, Tags, Wrench, ChefHat, XCircle, Ban, CreditCard,
  Printer, Gift, Heart, Webhook, Clock, Sparkles,
} from 'lucide-react'

// ============================================
// TIPI ZA KONFIGURACIJSKE MODELE
// ============================================
export interface TaxRate { id: string; name: string; rate: number; code: string; isActive: boolean }
export interface DiningOption { id: string; name: string; type: string; prepTimeMinutes: number; linkedServiceCharge: string | null }
export interface RevenueCenter { id: string; name: string; code: string; isActive: boolean }
export interface SalesCategory { id: string; name: string; code: string; isActive: boolean }
export interface PriceGroup { id: string; name: string; description: string; isActive: boolean }
export interface ServiceCharge { id: string; name: string; type: string; amount: number; isAutoApply: boolean }
export interface PrepStation { id: string; name: string; type: string; avgPrepTime: number }
export interface VoidReason { id: string; name: string; isActive: boolean }
export interface NoSaleReason { id: string; name: string; isActive: boolean }
export interface AltPaymentType { id: string; name: string; code: string; type: string }
export interface Printer { id: string; name: string; type: string; location: string; ipAddress: string }
export interface Discount { id: string; name: string; type: string; amount: number; appliesTo: string; triggerType: string; promoCode: string; validFrom: string; validTo: string; maxUses: number; isActive: boolean }
export interface GiftCard { id: string; cardNumber: string; balance: number; initialBalance: number; ownerName: string; expiresAt: string; status: string }
export interface LoyaltyAccount { id: string; customerName: string; phone: string; email: string; pointsBalance: number; tier: string }
export interface Webhook { id: string; name: string; url: string; events: string; isActive: boolean; secret: string }

export type ConfigItem =
  | TaxRate | DiningOption | RevenueCenter | SalesCategory | PriceGroup
  | ServiceCharge | PrepStation | VoidReason | NoSaleReason | AltPaymentType
  | Printer | Discount | GiftCard | LoyaltyAccount | Webhook

// ============================================
// DEFINICIJE ZAVIHKOV
// ============================================
export interface TabDef {
  key: string
  label: string
  icon: React.ReactNode
  model: string
  apiBase: string
}

export const TABS: TabDef[] = [
  { key: 'tax-rates', label: 'DDV Stopnje', icon: <Percent className="h-4 w-4" />, model: 'tax-rates', apiBase: '/api/configuration/tax-rates' },
  { key: 'dining-options', label: 'Nastavitve jedi', icon: <UtensilsCrossed className="h-4 w-4" />, model: 'dining-options', apiBase: '/api/configuration/dining-options' },
  { key: 'revenue-centers', label: 'Prihodkovni centri', icon: <Building2 className="h-4 w-4" />, model: 'revenue-centers', apiBase: '/api/configuration/revenue-centers' },
  { key: 'sales-categories', label: 'Prodajne kategorije', icon: <FolderTree className="h-4 w-4" />, model: 'sales-categories', apiBase: '/api/configuration/sales-categories' },
  { key: 'price-groups', label: 'Ceniki', icon: <Tags className="h-4 w-4" />, model: 'price-groups', apiBase: '/api/configuration/price-groups' },
  { key: 'service-charges', label: 'Servisne postavke', icon: <Wrench className="h-4 w-4" />, model: 'service-charges', apiBase: '/api/configuration/service-charges' },
  { key: 'prep-stations', label: 'Kuhinjske postaje', icon: <ChefHat className="h-4 w-4" />, model: 'prep-stations', apiBase: '/api/configuration/prep-stations' },
  { key: 'void-reasons', label: 'Razlogi za storno', icon: <XCircle className="h-4 w-4" />, model: 'void-reasons', apiBase: '/api/configuration/void-reasons' },
  { key: 'no-sale-reasons', label: 'Razlogi brez prodaje', icon: <Ban className="h-4 w-4" />, model: 'no-sale-reasons', apiBase: '/api/configuration/no-sale-reasons' },
  { key: 'alt-payment-types', label: 'Alternativna plačila', icon: <CreditCard className="h-4 w-4" />, model: 'alt-payment-types', apiBase: '/api/configuration/alt-payment-types' },
  { key: 'printers', label: 'Tiskalniki', icon: <Printer className="h-4 w-4" />, model: 'printers', apiBase: '/api/configuration/printers' },
  { key: 'discounts', label: 'Popusti', icon: <Gift className="h-4 w-4" />, model: 'discounts', apiBase: '/api/discounts' },
  { key: 'gift-cards', label: 'Darilne kartice', icon: <Gift className="h-4 w-4" />, model: 'gift-cards', apiBase: '/api/gift-cards' },
  { key: 'loyalty', label: 'Zvestoba', icon: <Heart className="h-4 w-4" />, model: 'loyalty', apiBase: '/api/loyalty' },
  { key: 'webhooks', label: 'Webhook-i', icon: <Webhook className="h-4 w-4" />, model: 'webhooks', apiBase: '/api/webhooks' },
  { key: 'opening-hours', label: 'Delovni čas', icon: <Clock className="h-4 w-4" />, model: 'opening-hours', apiBase: '/api/opening-hours' },
  { key: 'happy-hour', label: 'Happy Hour', icon: <Sparkles className="h-4 w-4" />, model: 'happy-hour', apiBase: '/api/happy-hour' },
]

// ============================================
// POMOŽNE FUNKCIJE
// ============================================
export const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
