// ============================================
// R140-c — čisti UI helperji feedback resolution workflow-a (P1-14)
// Pure logika iz src/components/pos/customer-feedback/constants.ts:
//   - parseFeedbackTags: tags so v DB JSON String ("[]") → tabela (brez crasha)
//   - FEEDBACK_STATUS_BADGES: BUG-04 kanon — lookup mapa polnih literal razredov
// ============================================
import { describe, it, expect } from 'vitest'
import {
  parseFeedbackTags,
  FEEDBACK_STATUS_BADGES,
  FEEDBACK_STATUS_UNKNOWN,
  STATUS_FILTER_OPTIONS,
  FEEDBACK_STATUS_FILTER_LABELS,
} from '@/components/pos/customer-feedback/constants'

describe('parseFeedbackTags (R140-c tags normalizacija)', () => {
  it('parsa veljaven JSON string v tabelo', () => {
    expect(parseFeedbackTags('["Odlična hrana","Hitra postrežba"]')).toEqual([
      'Odlična hrana',
      'Hitra postrežba',
    ])
  })

  it('prazen JSON array string → []', () => {
    expect(parseFeedbackTags('[]')).toEqual([])
  })

  it('DB default "[]" je prav tako prazen', () => {
    // pariteta z @default("[]") iz Prisma sheme
    const raw = '[]'
    expect(parseFeedbackTags(raw)).toEqual([])
  })

  it('neveljaven JSON → [] (defenzivno, brez crasha)', () => {
    expect(parseFeedbackTags('ni-json')).toEqual([])
    expect(parseFeedbackTags('{"a":1}')).toEqual([])
  })

  it('že-parsana tabela (starejši cache) gre skozi, ne-stringi se izrežejo', () => {
    expect(parseFeedbackTags(['a', 'b'])).toEqual(['a', 'b'])
    expect(parseFeedbackTags(['a', 3, null, 'b'])).toEqual(['a', 'b'])
  })

  it('prazen/whitespace string, null, undefined, številka → []', () => {
    expect(parseFeedbackTags('')).toEqual([])
    expect(parseFeedbackTags('   ')).toEqual([])
    expect(parseFeedbackTags(null)).toEqual([])
    expect(parseFeedbackTags(undefined)).toEqual([])
    expect(parseFeedbackTags(42)).toEqual([])
  })
})

describe('FEEDBACK_STATUS_BADGES (BUG-04 kanon)', () => {
  it('vsi trije statusi imajo polne literal razrede (nikoli dinamičnih konkatenacij)', () => {
    expect(FEEDBACK_STATUS_BADGES.new).toEqual({ label: 'Novo', className: 'bg-gray-100 text-gray-700' })
    expect(FEEDBACK_STATUS_BADGES.in_review).toEqual({ label: 'V obdelavi', className: 'bg-amber-100 text-amber-700' })
    expect(FEEDBACK_STATUS_BADGES.resolved).toEqual({ label: 'Rešeno', className: 'bg-emerald-100 text-emerald-700' })
  })

  it('fallback za neznan status je nevtralen in ne uhaja notranjih vrednosti', () => {
    expect(FEEDBACK_STATUS_UNKNOWN.className).toBe('bg-gray-100 text-gray-700')
  })

  it('status filter pokriva vse statuse + all, z oznakami (sl)', () => {
    expect(STATUS_FILTER_OPTIONS).toEqual(['all', 'new', 'in_review', 'resolved'])
    expect(FEEDBACK_STATUS_FILTER_LABELS.all).toBe('Vsi')
    expect(FEEDBACK_STATUS_FILTER_LABELS.in_review).toBe('V obdelavi')
  })
})
