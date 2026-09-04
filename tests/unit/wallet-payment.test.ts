// ============================================
// Wallet Payment — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import {
  validateWalletPaymentInput,
  maskToken,
  SUPPORTED_WALLETS,
  SUPPORTED_CURRENCIES,
  WALLET_STATUSES,
  type WalletType,
  type WalletPaymentStatus,
} from '@/lib/wallet-payment'

describe('SUPPORTED_WALLETS', () => {
  it('vse 5 denarnic so podprte', () => {
    expect(SUPPORTED_WALLETS).toContain('apple_pay')
    expect(SUPPORTED_WALLETS).toContain('google_pay')
    expect(SUPPORTED_WALLETS).toContain('samsung_pay')
    expect(SUPPORTED_WALLETS).toContain('nfc_card')
    expect(SUPPORTED_WALLETS).toContain('qr_pay')
    expect(SUPPORTED_WALLETS.length).toBe(5)
  })
})

describe('SUPPORTED_CURRENCIES', () => {
  it('EUR je podprt', () => {
    expect(SUPPORTED_CURRENCIES).toContain('EUR')
  })

  it('USD, GBP, CHF so podprti', () => {
    expect(SUPPORTED_CURRENCIES).toContain('USD')
    expect(SUPPORTED_CURRENCIES).toContain('GBP')
    expect(SUPPORTED_CURRENCIES).toContain('CHF')
  })
})

describe('WALLET_STATUSES', () => {
  it('vsi statusi definirani', () => {
    const expected: WalletPaymentStatus[] = ['pending', 'authorized', 'captured', 'failed', 'refunded']
    for (const s of expected) {
      expect(WALLET_STATUSES).toContain(s)
    }
  })
})

describe('validateWalletPaymentInput', () => {
  const validInput = {
    walletType: 'apple_pay' as WalletType,
    amount: 42.50,
    currency: 'EUR',
    paymentToken: 'tok_1234567890abcdef',
  }

  it('veljaven input → null', () => {
    expect(validateWalletPaymentInput(validInput)).toBeNull()
  })

  it('nepodprta denarnica → error', () => {
    expect(
      validateWalletPaymentInput({ ...validInput, walletType: 'crypto_pay' as WalletType }),
    ).toContain('Nepodprta denarnica')
  })

  it('negativen znesek → error', () => {
    expect(validateWalletPaymentInput({ ...validInput, amount: -10 })).toContain('pozitiven')
  })

  it('znesek = 0 → error', () => {
    expect(validateWalletPaymentInput({ ...validInput, amount: 0 })).toContain('pozitiven')
  })

  it('znesek > 10000 → error (limit)', () => {
    expect(validateWalletPaymentInput({ ...validInput, amount: 15000 })).toContain('limit')
  })

  it('manjkajoč token → error', () => {
    expect(validateWalletPaymentInput({ ...validInput, paymentToken: '' })).toContain('token')
  })

  it('prekratek token → error', () => {
    expect(validateWalletPaymentInput({ ...validInput, paymentToken: 'short' })).toContain('token')
  })

  it('nepodprta valuta → error', () => {
    expect(
      validateWalletPaymentInput({ ...validInput, currency: 'JPY' as unknown as string }),
    ).toContain('valuta')
  })

  it('google_pay je podprt', () => {
    expect(validateWalletPaymentInput({ ...validInput, walletType: 'google_pay' })).toBeNull()
  })

  it('nfc_card je podprt', () => {
    expect(validateWalletPaymentInput({ ...validInput, walletType: 'nfc_card' })).toBeNull()
  })
})

describe('maskToken (PCI DSS compliance)', () => {
  it('dolg token → prikaže prvih 4 in zadnjih 4', () => {
    const token = 'tok_1234567890abcdef_GHIJ'
    const masked = maskToken(token)
    expect(masked).toBe('tok_...GHIJ')
    expect(masked).not.toContain('567890')
  })

  it('kratek token → *** (ne izpostavi)', () => {
    expect(maskToken('short')).toBe('***')
    expect(maskToken('1234')).toBe('***')
  })

  it('token dolžine 8 → *** (mejni primer)', () => {
    expect(maskToken('12345678')).toBe('***')
  })

  it('token dolžine 9 → maskirano', () => {
    expect(maskToken('123456789')).toBe('1234...6789')
  })

  it('ne izpostavi sredine tokena', () => {
    const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const masked = maskToken(token)
    expect(masked).not.toContain('JKLMNO')
    expect(masked).not.toContain('UVWXYZ')
  })
})
