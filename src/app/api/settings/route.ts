
// GET /api/settings — Pridobi nastavitve restavracije
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { updateSettingsSchema } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('settings', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

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
    // - emailSmtpPassword: SMTP geslo za pošiljanje email poročil (prej leakano!)
    const { fursCertPassword, fursCertPath, emailSmtpPassword, ...safeSettings } = settings
    return NextResponse.json({
      ...safeSettings,
      fursCertPassword: fursCertPassword ? '••••••' : '',
      fursCertPath: fursCertPath ? '••••••' : '', // Skrij pot do certifikata
      hasFursCert: !!(fursCertPath && fursCertPassword), // Povej samo ali obstaja
      emailSmtpPassword: emailSmtpPassword ? '••••••' : '',
      hasEmailConfig: !!(emailSmtpPassword && settings.emailSmtpUser),
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
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

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
          fursCertPath: data.fursCertPath || '',
          fursCertPassword: data.fursCertPassword || '',
          fursEnvironment: data.fursEnvironment || 'test',
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
      if (updateData.fursCertPassword === '••••••') {
        delete updateData.fursCertPassword
      }
      // FIX HIGH: Omogoči počiščenje cert polj — prazen string z _clear flagom
      if (updateData.fursCertPassword === '' && body._clearCertPassword === true) {
        updateData.fursCertPassword = ''
      } else if (updateData.fursCertPassword === '') {
        delete updateData.fursCertPassword // Ohrani staro če ni ekspliciten _clear
      }
      if (updateData.fursCertPath === '••••••') {
        delete updateData.fursCertPath
      }
      // FIX HIGH: Omogoči počiščenje cert poti — prazen string z _clear flagom
      if (updateData.fursCertPath === '' && body._clearCertPath === true) {
        updateData.fursCertPath = ''
      } else if (updateData.fursCertPath === '') {
        delete updateData.fursCertPath // Ohrani staro če ni ekspliciten _clear
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

      settings = await db.restaurantSettings.update({
        where: { id: settings.id },
        data: updateData,
      })
    }

    // FIX SECURITY: Ne izpostavi gesel v odgovoru (fursCertPassword + emailSmtpPassword)
    const { fursCertPassword, emailSmtpPassword, ...safeSettings } = settings
    return NextResponse.json({
      ...safeSettings,
      fursCertPassword: fursCertPassword ? '••••••' : '',
      emailSmtpPassword: emailSmtpPassword ? '••••••' : '',
    })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/settings', 'Napaka pri posodabljanju nastavitev')
  }
}
