// ============================================
// ESC/POS GRADILNIKI UKAZOV
// Epson TM-T88VI in Star SP700
// ============================================

import type { ESCPOSBuilder, PrinterModel } from '../types'
import { createEpsonBuilder } from './epson'
import { createStarBuilder } from './star'

// ============================================
// FACTORY FUNKCIJA
// ============================================

/**
 * Ustvari ESC/POS gradilnik glede na model tiskalnika
 * FIX EP-01 HIGH: Dodan lineWidth parameter — 48 za 80mm, 32 za 58mm papir
 */
export function createESCPOSBuilder(model: PrinterModel = 'epson', lineWidth = 48): ESCPOSBuilder {
  switch (model) {
    case 'star':
      return createStarBuilder(lineWidth)
    case 'epson':
    default:
      return createEpsonBuilder(lineWidth)
  }
}

export { createEpsonBuilder } from './epson'
export { createStarBuilder } from './star'
