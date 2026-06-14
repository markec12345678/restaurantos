// ============================================
// ESC/POS MODUL — Barrel re-export
// Vsi uvozi iz @/lib/escpos še naprej delujejo
// ============================================

export { ESC, GS, CODE_PAGE_852, MAX_PRINT_BUFFER, SLOVENIAN_CHAR_MAP, encodeSlovenian } from './constants'
export type { ESCPOSBuilder, PrinterModel, KitchenOrderPrintData, ReceiptPrintData } from './types'
export { createESCPOSBuilder } from './builders'
export { generateKitchenOrder, generateTestPrint } from './generators'
export { generateReceipt } from './receipt'
