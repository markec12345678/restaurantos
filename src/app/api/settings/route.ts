import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/settings — Pridobi nastavitve restavracije
export async function GET() {
  try {
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
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju nastavitev' }, { status: 500 })
  }
}

// PUT /api/settings — Posodobi nastavitve
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    
    let settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    
    if (!settings) {
      settings = await db.restaurantSettings.create({ data: body })
    } else {
      settings = await db.restaurantSettings.update({
        where: { id: settings.id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.city !== undefined && { city: body.city }),
          ...(body.postCode !== undefined && { postCode: body.postCode }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.web !== undefined && { web: body.web }),
          ...(body.businessId !== undefined && { businessId: body.businessId }),
          ...(body.taxId !== undefined && { taxId: body.taxId }),
          ...(body.registerNumber !== undefined && { registerNumber: body.registerNumber }),
          ...(body.fursCertPath !== undefined && { fursCertPath: body.fursCertPath }),
          ...(body.fursCertPassword !== undefined && { fursCertPassword: body.fursCertPassword }),
          ...(body.fursEnvironment !== undefined && { fursEnvironment: body.fursEnvironment }),
          ...(body.defaultVatRate !== undefined && { defaultVatRate: body.defaultVatRate }),
          ...(body.reducedVatRate !== undefined && { reducedVatRate: body.reducedVatRate }),
          ...(body.receiptFooter !== undefined && { receiptFooter: body.receiptFooter }),
        }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju nastavitev' }, { status: 500 })
  }
}
