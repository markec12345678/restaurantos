// ============================================
// QUICKBOOKS ONLINE SYNC — pošiljanje JournalEntry v QuickBooks
// Uporablja Intuit REST API v3 (OAuth 2.0 Bearer token)
// ============================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { ACCOUNTS } from '@/lib/accounting/journal-generator'
import type { SyncResult } from './types'

interface QuickBooksConfig {
  clientId: string
  clientSecret: string
  refreshToken?: string
  realmId: string
  environment: 'production' | 'sandbox'
  accountMapping: 'auto' | 'manual'
}

/** QuickBooks API base URL (production or sandbox) */
function getQbBaseUrl(config: QuickBooksConfig): string {
  return config.environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}

/** Mapiranje RestaurantOS kontov → QuickBooks Account names */
function mapToQbAccount(accountCode: string): { name: string; type: string } {
  const mapping: Record<string, { name: string; type: string }> = {
    [ACCOUNTS.CASH.code]: { name: 'Cash on Hand', type: 'Bank' },
    [ACCOUNTS.BANK.code]: { name: 'Checking Account', type: 'Bank' },
    [ACCOUNTS.VAT_OUTPUT.code]: { name: 'Sales Tax Payable', type: 'Other Current Liability' },
    [ACCOUNTS.SALES_DINEIN.code]: { name: 'Sales - Dine In', type: 'Income' },
    [ACCOUNTS.SALES_TAKEOUT.code]: { name: 'Sales - Takeout', type: 'Income' },
    [ACCOUNTS.SALES_DELIVERY.code]: { name: 'Sales - Delivery', type: 'Income' },
    [ACCOUNTS.TIPS.code]: { name: 'Tips Income', type: 'Income' },
  }
  return mapping[accountCode] || { name: `Account ${accountCode}`, type: 'Income' }
}

/**
 * Sinhroniziraj knjigovodske vnose z QuickBooks Online.
 * Pošlje JournalEntry zapise (ki še niso bili sinhronizirani) kot QuickBooks JournalEntry objekte.
 */
export async function syncQuickBooks(integration: {
  baseUrl: string
  apiKey: string // OAuth access token (refreshed by scheduler)
  config: string
}): Promise<SyncResult> {
  try {
    const config: QuickBooksConfig = JSON.parse(integration.config || '{}')
    if (!config.realmId || !integration.apiKey) {
      return { success: false, statusCode: 0, responseData: '{}', error: 'Manjka realmId ali OAuth access token' }
    }

    // Pridobi knjigovodske vnose, ki še niso bili sinhronizirani v QB
    // (uporabljamo referenceType + opombo v audit log za tracking)
    const unsyncedEntries = await db.journalEntry.findMany({
      where: {
        status: 'posted',
        referenceType: 'payment',
        // FIX: Dodali bi syncStatus polje za tracking; zaenkrat uporabimo datumski filter
        date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // zadnjih 24h
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

    const baseUrl = getQbBaseUrl(config)
    const url = `${baseUrl}/v3/company/${config.realmId}/journalentry`
    let syncedCount = 0
    const errors: string[] = []

    for (const entry of unsyncedEntries) {
      const qbJournalEntry = {
        DocNumber: entry.entryNumber,
        TxnDate: new Date(entry.date).toISOString().split('T')[0],
        PrivateNote: entry.description,
        Line: entry.lines.map(line => {
          const account = mapToQbAccount(line.accountCode)
          return {
            Id: line.id,
            Description: line.description,
            Amount: round2(toNum(line.debit) || toNum(line.credit)),
            DetailType: 'JournalEntryLineDetail',
            JournalEntryLineDetail: {
              PostingType: toNum(line.debit) > 0 ? 'Debit' : 'Credit',
              Account: {
                Name: account.name,
                AccountType: account.type,
              },
            },
          }
        }),
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(qbJournalEntry),
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
      error: error instanceof Error ? error.message : 'Napaka pri QuickBooks sinhronizaciji',
    }
  }
}
