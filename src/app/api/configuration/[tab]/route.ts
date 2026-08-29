// GET /api/configuration/[tab] — Vrni specifično kategorijo konfiguracije
//
// FIX NAPAKA 5 (HTTP 404): Komponente so klicale /api/configuration/dining-options,
// /api/configuration/price-groups, /api/configuration/void-reasons,
// /api/configuration/alt-payment-types — ki prej niso obstajale kot ločeni route-i.
//
// Ta route shrani konfiguracijo specifično za podan tab parameter in vrne
// samo tiste podatke, ki jih komponenta potrebuje.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { modelMap } from '../_helpers'

export const dynamic = 'force-dynamic'

// Mapiranje tab → Prisma model + select polja
const tabConfig: Record<string, {
  model: string
  select: Record<string, boolean>
  include?: Record<string, unknown>
  orderBy?: Record<string, string>
}> = {
  'dining-options': {
    model: 'diningOption',
    select: { id: true, name: true, type: true, serviceChargeId: true, prepTimeMinutes: true, isActive: true, sortOrder: true },
    include: { serviceCharge: { select: { id: true, name: true, type: true, amount: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  'price-groups': {
    model: 'priceGroup',
    select: { id: true, name: true, description: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'void-reasons': {
    model: 'voidReason',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'no-sale-reasons': {
    model: 'noSaleReason',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'alt-payment-types': {
    model: 'alternatePaymentType',
    select: { id: true, name: true, code: true, type: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'tax-rates': {
    model: 'taxRate',
    select: { id: true, name: true, rate: true, code: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'revenue-centers': {
    model: 'revenueCenter',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'sales-categories': {
    model: 'salesCategory',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'service-charges': {
    model: 'serviceCharge',
    select: { id: true, name: true, type: true, amount: true, isAutoApply: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'prep-stations': {
    model: 'prepStation',
    select: { id: true, name: true, type: true, avgPrepTime: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  printers: {
    model: 'printer',
    select: { id: true, name: true, type: true, location: true, ipAddress: true, printRules: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  discounts: {
    model: 'discount',
    select: { id: true, name: true, type: true, amount: true, appliesTo: true, triggerType: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
}

// GET — vrni specifično konfiguracijo za tab
export async function GET(req: Request, { params }: { params: Promise<{ tab: string }> }) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { tab } = await params
    const config = tabConfig[tab]
    if (!config) {
      return NextResponse.json(
        { error: `Neveljaven konfiguracijski tab: ${tab}` },
        { status: 400 }
      )
    }

    // Dynamic Prisma query — model ime iz tabConfig
    const prismaModel = modelMap[tab] || config.model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = (db as unknown as Record<string, unknown>)[prismaModel] as
      | { findMany: (args: Record<string, unknown>) => Promise<unknown[]> }
      | undefined

    if (!prisma || typeof prisma.findMany !== 'function') {
      return NextResponse.json(
        { error: `Model '${prismaModel}' ni na voljo` },
        { status: 500 }
      )
    }

    const result = await prisma.findMany({
      select: config.select,
      orderBy: config.orderBy || { sortOrder: 'asc' },
      ...(config.include ? { include: config.include } : {}),
    })

    // Vrni v objektu z imenom tab-a kot ključem (konsistentno s /api/configuration)
    // npr. { diningOptions: [...] }, { priceGroups: [...] }
    // Uporabljamo camelCase ime iz modelMap
    const responseKey = prismaModel.charAt(0).toLowerCase() + prismaModel.slice(1)
    // Poseben primer: alternatePaymentType → alternatePaymentTypes (množina)
    const finalKey = responseKey.endsWith('s') ? responseKey : `${responseKey}s`
    return NextResponse.json({ [finalKey]: deepToNumbers(result) })
  } catch (error: unknown) {
    return handleApiError(error, `GET /api/configuration/${(await params).tab}`, 'Napaka pri pridobivanju konfiguracije')
  }
}
