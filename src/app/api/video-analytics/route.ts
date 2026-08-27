// ============================================
// /api/video-analytics — Camera analytics
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import {
  startSession,
  endSession,
  getCurrentStats,
  getSessionHistory,
  simulateDetection,
  type CameraConfig,
} from '@/lib/video-analytics'

export const dynamic = 'force-dynamic'

// GET — current stats ali history
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId') || undefined
    const history = searchParams.get('history') === '1'

    if (history) {
      const dateFrom = searchParams.get('dateFrom')
        ? new Date(searchParams.get('dateFrom')!)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const dateTo = searchParams.get('dateTo')
        ? new Date(searchParams.get('dateTo')!)
        : new Date()
      const result = await getSessionHistory(dateFrom, dateTo, locationId)
      return NextResponse.json(result)
    }

    const stats = await getCurrentStats(locationId)
    return NextResponse.json(stats)
  } catch (err) {
    return handleApiError(err, 'video-analytics GET')
  }
}

const actionSchema = z.object({
  action: z.enum(['start', 'stop', 'simulate']),
  // Za start
  camera: z.object({
    id: z.string(),
    name: z.string(),
    locationId: z.string().optional(),
    source: z.enum(['rtsp', 'usb', 'ip', 'simulation']).default('simulation'),
    url: z.string().optional(),
    detectionEnabled: z.boolean().default(true),
    detectionInterval: z.number().default(5000),
    heatmapEnabled: z.boolean().default(true),
    gridSize: z.object({ width: z.number(), height: z.number() }).default({ width: 10, height: 10 }),
  }).optional(),
  // Za stop/simulate
  sessionId: z.string().optional(),
})

// POST — start/stop/simulate
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const input = actionSchema.parse(body)

    if (input.action === 'start') {
      if (!input.camera) {
        return NextResponse.json({ error: 'camera config je obvezen za start' }, { status: 400 })
      }
      const result = await startSession(input.camera as CameraConfig)
      return NextResponse.json({ success: true, ...result }, { status: 201 })
    }

    if (input.action === 'stop') {
      if (!input.sessionId) {
        return NextResponse.json({ error: 'sessionId je obvezen za stop' }, { status: 400 })
      }
      await endSession(input.sessionId)
      return NextResponse.json({ success: true })
    }

    if (input.action === 'simulate') {
      if (!input.sessionId) {
        return NextResponse.json({ error: 'sessionId je obvezen za simulate' }, { status: 400 })
      }
      const result = await simulateDetection(input.sessionId)
      return NextResponse.json({ success: true, snapshot: result })
    }

    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'video-analytics POST')
  }
}
