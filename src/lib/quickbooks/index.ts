// ============================================
// QUICKBOOKS ONLINE — OAuth 2.0 + Sync engine
// ============================================
// Za sinhronizacijo z QuickBooks Online (Intuit).
//
// OAuth 2.0 flow:
//   1. User klikne "Connect QuickBooks" → redirect na Intuit auth
//   2. Intuit redirecta nazaj na /api/quickbooks/callback?code=xxx
//   3. Server exchange-a code za access_token + refresh_token
//   4. Tokeni shranjeni v QuickBooksSync (encrypted)
//
// Sync flow:
//   1. Cron job pokliče /api/quickbooks/sync
//   2. Za vsako entiteto (customer, payment, invoice, journal):
//      - Pridobi nove/posodobljene od zadnje sinhronizacije
//      - Pošlje na QBO API
//      - Zabeleži rezultat v QuickBooksSyncLog
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum, round2 } from '@/lib/decimal'
import crypto from 'crypto'

// --- Konstante ---
const QBO_BASE_URL = 'https://quickbooks.api.intuit.com'
const QBO_SANDBOX_URL = 'https://sandbox-quickbooks.api.intuit.com'
const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

// --- Tipi ---
export interface QBOConfig {
  clientId: string
  clientSecret: string
  environment: 'production' | 'sandbox'
  redirectUri: string
}

export interface QBOTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  x_refresh_token_expires_in: number
}

export interface QBOSyncResult {
  success: boolean
  entityType: string
  entityId: string
  qbEntityId?: string
  error?: string
}

export interface QBOCustomer {
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
  }
}

export interface QBOPayment {
  CustomerRef: { value: string }
  TotalAmt: number
  CurrencyRef?: { value: string }
  PaymentMethodRef?: { value: string }
  PrivateNote?: string
}

// --- Config helper ---
function getConfig(): QBOConfig | null {
  const clientId = process.env.QBO_CLIENT_ID
  const clientSecret = process.env.QBO_CLIENT_SECRET
  const redirectUri = process.env.QBO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return null
  }

  return {
    clientId,
    clientSecret,
    environment: (process.env.QBO_ENVIRONMENT as 'production' | 'sandbox') || 'sandbox',
    redirectUri,
  }
}

// --- 1. GENERATE OAuth URL ---
export function getAuthUrl(state: string): string | null {
  const config = getConfig()
  if (!config) return null

  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  })

  return `${INTUIT_AUTH_URL}?${params.toString()}`
}

// --- 2. EXCHANGE code za tokens ---
export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
): Promise<{ success: boolean; syncId?: string; error?: string }> {
  const config = getConfig()
  if (!config) {
    return { success: false, error: 'QBO konfiguracija manjka' }
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    })

    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const res = await fetch(INTUIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body,
    })

    if (!res.ok) {
      const errorText = await res.text()
      logger.error('QBO', `Token exchange failed: ${errorText}`)
      return { success: false, error: `HTTP ${res.status}: ${errorText}` }
    }

    const tokens = await res.json() as QBOTokenResponse

    // Encrypt tokens pred shranjevanjem
    const encryptedAccess = encrypt(tokens.access_token)
    const encryptedRefresh = encrypt(tokens.refresh_token)

    // Pridobi company info
    const companyInfo = await getCompanyInfo(tokens.access_token, realmId, config.environment)

    // Shrani v DB (upsert glede na realmId)
    const sync = await db.quickBooksSync.upsert({
      where: { realmId },
      create: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        realmId,
        companyId: companyInfo?.CompanyName || '',
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
        lastSyncStatus: 'never',
        isActive: true,
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        companyId: companyInfo?.CompanyName || '',
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
        isActive: true,
      },
    })

    logger.info('QBO', `Connected QBO for realm ${realmId} (${companyInfo?.CompanyName || 'unknown'})`)
    return { success: true, syncId: sync.id }
  } catch (err) {
    logger.error('QBO', `Token exchange error: ${err}`)
    return { success: false, error: err instanceof Error ? err.message : 'Neznana napaka' }
  }
}

