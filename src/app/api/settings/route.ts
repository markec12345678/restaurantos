
// GET /api/settings — Pridobi nastavitve restavracije
//
// ⚠️ P0-C3B KNOWN LIMITATION (TODO P0-C4):
// RestaurantSettings je GLOBAL singleton (matična družba config). V multi-tenant
// SaaS setupu meša global in per-tenant polja:
//   - GLOBAL (pravilno tukaj): SMTP, loyalty rules, auto-gratuity, allergen filter
//   - PER-LOCATION (migrirano v P0-C3A): FURS cert, premisesId, registerNumber,
//     businessId, taxId, name, address — zdaj na Location modelu
//   - TODO P0-C4: API keys → nova ApiKey tabela z subscriptionId
// Pravilna arhitektura (P0-C4): razcepi v 3 endpointe:
//   1. /api/settings (global: SMTP, loyalty, gratuity, allergen)
//   2. /api/locations/[id]/settings (per-location: FURS, terminal, branding)
//   3. /api/api-keys (per-subscription: API key management)
// Dokler ni razcepljeno: ta endpoint ostaja za single-tenant admin upravljanje.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { updateSettingsSchema } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('settings', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX AUTH: Zahtevaj avtentikacijo tudi za GET — poslovni podatki niso javni
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    let settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    // Če ni nastavitev, ustvari privzete
    if (!settings) {
      settings = await db.restaurantSettings.create({
        data: {
          name: 'RestaurantOS',
          address: 'Podčetrtk 97',
          city: 'Podčetrtk',
          postCode: '3254',
          phone: '+386 3 818 30 00',
          email: 'info@restaurantos.si',
          businessId: '12345678',
          taxId: 'SI12345678',
          registerNumber: 'BLG-001',
          defaultVatRate: 22.0,
          reducedVatRate: 9.5,
          receiptFooter: 'Hvala za obisk! / Thank you for your visit!',
        }
      })
    }

    // FIX BUG 11 + FIX SECURITY: Ne izpostavi občutljivih podatkov v GET odgovoru
    // - fursCertPassword, fursCertPath: FURS certifikat (že maskirano prej)
    // - cisCertPassword, cisCertPath: CIS certifikat (Task 24, isti vzorec)
    // - emailSmtpPassword: SMTP geslo za pošiljanje email poročil (prej leakano!)
    const { fursCertPassword, fursCertPath, emailSmtpPassword, cisCertPassword, cisCertPath, ...safeSettings } = settings

    // FIX P14: Preberi AI/integration nastavitve iz apiKeys JSON field
    let integrationSettings: Record<string, unknown> = {}
    try {
      const apiKeysRaw = JSON.parse(settings.apiKeys || '{}')
      if (typeof apiKeysRaw === 'object' && !Array.isArray(apiKeysRaw)) {
        integrationSettings = apiKeysRaw
      }
    } catch {
      // apiKeys ni valid JSON — ignore
    }

    // R125 (issue #37): maskirana fursCert*/fursEnvironment v odgovoru so
    // DEPRECATED read-only legacy echo (vrednosti ostanejo od pred migracijo
    // 0012; fiskalizacija jih NIKOLI več uporablja — Location je edini vir).
    // UI naj FURS stanje bere prek /api/locations (hasFursCert flag).
    return NextResponse.json({
      ...safeSettings,
      fursCertPassword: fursCertPassword ? '••••••' : '',
      fursCertPath: fursCertPath ? '••••••' : '', // Skrij pot do certifikata
      hasFursCert: !!(fursCertPath && fursCertPassword), // Povej samo ali obstaja
      // Task 24: CIS polja — isti maskirni vzorec kot FURS
      cisCertPassword: cisCertPassword ? '••••••' : '',
      cisCertPath: cisCertPath ? '••••••' : '',
      hasCisCert: !!(cisCertPath && cisCertPassword),
      emailSmtpPassword: emailSmtpPassword ? '••••••' : '',
      hasEmailConfig: !!(emailSmtpPassword && settings.emailSmtpUser),
      // Integration nastavitve (maskiraj gesla/tokene)
      ...integrationSettings,
      stripeSecretKey: integrationSettings.stripeSecretKey ? '••••••' : '',
      twilioAuthToken: integrationSettings.twilioAuthToken ? '••••••' : '',
      geminiApiKey: integrationSettings.geminiApiKey ? '••••••' : '',
      glovoWebhookSecret: integrationSettings.glovoWebhookSecret ? '••••••' : '',
      woltWebhookSecret: integrationSettings.woltWebhookSecret ? '••••••' : '',
      eracuniApiToken: integrationSettings.eracuniApiToken ? '••••••' : '',
      // Status flagi (ne razkrivajo vrednosti)
      hasGeminiKey: !!integrationSettings.geminiApiKey,
      hasStripe: !!(integrationSettings.stripePublishableKey && integrationSettings.stripeSecretKey),
      hasTwilio: !!(integrationSettings.twilioAccountSid && integrationSettings.twilioAuthToken),
      hasGlovo: !!integrationSettings.glovoWebhookSecret,
      hasWolt: !!integrationSettings.woltWebhookSecret,
      hasEracuni: !!integrationSettings.eracuniApiToken,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/settings', 'Napaka pri pridobivanju nastavitev')
  }
}

