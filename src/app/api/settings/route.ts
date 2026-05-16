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
      settings = await db.restaurantSettings.create({ data: data as any })
    } else {
      // Ne shrani praznega gesla — ohrani staro
      const updateData = { ...data }
      if (updateData.fursCertPassword === '••••••' || updateData.fursCertPassword === '') {
        delete updateData.fursCertPassword
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
