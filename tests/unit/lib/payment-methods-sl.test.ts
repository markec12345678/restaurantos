import { describe, expect, it } from 'vitest'
import { paymentMethodLabelSl } from '@/lib/payment-methods-sl'

// Runda 62: enoten vir oznak plačilnih metod (prej 4 razpršene inline mape
// + digest tiskana stran brez mape → surov enum "cash" na tiskanem poročilu)

describe('paymentMethodLabelSl', () => {
  it('mapa vse znane enum vrednosti (prisma schema)', () => {
    expect(paymentMethodLabelSl('cash')).toBe('Gotovina')
    expect(paymentMethodLabelSl('card')).toBe('Kartica')
    expect(paymentMethodLabelSl('mobile')).toBe('Mobilno')
    expect(paymentMethodLabelSl('voucher')).toBe('Bon')
    expect(paymentMethodLabelSl('loyalty')).toBe('Zvestoba')
    expect(paymentMethodLabelSl('giftcard')).toBe('Darilna kartica')
    expect(paymentMethodLabelSl('alternate')).toBe('Drugo')
  })

  it('neznana vrednost → kapitalizacija prve črke', () => {
    expect(paymentMethodLabelSl('crypto')).toBe('Crypto')
    expect(paymentMethodLabelSl('WEIRD_KEY')).toBe('WEIRD_KEY')
  })

  it('prazne vrednosti → "neznano"', () => {
    expect(paymentMethodLabelSl('')).toBe('neznano')
    expect(paymentMethodLabelSl(null)).toBe('neznano')
    expect(paymentMethodLabelSl(undefined)).toBe('neznano')
  })
})
