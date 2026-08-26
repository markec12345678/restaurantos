// ============================================
// VALIDACIJSKA PRAVILA — Pretvorba obrazca v payload
// ============================================
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
