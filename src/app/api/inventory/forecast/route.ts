// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE
// Napoveduje povpraševanje, predlaga naročila,
// prepozna sezonske vzorce in tveganja zmanjkanja
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { getForecastData } from './_helpers'

export async function GET(req: Request) {
  try {
    // FIX HIGH: Require manage_inventory permission for forecast data
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX MEDIUM: Validiraj days parameter — prepreči nesmiselne vrednosti
    const rawDays = parseInt(searchParams.get('days') || '90')
    const days = Math.min(Math.max(Number.isNaN(rawDays) ? 90 : rawDays, 7), 365)
    const category = searchParams.get('category') || ''

    const { summary, forecasts } = await getForecastData(days, category)

    return NextResponse.json({ summary, forecasts })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/forecast', 'Napaka pri napovedovanju zaloge')
  }
}
