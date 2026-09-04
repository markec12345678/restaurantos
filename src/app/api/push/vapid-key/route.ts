// ============================================
// GET /api/push/vapid-key — Vrni javni VAPID ključ za klienta
// ============================================

import { NextResponse } from 'next/server'
import { isPushConfigured, getVapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({
      configured: false,
      message: 'Push notifications niso konfigurirani. Nastavi VAPID_PUBLIC_KEY in VAPID_PRIVATE_KEY v .env',
    })
  }

  return NextResponse.json({
    configured: true,
    publicKey: getVapidPublicKey(),
  })
}
