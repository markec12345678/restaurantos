import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateSettingsSchema } from '@/lib/validations'

// GET /api/settings — Pridobi nastavitve restavracije
export async function GET(req: Request) {
  try {
    // GET je javno dostopen za prikaz na blagajni (npr. ime restavracije na računu)
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

    // FIX BUG 11: Ne izpostavi občutljivih podatkov v GET odgovoru
    const { fursCertPassword, fursCertPath, ...safeSettings } = settings
    return NextResponse.json({
      ...safeSettings,
      fursCertPassword: fursCertPassword ? '••••••' : '',
      fursCertPath: fursCertPath ? '••••••' : '', // Skrij pot do certifikata
      hasFursCert: !!(fursCertPath && fursCertPassword), // Povej samo ali obstaja
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju nastavitev' }, { status: 500 })
  }
}

// PUT /api/settings — Posodobi nastavitve
export async function PUT(req: Request) {
  try {
    // FIX BUG 11: Zahtevaj admin avtentikacijo za spreminjanje nastavitev
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 11: Zod validacija nastavitev
    const { data, error: validationError } = validateBody(updateSettingsSchema, body)
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

      settings = await db.restaurantSettings.update({
        where: { id: settings.id },
        data: updateData,
      })
    }

    // Ne izpostavi gesla
    const { fursCertPassword, ...safeSettings } = settings
    return NextResponse.json({ ...safeSettings, fursCertPassword: fursCertPassword ? '••••••' : '' })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju nastavitev' }, { status: 500 })
  }
}
