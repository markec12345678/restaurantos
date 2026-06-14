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

// ============================================
// POMOŽNE FUNKCIJE ZA OBRAZCE
// ============================================
export function getDefaultFormData(tabKey: string): Record<string, unknown> {
  switch (tabKey) {
    case 'tax-rates':
      return { name: '', rate: '', code: '', isActive: true }
    case 'dining-options':
      return { name: '', type: 'dine-in', prepTimeMinutes: '', linkedServiceCharge: '' }
    case 'revenue-centers':
      return { name: '', code: '', isActive: true }
    case 'sales-categories':
      return { name: '', code: '', isActive: true }
    case 'price-groups':
      return { name: '', description: '', isActive: true }
    case 'service-charges':
      return { name: '', type: 'percentage', amount: '', isAutoApply: false }
    case 'prep-stations':
      return { name: '', type: 'kitchen', avgPrepTime: '' }
    case 'void-reasons':
      return { name: '', isActive: true }
    case 'no-sale-reasons':
      return { name: '', isActive: true }
    case 'alt-payment-types':
      return { name: '', code: '', type: 'voucher' }
    case 'printers':
      return { name: '', type: 'thermal', location: '', ipAddress: '' }
    case 'discounts':
      return { name: '', type: 'percentage', amount: '', appliesTo: 'all', triggerType: 'manual', promoCode: '', validFrom: '', validTo: '', maxUses: '0', isActive: true }
    case 'gift-cards':
      return { cardNumber: '', balance: '', initialBalance: '', ownerName: '', expiresAt: '', status: 'active' }
    case 'loyalty':
      return { customerName: '', phone: '', email: '', pointsBalance: '0', tier: 'bronze' }
    case 'webhooks':
      return { name: '', url: '', events: '', isActive: true, secret: '' }
    default:
      return {}
  }
}

export function itemToForm(tabKey: string, item: ConfigItem): Record<string, unknown> {
  switch (tabKey) {
    case 'tax-rates': {
      const d = item as TaxRate
      return { name: d.name, rate: String(d.rate), code: d.code, isActive: d.isActive }
    }
    case 'dining-options': {
      const d = item as DiningOption
      return { name: d.name, type: d.type, prepTimeMinutes: String(d.prepTimeMinutes), linkedServiceCharge: d.linkedServiceCharge || '' }
    }
    case 'revenue-centers': {
      const d = item as RevenueCenter
      return { name: d.name, code: d.code, isActive: d.isActive }
    }
    case 'sales-categories': {
      const d = item as SalesCategory
      return { name: d.name, code: d.code, isActive: d.isActive }
    }
    case 'price-groups': {
      const d = item as PriceGroup
      return { name: d.name, description: d.description || '', isActive: d.isActive }
    }
    case 'service-charges': {
      const d = item as ServiceCharge
      return { name: d.name, type: d.type, amount: String(d.amount), isAutoApply: d.isAutoApply }
    }
    case 'prep-stations': {
      const d = item as PrepStation
      return { name: d.name, type: d.type, avgPrepTime: String(d.avgPrepTime) }
    }
    case 'void-reasons': {
      const d = item as VoidReason
      return { name: d.name, isActive: d.isActive }
    }
    case 'no-sale-reasons': {
      const d = item as NoSaleReason
      return { name: d.name, isActive: d.isActive }
    }
    case 'alt-payment-types': {
      const d = item as AltPaymentType
      return { name: d.name, code: d.code, type: d.type }
    }
    case 'printers': {
      const d = item as Printer
      return { name: d.name, type: d.type, location: d.location || '', ipAddress: d.ipAddress || '' }
    }
    case 'discounts': {
      const d = item as Discount
      return {
        name: d.name, type: d.type, amount: String(d.amount), appliesTo: d.appliesTo || 'all',
        triggerType: d.triggerType || 'manual', promoCode: d.promoCode || '',
        validFrom: d.validFrom ? new Date(d.validFrom).toISOString().split('T')[0] : '',
        validTo: d.validTo ? new Date(d.validTo).toISOString().split('T')[0] : '',
        maxUses: String(d.maxUses || 0), isActive: d.isActive,
      }
    }
    case 'gift-cards': {
      const d = item as GiftCard
      return {
        cardNumber: d.cardNumber, balance: String(d.balance), initialBalance: String(d.initialBalance),
        ownerName: d.ownerName || '',
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().split('T')[0] : '',
        status: d.status || 'active',
      }
    }
    case 'loyalty': {
      const d = item as LoyaltyAccount
      return { customerName: d.customerName, phone: d.phone || '', email: d.email || '', pointsBalance: String(d.pointsBalance), tier: d.tier }
    }
    case 'webhooks': {
      const d = item as Webhook
      return {
        name: d.name, url: d.url, events: Array.isArray(d.events) ? d.events.join(', ') : String(d.events || ''),
        isActive: d.isActive, secret: d.secret || '',
      }
    }
    default:
      return {}
  }
}

export function formToPayload(tabKey: string, formData: Record<string, unknown>): Record<string, unknown> {
  const base = { ...formData }
  // Pretvori številske vrednosti
  switch (tabKey) {
    case 'tax-rates':
      base.rate = parseFloat(String(base.rate)) || 0
      break
    case 'dining-options':
      base.prepTimeMinutes = parseInt(String(base.prepTimeMinutes)) || 0
      base.linkedServiceCharge = base.linkedServiceCharge || null
      break
    case 'service-charges':
      base.amount = parseFloat(String(base.amount)) || 0
      break
    case 'prep-stations':
      base.avgPrepTime = parseInt(String(base.avgPrepTime)) || 0
      break
    case 'discounts':
      base.amount = parseFloat(String(base.amount)) || 0
      base.maxUses = parseInt(String(base.maxUses)) || 0
      base.validFrom = base.validFrom || null
      base.validTo = base.validTo || null
      base.promoCode = base.promoCode || null
      break
    case 'gift-cards':
      base.balance = parseFloat(String(base.balance)) || 0
      base.initialBalance = parseFloat(String(base.initialBalance)) || 0
      base.expiresAt = base.expiresAt || null
      base.ownerName = base.ownerName || null
      break
    case 'loyalty':
      base.pointsBalance = parseInt(String(base.pointsBalance)) || 0
      base.phone = base.phone || null
      base.email = base.email || null
      break
    case 'webhooks':
      base.events = base.events || ''
      base.secret = base.secret || null
      break
  }
  return base
}
