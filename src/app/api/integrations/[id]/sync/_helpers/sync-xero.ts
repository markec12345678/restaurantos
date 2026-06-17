// ============================================
// XERO SYNC — pošiljanje JournalEntry v Xero (Manual Journals API)
// Uporablja Xero OAuth 2.0 Bearer token + tenant ID
// ============================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { ACCOUNTS } from '@/lib/accounting/journal-generator'
import type { SyncResult } from './types'

interface XeroConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  accountMapping: 'auto' | 'manual'
}

/** Mapiranje RestaurantOS kontov → Xero Account codes */
function mapToXeroAccount(accountCode: string): { code: string; name: string; type: string } {
  const mapping: Record<string, { code: string; name: string; type: string }> = {
    [ACCOUNTS.CASH.code]: { code: '1010', name: 'Cash on Hand', type: 'BANK' },
    [ACCOUNTS.BANK.code]: { code: '1000', name: 'Checking Account', type: 'BANK' },
    [ACCOUNTS.VAT_OUTPUT.code]: { code: '2600', name: 'Sales Tax Payable', type: 'CURRENTLIABILITY' },
    [ACCOUNTS.SALES_DINEIN.code]: { code: '7000', name: 'Sales - Dine In', type: 'REVENUE' },
    [ACCOUNTS.SALES_TAKEOUT.code]: { code: '7010', name: 'Sales - Takeout', type: 'REVENUE' },
    [ACCOUNTS.SALES_DELIVERY.code]: { code: '7020', name: 'Sales - Delivery', type: 'REVENUE' },
    [ACCOUNTS.TIPS.code]: { code: '7600', name: 'Tips Income', type: 'REVENUE' },
  }
  return mapping[accountCode] || { code: accountCode, name: `Account ${accountCode}`, type: 'REVENUE' }
}

/**
 * Sinhroniziraj knjigovodske vnose z Xero.
 * Pošlje JournalEntry zapise kot Xero ManualJournal objekte.
 */
export async function syncXero(integration: {
  baseUrl: string
  apiKey: string // OAuth access token
  config: string
}): Promise<SyncResult> {
  try {
    const config: XeroConfig = JSON.parse(integration.config || '{}')
    if (!config.tenantId || !integration.apiKey) {
      return { success: false, statusCode: 0, responseData: '{}', error: 'Manjka tenantId ali OAuth access token' }
    }

    // Pridobi knjigovodske vnose iz zadnjih 24h
    const unsyncedEntries = await db.journalEntry.findMany({
      where: {
        status: 'posted',
        referenceType: 'payment',
        date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { lines: true },
      take: 100,
    })

    if (unsyncedEntries.length === 0) {
      return {
        success: true,
        statusCode: 200,
        responseData: JSON.stringify({ synced: 0, message: 'Ni novih vnosov za sinhronizacijo' }),
        error: '',
      }
    }

    const url = 'https://api.xero.com/api.xro/2.0/ManualJournals'
    let syncedCount = 0
    const errors: string[] = []

    for (const entry of unsyncedEntries) {
      // Xero ManualJournal: JournalLines z debit/credit (ne debit/credit v isti vrstici)
      const journalLines = entry.lines.map(line => {
        const account = mapToXeroAccount(line.accountCode)
        return {
          AccountCode: account.code,
          Description: line.description,
          ...(toNum(line.debit) > 0
            ? { NetAmount: round2(toNum(line.debit)) }
            : { NetAmount: -round2(toNum(line.credit)) }),
        }
      })

      const xeroManualJournal = {
        Narration: entry.description,
        Date: new Date(entry.date).toISOString().split('T')[0],
        Reference: entry.entryNumber,
        JournalLines: journalLines,
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${integration.apiKey}`,
            'Xero-tenant-id': config.tenantId,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ManualJournals: [xeroManualJournal] }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          syncedCount++
        } else {
          const errBody = await response.text()
          errors.push(`${entry.entryNumber}: HTTP ${response.status} — ${errBody.slice(0, 200)}`)
        }
      } catch (err) {
        clearTimeout(timeoutId)
        errors.push(`${entry.entryNumber}: ${err instanceof Error ? err.message : 'Network error'}`)
      }
    }

    return {
      success: syncedCount > 0,
      statusCode: 200,
      responseData: JSON.stringify({
        synced: syncedCount,
        total: unsyncedEntries.length,
        ...(errors.length > 0 && { errors: errors.slice(0, 5) }),
      }),
      error: errors.length > 0 ? `${errors.length} napak` : '',
    }
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      responseData: '{}',
      error: error instanceof Error ? error.message : 'Napaka pri Xero sinhronizaciji',
    }
  }
}