// --- 3. REFRESH token ---
export async function refreshToken(syncId: string): Promise<{ success: boolean; error?: string }> {
  const config = getConfig()
  if (!config) return { success: false, error: 'QBO konfiguracija manjka' }

  const sync = await db.quickBooksSync.findUnique({ where: { id: syncId } })
  if (!sync) return { success: false, error: 'Sync record ne obstaja' }

  const refreshTokenPlain = decrypt(sync.refreshToken)

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenPlain,
    })

    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const res = await fetch(INTUIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body,
    })

    if (!res.ok) {
      return { success: false, error: `Refresh failed: HTTP ${res.status}` }
    }

    const tokens = await res.json() as QBOTokenResponse

    await db.quickBooksSync.update({
      where: { id: syncId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
      },
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Neznana napaka' }
  }
}

// --- 4. API CALL helper ---
async function qboApiCall(
  syncId: string,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<{ success: boolean; data?: unknown; error?: string; status?: number }> {
  const sync = await db.quickBooksSync.findUnique({ where: { id: syncId } })
  if (!sync) return { success: false, error: 'Sync record ne obstaja' }

  // Preveri ali token poteka (5 min buffer)
  if (sync.accessTokenExpiresAt && sync.accessTokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshResult = await refreshToken(syncId)
    if (!refreshResult.success) {
      return { success: false, error: `Token refresh failed: ${refreshResult.error}` }
    }
  }

  const config = getConfig()
  if (!config) return { success: false, error: 'QBO konfiguracija manjka' }

  const baseUrl = config.environment === 'production' ? QBO_BASE_URL : QBO_SANDBOX_URL
  const url = `${baseUrl}/v3/company/${sync.realmId}/${endpoint}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${decrypt(sync.accessToken)}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: (data as { fault?: { error?: Array<{ message?: string }> } })?.fault?.error?.[0]?.message || `HTTP ${res.status}`,
      }
    }

    return { success: true, data, status: res.status }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Neznana napaka' }
  }
}

// --- 5. GET COMPANY INFO ---
async function getCompanyInfo(accessToken: string, realmId: string, environment: 'production' | 'sandbox') {
  const baseUrl = environment === 'production' ? QBO_BASE_URL : QBO_SANDBOX_URL
  const url = `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return null
    const data = await res.json() as { CompanyInfo?: { CompanyName?: string } }
    return data.CompanyInfo
  } catch {
    return null
  }
}

// --- 6. SYNC CUSTOMER ---
export async function syncCustomer(syncId: string, customer: QBOCustomer): Promise<QBOSyncResult> {
  const result = await qboApiCall(syncId, 'POST', 'customer', customer)

  if (!result.success) {
    return { success: false, entityType: 'customer', entityId: customer.DisplayName, error: result.error }
  }

  const qbId = (result.data as { Customer?: { Id?: string } })?.Customer?.Id
  return { success: true, entityType: 'customer', entityId: customer.DisplayName, qbEntityId: qbId }
}

// --- 7. SYNC PAYMENT ---
export async function syncPayment(syncId: string, payment: QBOPayment): Promise<QBOSyncResult> {
  const result = await qboApiCall(syncId, 'POST', 'payment', payment)

  if (!result.success) {
    return { success: false, entityType: 'payment', entityId: payment.CustomerRef.value, error: result.error }
  }

  const qbId = (result.data as { Payment?: { Id?: string } })?.Payment?.Id
  return { success: true, entityType: 'payment', entityId: payment.CustomerRef.value, qbEntityId: qbId }
}

// --- 8. SYNC JOURNAL ENTRY ---
export async function syncJournalEntry(
  syncId: string,
  journalEntry: {
    Line: Array<{
      DetailType: string
      JournalEntryLineDetail: {
        PostingType: 'Debit' | 'Credit'
        AccountRef: { value: string }
        Amount: number
      }
    }>
    TxnDate: string
    PrivateNote?: string
  },
): Promise<QBOSyncResult> {
  const result = await qboApiCall(syncId, 'POST', 'journalentry', journalEntry)

  if (!result.success) {
    return { success: false, entityType: 'journal', entityId: journalEntry.TxnDate, error: result.error }
  }

  const qbId = (result.data as { JournalEntry?: { Id?: string } })?.JournalEntry?.Id
  return { success: true, entityType: 'journal', entityId: journalEntry.TxnDate, qbEntityId: qbId }
}