// PUT /api/settings — Posodobi nastavitve
export async function PUT(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('settings', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX BUG 11: Zahtevaj admin avtentikacijo za spreminjanje nastavitev
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data as Record<string, unknown>

    // FIX BUG 11: Zod validacija nastavitev
    const { data, error: validationError } = validateBody(updateSettingsSchema, bodyResult.data)
    if (validationError) return validationError

    let settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

    if (!settings) {
      // FIX HIGH: Ustvari z varnimi privzetimi vrednostmi — ne podaj undefined za obvezna polja
      settings = await db.restaurantSettings.create({
        data: {
          name: data.name || 'RestaurantOS',
          address: data.address || '',
          city: data.city || '',
          postCode: data.postCode || '',
          phone: data.phone || '',
          email: data.email || '',
          web: data.web || '',
          businessId: data.businessId || '',
          taxId: data.taxId || '',
          registerNumber: data.registerNumber || 'BLG-001',
          // R125 (issue #37): fursCert* / fursEnvironment se NE pišejo več na
          // Settings (MRTVA polja, DB defaulti) — FURS konfiguracija živi na Location.
          cisCertPath: data.cisCertPath || '',
          cisCertPassword: data.cisCertPassword || '',
          cisEnvironment: data.cisEnvironment || 'test',
          defaultVatRate: data.defaultVatRate ?? 22.0,
          reducedVatRate: data.reducedVatRate ?? 9.5,
          loyaltyEnabled: data.loyaltyEnabled ?? false,
          loyaltyPointsPerEuro: data.loyaltyPointsPerEuro ?? 1,
          loyaltyPointsValue: data.loyaltyPointsValue ?? 0.01,
          receiptFooter: data.receiptFooter || '',
          currency: data.currency || 'EUR',
          locale: data.locale || 'sl-SI',
          country: data.country || 'SI',
        }
      })
    } else {
      // FIX MEDIUM: Ne shrani maskirane vrednosti — ohrani staro (razen če je _clear poslan)
      const updateData = { ...data }
      // R125 (issue #37): FURS polja na Settings so MRTVA — Location je EDINI vir
      // FURS konfiguracije (migration 0012_furs_location_only). Vsak update jih
      // STRIPA pred persisto; Zod shema jih že odstrani (unknown keys) — delete je
      // obrambni. Legacy klienti (UI < R125) ostanejo kompatibilni (tiho ignorirano).
      const legacyFursFields = ['fursCertPath', 'fursCertPassword', 'fursEnvironment'] as const
      if (legacyFursFields.some(f => f in body)) {
        logger.warn(
          'API',
          'FURS polja na Settings so deprecated — nastavite na lokaciji (Location). ' +
            'Zahteva ignorirana (R125, issue #37).',
        )
      }
      for (const f of legacyFursFields) {
        delete (updateData as Record<string, unknown>)[f]
      }
      // Task 24: CIS cert polja — zrcali FURS mask/clear vzorec
      if (updateData.cisCertPassword === '••••••') {
        delete updateData.cisCertPassword
      }
      if (updateData.cisCertPassword === '' && body._clearCisCertPassword === true) {
        updateData.cisCertPassword = ''
      } else if (updateData.cisCertPassword === '') {
        delete updateData.cisCertPassword
      }
      if (updateData.cisCertPath === '••••••') {
        delete updateData.cisCertPath
      }
      if (updateData.cisCertPath === '' && body._clearCisCertPath === true) {
        updateData.cisCertPath = ''
      } else if (updateData.cisCertPath === '') {
        delete updateData.cisCertPath
      }
      // FIX SECURITY: enak pattern za emailSmtpPassword — ne shrani maskirane vrednosti
      if (updateData.emailSmtpPassword === '••••••') {
        delete updateData.emailSmtpPassword
      }
      if (updateData.emailSmtpPassword === '' && body._clearSmtpPassword === true) {
        updateData.emailSmtpPassword = ''
      } else if (updateData.emailSmtpPassword === '') {
        delete updateData.emailSmtpPassword // Ohrani staro če ni ekspliciten _clear
      }

      // FIX P14: Izvleci AI in integracijska polja — ta ne obstajajo kot Prisma kolone.
      // Shranjujejo se v `apiKeys` JSON polje (ki že obstaja v DB).
      const integrationFields = [
        'geminiApiKey', 'aiForecastEnabled', 'aiAssistantEnabled', 'aiVoiceOrderEnabled',
        'stripePublishableKey', 'stripeSecretKey', 'stripeWebhookSecret',
        'twilioAccountSid', 'twilioAuthToken', 'twilioPhoneNumber',
        'glovoWebhookSecret', 'woltWebhookSecret',
        'eracuniApiToken', 'eracuniApiUrl',
      ]
      const integrationData: Record<string, unknown> = {}
      for (const field of integrationFields) {
        if (field in updateData) {
          integrationData[field] = (updateData as Record<string, unknown>)[field]
          delete (updateData as Record<string, unknown>)[field] // Odstrani iz Prisma update-a
        }
      }

      // FIX: emailSmtpPort je sedaj z.coerce.number() v Zod — avtomatska pretvorba

      // Če imamo integration podatke, jih zlij v apiKeys JSON
      if (Object.keys(integrationData).length > 0) {
        // Preberi obstoječi apiKeys JSON
        let existingApiKeys: unknown
        try { existingApiKeys = JSON.parse(settings.apiKeys || '{}') } catch { existingApiKeys = {} }
        const existingIntegrations = (typeof existingApiKeys === 'object' && existingApiKeys !== null && !Array.isArray(existingApiKeys))
          ? existingApiKeys as Record<string, unknown>
          : {}
        const mergedIntegrations = { ...existingIntegrations, ...integrationData }
        ;(updateData as Record<string, unknown>).apiKeys = JSON.stringify(mergedIntegrations)
      }

      settings = await db.restaurantSettings.update({
        where: { id: settings.id },
        data: updateData as typeof updateData & { apiKeys?: string },
      })
    }

    // FIX SECURITY: Ne izpostavi gesel v odgovoru (fursCertPassword + emailSmtpPassword)
    const { fursCertPassword, emailSmtpPassword, fursCertPath, cisCertPassword, cisCertPath, ...safeSettings } = settings

    // FIX P14: Preberi AI/integration nastavitve iz apiKeys JSON field
    let integrationSettings: Record<string, unknown> = {}
    try {
      const apiKeysRaw = JSON.parse(settings.apiKeys || '{}')
      if (typeof apiKeysRaw === 'object' && !Array.isArray(apiKeysRaw)) {
        integrationSettings = apiKeysRaw
      }
    } catch {
      // apiKeys ni valid JSON — ignore
    }

    // R125 (issue #37): maskirana furs polja v odgovoru = deprecated read-only
    // legacy echo (nikoli več uporabljena za fiskalizacijo; UI bere /api/locations).
    return NextResponse.json({
      ...safeSettings,
      fursCertPassword: fursCertPassword ? '••••••' : '',
      fursCertPath: fursCertPath ? '••••••' : '',
      hasFursCert: !!(fursCertPath && fursCertPassword),
      // Task 24: CIS polja — isti maskirni vzorec kot FURS
      cisCertPassword: cisCertPassword ? '••••••' : '',
      cisCertPath: cisCertPath ? '••••••' : '',
      hasCisCert: !!(cisCertPath && cisCertPassword),
      emailSmtpPassword: emailSmtpPassword ? '••••••' : '',
      hasEmailConfig: !!(emailSmtpPassword && settings.emailSmtpUser),
      // Integration nastavitve (maskiraj gesla/tokene)
      ...integrationSettings,
      stripeSecretKey: integrationSettings.stripeSecretKey ? '••••••' : '',
      twilioAuthToken: integrationSettings.twilioAuthToken ? '••••••' : '',
      geminiApiKey: integrationSettings.geminiApiKey ? '••••••' : '',
      glovoWebhookSecret: integrationSettings.glovoWebhookSecret ? '••••••' : '',
      woltWebhookSecret: integrationSettings.woltWebhookSecret ? '••••••' : '',
      eracuniApiToken: integrationSettings.eracuniApiToken ? '••••••' : '',
      // Status flagi (ne razkrivajo vrednosti)
      hasGeminiKey: !!integrationSettings.geminiApiKey,
      hasStripe: !!(integrationSettings.stripePublishableKey && integrationSettings.stripeSecretKey),
      hasTwilio: !!(integrationSettings.twilioAccountSid && integrationSettings.twilioAuthToken),
      hasGlovo: !!integrationSettings.glovoWebhookSecret,
      hasWolt: !!integrationSettings.woltWebhookSecret,
      hasEracuni: !!integrationSettings.eracuniApiToken,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/settings', 'Napaka pri posodabljanju nastavitev')
  }
}
