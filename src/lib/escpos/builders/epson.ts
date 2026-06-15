// ============================================
// UKAZNI GRADILNIK — EPSON TM-T88VI (standardni ESC/POS)
// ============================================

import { logger } from '@/lib/logger'
import { ESC, GS, CODE_PAGE_852, MAX_PRINT_BUFFER, encodeSlovenian } from '../constants'
import type { ESCPOSBuilder } from '../types'

export function createEpsonBuilder(lineWidth = 48): ESCPOSBuilder {
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
