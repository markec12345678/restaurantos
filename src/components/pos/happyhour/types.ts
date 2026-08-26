// ============================================
// TIPI za Happy Hour konfiguracijo
// ============================================

export interface HappyHourSchedule {
  id: string
  name: string
  description: string
  priceGroupId: string
  priceGroup?: { id: string; name: string }
  discountType: string
  discountAmount: number
  daysOfWeek: string
  startTime: string
  endTime: string
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  autoActivate: boolean
}

export interface HappyHourFormState {
  name: string
  description: string
  priceGroupId: string
  discountType: string
  discountAmount: number
  daysOfWeek: number[]
  startTime: string
  endTime: string
  validFrom: string
  validTo: string
  isActive: boolean
  autoActivate: boolean
}

export const EMPTY_HH_FORM: HappyHourFormState = {
  name: '', description: '', priceGroupId: '', discountType: 'percentage', discountAmount: 0,
  daysOfWeek: [1, 2, 3, 4, 5], startTime: '14:00', endTime: '17:00',
  validFrom: '', validTo: '', isActive: true, autoActivate: true,
}

export const DAY_LABELS = ['', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