// --- 9. RUN FULL SYNC ---
export async function runFullSync(syncId: string): Promise<{
  success: boolean
  results: QBOSyncResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}> {
  const sync = await db.quickBooksSync.findUnique({ where: { id: syncId } })
  if (!sync) {
    return { success: false, results: [], summary: { total: 0, succeeded: 0, failed: 0 } }
  }

  const results: QBOSyncResult[] = []

  // 1. Sync customers (guests)
  const lastCustomerSync = sync.lastCustomerSync || new Date(0)
  const guests = await db.guest.findMany({
    where: { updatedAt: { gt: lastCustomerSync } },
    take: 100,
  }).catch(() => [])

  for (const guest of guests) {
    const customer: QBOCustomer = {
      DisplayName: `${guest.firstName} ${guest.lastName}`.trim() || `Guest ${guest.id.substring(0, 8)}`,
      PrimaryEmailAddr: guest.email ? { Address: guest.email } : undefined,
      PrimaryPhone: guest.phone ? { FreeFormNumber: guest.phone } : undefined,
    }
    const result = await syncCustomer(syncId, customer)
    results.push(result)

    // Log
    await db.quickBooksSyncLog.create({
      data: {
        syncId,
        entityType: 'customer',
        entityId: guest.id,
        qbEntityId: result.qbEntityId,
        status: result.success ? 'success' : 'failed',
        action: 'create',
        errorMessage: result.error || '',
        requestPayload: customer as never,
        syncedAt: result.success ? new Date() : null,
      },
    }).catch(() => {})
  }

  // 2. Sync payments
  const lastPaymentSync = sync.lastPaymentSync || new Date(0)
  const payments = await db.payment.findMany({
    where: { createdAt: { gt: lastPaymentSync } },
    take: 100,
  }).catch(() => [])

  for (const payment of payments) {
    const paymentData: QBOPayment = {
      CustomerRef: { value: '1' }, // Placeholder — v produkciji map guest → QB customer
      TotalAmt: round2(toNum(payment.amount)),
      CurrencyRef: { value: 'EUR' },
      PaymentMethodRef: payment.type === 'cash' ? { value: '1' } : { value: '2' },
      PrivateNote: `Payment ${payment.id}`,
    }
    const result = await syncPayment(syncId, paymentData)
    results.push(result)

    await db.quickBooksSyncLog.create({
      data: {
        syncId,
        entityType: 'payment',
        entityId: payment.id,
        qbEntityId: result.qbEntityId,
        status: result.success ? 'success' : 'failed',
        action: 'create',
        errorMessage: result.error || '',
        syncedAt: result.success ? new Date() : null,
      },
    }).catch(() => {})
  }

  // Posodobi sync state
  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  await db.quickBooksSync.update({
    where: { id: syncId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: failed === 0 ? 'success' : succeeded > 0 ? 'partial' : 'failed',
      lastSyncError: failed > 0 ? `${failed} od ${results.length} sinhronizacij failed` : '',
      lastCustomerSync: new Date(),
      lastPaymentSync: new Date(),
    },
  })

  logger.info('QBO', `Sync completed: ${succeeded}/${results.length} succeeded`)

  return {
    success: failed === 0,
    results,
    summary: { total: results.length, succeeded, failed },
  }
}

// --- ENCRYPTION helpers ---
function encrypt(text: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret.padEnd(32).substring(0, 32)), Buffer.alloc(16, 0))
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function decrypt(encrypted: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret.padEnd(32).substring(0, 32)), Buffer.alloc(16, 0))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// --- DISCONNECT ---
export async function disconnectQBO(syncId: string): Promise<boolean> {
  await db.quickBooksSync.update({
    where: { id: syncId },
    data: {
      isActive: false,
      accessToken: '',
      refreshToken: '',
    },
  }).catch(() => false)
  return true
}

// --- GET STATUS ---
export async function getSyncStatus(syncId: string) {
  const sync = await db.quickBooksSync.findUnique({
    where: { id: syncId },
    select: {
      id: true,
      realmId: true,
      companyId: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      isActive: true,
    },
  })
  return sync
}
