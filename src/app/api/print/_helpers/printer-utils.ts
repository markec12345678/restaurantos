import { db } from '@/lib/db'
import type { PrinterModel } from '@/lib/escpos'
import * as net from 'net'

// ============================================
// Printer utility functions
// ============================================

/**
 * Pošlji ESC/POS podatke na tiskalnik preko TCP/IP povezave
 * FIX EP-03 HIGH: Dodan retry mehanizem (3 poskusi) za izgubljene tiskalne posle
 */
export function sendToPrinter(ipAddress: string, port: number, data: Buffer, maxRetries = 3): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!ipAddress) {
      resolve({ success: false, error: 'IP naslov tiskalnika ni nastavljen' })
      return
    }
    let attempts = 0
    const attempt = () => {
      attempts++
      const socket = new net.Socket()
      const timeout = 10000 // 10 sekund timeout
      socket.setTimeout(timeout)
      socket.on('connect', () => {
        socket.write(data)
        socket.end()
      })
      socket.on('close', () => {
        resolve({ success: true })
      })
      socket.on('timeout', () => {
        socket.destroy()
        if (attempts < maxRetries) {
          setTimeout(attempt, 1000) // Počakaj 1 sekundo pred ponovnim poskusom
        } else {
          resolve({ success: false, error: `Timeout pri povezavi s tiskalnikom ${ipAddress}:${port} (${maxRetries} poskusov)` })
        }
      })
      socket.on('error', (err) => {
        socket.destroy()
        if (attempts < maxRetries) {
          setTimeout(attempt, 1000)
        } else {
          resolve({ success: false, error: `Napaka pri povezavi s tiskalnikom: ${err.message} (${maxRetries} poskusov)` })
        }
      })
      socket.connect(port, ipAddress)
    }
    attempt()
  })
}

/**
 * Določi model tiskalnika glede na tip iz baze
 */
export function getPrinterModel(printerType: string, printerName: string): PrinterModel {
  const nameLower = printerName.toLowerCase()
  // Star SP700 je impact (dot-matrix) tiskalnik
  if (printerType === 'dot-matrix' || nameLower.includes('star') || nameLower.includes('sp700')) {
    return 'star'
  }
  // Epson TM-T88VI in ostali termični
  return 'epson'
}

/** Printer info returned by findPrinter */
export interface PrinterInfo {
  id: string
  name: string
  ipAddress: string
  type: string
  port: number
}

/**
 * Poišči ustrezen tiskalnik glede na pravila tiskanja
 */
export async function findPrinter(type: 'order' | 'receipt', printerId?: string): Promise<PrinterInfo | null> {
  // FIX EP5 MEDIUM: Podpora za konfigurabilni port — prejšnja koda je hardcodirala 9100
  // Nekateri tiskalniki uporabljajo 9101, 515 (LPD), ali druge porte
  const _parsePort = (p: string | number | null | undefined, fallback = 9100): number => {
    if (typeof p === 'number') return p
    if (typeof p === 'string' && p) {
      const n = parseInt(p, 10)
      if (!isNaN(n) && n > 0 && n <= 65535) return n
    }
    return fallback
  }
  // Če je podan specifičen printerId
  if (printerId) {
    const printer = await db.printer.findUnique({ where: { id: printerId } })
    if (printer && printer.isActive && printer.ipAddress) {
      // FIX EP5: Preberi port iz printRules če je podan, sicer default 9100
      let customPort: number | undefined
      try {
        const rules = JSON.parse(printer.printRules || '[]') as Array<{ port?: number }>
        if (rules.length > 0 && rules[0].port) customPort = rules[0].port
      } catch { /* invalid JSON */ }
      return {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        type: printer.type,
        port: customPort || 9100,
      }
    }
    return null
  }
  // Samodejno izberi tiskalnik glede na printRules
  const printers = await db.printer.findMany({
    where: { isActive: true, ipAddress: { not: '' } },
    orderBy: { sortOrder: 'asc' },
  })
  for (const printer of printers) {
    try {
      const rules = JSON.parse(printer.printRules || '[]') as Array<{ type: string; prepStationId?: string; port?: number }>
      const hasMatchingRule = rules.some((rule) => {
        if (type === 'order' && rule.type === 'order') return true
        if (type === 'receipt' && rule.type === 'receipt') return true
        return false
      })
      if (hasMatchingRule) {
        const customPort = rules.find(r => r.port)?.port
        return {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          type: printer.type,
          port: customPort || 9100,
        }
      }
    } catch {
      // Napačen JSON v printRules — preskoči
    }
  }
  // Fallback: uporabi prvi aktivni tiskalnik
  if (printers.length > 0) {
    return {
      id: printers[0].id,
      name: printers[0].name,
      ipAddress: printers[0].ipAddress,
      type: printers[0].type,
      port: 9100,
    }
  }
  return null
}
