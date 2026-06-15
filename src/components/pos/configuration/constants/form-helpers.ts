import type {
  TaxRate, DiningOption, RevenueCenter, SalesCategory, PriceGroup,
  ServiceCharge, PrepStation, VoidReason, NoSaleReason, AltPaymentType,
  Printer, Discount, GiftCard, LoyaltyAccount, Webhook, ConfigItem,
} from './types'

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
