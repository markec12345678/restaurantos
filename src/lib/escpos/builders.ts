// ============================================
// ESC/POS GRADILNIKI UKAZOV
// Epson TM-T88VI in Star SP700
// ============================================

import { logger } from '@/lib/logger'
import { ESC, GS, CODE_PAGE_852, MAX_PRINT_BUFFER, encodeSlovenian } from './constants'
import type { ESCPOSBuilder, PrinterModel } from './types'

// ============================================
// UKAZNI GRADILNIK — EPSON TM-T88VI (standardni ESC/POS)
// ============================================

function createEpsonBuilder(lineWidth = 48): ESCPOSBuilder {
  const commands: string[] = []

  const builder: ESCPOSBuilder = {
    commands,

    init() {
      commands.push(ESC + '@') // Initialize printer
      commands.push(ESC + 't' + String.fromCharCode(CODE_PAGE_852)) // Select code page 852
      return builder
    },

    bold(on = true) {
      commands.push(ESC + 'E' + (on ? '\x01' : '\x00'))
      return builder
    },

    center() {
      commands.push(ESC + 'a' + '\x01')
      return builder
    },

    left() {
      commands.push(ESC + 'a' + '\x00')
      return builder
    },

    right() {
      commands.push(ESC + 'a' + '\x02')
      return builder
    },

    text(t: string) {
      commands.push(encodeSlovenian(t))
      return builder
    },

    lineFeed(n = 1) {
      commands.push(ESC + 'd' + String.fromCharCode(n))
      return builder
    },

    separator(char = '-') {
      // FIX EP-01 HIGH: Uporabi lineWidth namesto hardcoded 48 — podpira 58mm (32 chars) in 80mm (48 chars)
      commands.push(encodeSlovenian(char.repeat(lineWidth)) + '\n')
      return builder
    },

    cut(partial = true) {
      // FIX EP-10 LOW: Feed 3 lines before cutting (prepreči rez na tiskanem besedilu)
      commands.push(ESC + 'd' + '\x03') // Feed 3 lines
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
      return builder
    },

    // FIX EP-02 HIGH: Cash drawer open ukaz — odpre predal po gotovinskem plačilu
    openCashDrawer() {
      // ESC p m t1 t2 — Pulse pin m (0=pin2, 1=pin5) for t1*2ms on, t2*2ms off
      commands.push(ESC + 'p' + '\x00' + String.fromCharCode(100) + String.fromCharCode(50))
      return builder
    },

    largeText() {
      // Double height and width
      commands.push(GS + '!' + '\x11')
      return builder
    },

    smallText() {
      // Reset to normal, then small
      commands.push(GS + '!' + '\x00')
      commands.push(ESC + '!' + '\x01') // Font B
      return builder
    },

    normalText() {
      commands.push(GS + '!' + '\x00')
      commands.push(ESC + '!' + '\x00') // Font A, normal
      return builder
    },

    underline(on = true) {
      commands.push(ESC + '-' + (on ? '\x01' : '\x00'))
      return builder
    },

    inverted(on = true) {
      commands.push(GS + 'B' + (on ? '\x01' : '\x00'))
      return builder
    },

    tab() {
      commands.push('\t')
      return builder
    },

    build() {
      const buf = Buffer.from(commands.join(''), 'binary')
      // FIX EP2 HIGH: Omeji velikost bufferja na 16KB — prepreči overflow tiskalnika
      if (buf.length > MAX_PRINT_BUFFER) {
        logger.warn('ESC/POS', `Epson buffer prevelik (${buf.length} bytes) — obrezujem na ${MAX_PRINT_BUFFER}`)
        return buf.subarray(0, MAX_PRINT_BUFFER)
      }
      return buf
    },
  }

  return builder
}

// ============================================
// UKAZNI GRADILNIK — STAR SP700 (impact printer)
// ============================================

function createStarBuilder(lineWidth = 48): ESCPOSBuilder {
  const commands: string[] = []

  const builder: ESCPOSBuilder = {
    commands,

    init() {
      commands.push(ESC + '@') // Initialize printer
      // FIX EP1 HIGH: Star SP700 MORA uporabiti ESC t 18 (code page 852) za pravilno slovenščino
      // Prejšnja koda je uporabila ESC R 12 (mednarodni nabor), ki spremeni le nekaj znakov
      // v osnovnem ASCII obsegu — č, š, ž, Č, Š, Ž so se tiskali kot smeti/prazno
      // ESC t 18 = izberi code page 852 (Latin 2), ki podpira vse slovenske znake
      commands.push(ESC + 't' + String.fromCharCode(18)) // Code page 852 (CP852 = Latin 2)
      return builder
    },

    bold(on = true) {
      commands.push(ESC + 'E' + (on ? '\x01' : '\x00'))
      return builder
    },

    center() {
      commands.push(ESC + 'a' + '\x01')
      return builder
    },

    left() {
      commands.push(ESC + 'a' + '\x00')
      return builder
    },

    right() {
      commands.push(ESC + 'a' + '\x02')
      return builder
    },

    text(t: string) {
      commands.push(encodeSlovenian(t))
      return builder
    },

    lineFeed(n = 1) {
      commands.push('\n'.repeat(n))
      return builder
    },

    separator(char = '-') {
      // FIX EP-01 HIGH: Uporabi lineWidth namesto hardcoded 48
      commands.push(encodeSlovenian(char.repeat(lineWidth)) + '\n')
      return builder
    },

    cut(partial = true) {
      // Star SP700: pulse the auto-cutter
      commands.push(ESC + 'd' + '\x03') // Feed 3 lines before cut
      commands.push(GS + 'V' + (partial ? '\x01' : '\x00'))
      return builder
    },

    // FIX EP-02 HIGH: Cash drawer open ukaz za Star tiskalnike
    openCashDrawer() {
      // Star cash drawer command: ESC p m t1 t2 (isti ukaz kot Epson)
      commands.push(ESC + 'p' + '\x00' + String.fromCharCode(100) + String.fromCharCode(50))
      return builder
    },

    largeText() {
      // Star: double height + double width
      commands.push(ESC + 'h' + '\x01') // Double height
      commands.push(ESC + 'w' + '\x01') // Double width
      return builder
    },

    smallText() {
      commands.push(ESC + 'h' + '\x00')
      commands.push(ESC + 'w' + '\x00')
      return builder
    },

    normalText() {
      commands.push(ESC + 'h' + '\x00')
      commands.push(ESC + 'w' + '\x00')
      return builder
    },

    underline(on = true) {
      commands.push(ESC + '-' + (on ? '\x01' : '\x00'))
      return builder
    },

    inverted(_on = true) {
      // Star SP700 ne podpira inverted, ignoriramo
      return builder
    },

    tab() {
      commands.push('\t')
      return builder
    },

    build() {
      const buf = Buffer.from(commands.join(''), 'binary')
      // FIX EP2 HIGH: Omeji velikost bufferja na 16KB — prepreči overflow tiskalnika
      if (buf.length > MAX_PRINT_BUFFER) {
        logger.warn('ESC/POS', `Star buffer prevelik (${buf.length} bytes) — obrezujem na ${MAX_PRINT_BUFFER}`)
        return buf.subarray(0, MAX_PRINT_BUFFER)
      }
      return buf
    },
  }

  return builder
}

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
