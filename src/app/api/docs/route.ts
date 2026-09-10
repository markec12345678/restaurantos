// ============================================
// GET /api/docs — Redirect to Swagger UI
// ============================================
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.redirect(new URL('/api-docs/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}
