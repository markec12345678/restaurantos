// ============================================
// VIDEO ANALYTICS — Šetenje gostov in heat maps
// ============================================
// Stub implementacija za video analytics.
// V produkciji: ML model (YOLO/TensorFlow) za person detection.
//
// Za MVP:
//   - Sledi sessijam kamere
//   - Beleži peopleIn/peopleOut
//   - Generira heat map data
//   - Calculira currentOccupancy
//
// Hardware integration:
//   - RTSP kamere (preko FFmpeg)
//   - USB kamere (preko OpenCV)
//   - IP kamere (HTTP MJPEG)
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// --- Tipi ---
export interface CameraConfig {
  id: string
  name: string
  locationId?: string
  // Hardware
  source: 'rtsp' | 'usb' | 'ip' | 'simulation'
  url?: string // RTSP ali HTTP URL
  // Detection
  detectionEnabled: boolean
  detectionInterval: number // ms med detekcijami
  // Heat map
  heatmapEnabled: boolean
  gridSize: { width: number; height: number } // mreža za heat map
}

export interface PersonDetection {
  x: number // 0-1 (normalizirano)
  y: number // 0-1
  confidence: number // 0-1
  direction?: 'in' | 'out' | 'stationary'
}

export interface HeatMapPoint {
  x: number
  y: number
  intensity: number // 0-1
}

export interface AnalyticsSnapshot {
  sessionId: string
  timestamp: Date
  peopleIn: number
  peopleOut: number
  currentOccupancy: number
  peakOccupancy: number
  detections: PersonDetection[]
  heatmap: HeatMapPoint[]
}

// --- 1. ZAČNI sejo ---
export async function startSession(config: CameraConfig): Promise<{ sessionId: string }> {
  const session = await db.videoAnalyticsSession.create({
    data: {
      cameraId: config.id,
      cameraName: config.name,
      locationId: config.locationId,
      status: 'active',
    },
  })

  logger.info('VideoAnalytics', `Started session ${session.id} for camera ${config.name}`)
  return { sessionId: session.id }
}

// --- 2. ZAKLJUČI sejo ---
export async function endSession(sessionId: string): Promise<void> {
  await db.videoAnalyticsSession.update({
    where: { id: sessionId },
    data: {
      status: 'stopped',
      endedAt: new Date(),
    },
  })

  logger.info('VideoAnalytics', `Ended session ${sessionId}`)
}

// --- 3. ZABELEŽI detekcijo (called by ML pipeline) ---
export async function recordDetection(
  sessionId: string,
  detections: PersonDetection[],
): Promise<AnalyticsSnapshot> {
  const session = await db.videoAnalyticsSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    throw new Error(`Session ${sessionId} ne obstaja`)
  }

  // Štej in/out glede na direction
  let newPeopleIn = 0
  let newPeopleOut = 0

  for (const detection of detections) {
    if (detection.direction === 'in') newPeopleIn++
    else if (detection.direction === 'out') newPeopleOut++
  }

  const updatedPeopleIn = session.peopleIn + newPeopleIn
  const updatedPeopleOut = session.peopleOut + newPeopleOut
  const updatedOccupancy = Math.max(0, updatedPeopleIn - updatedPeopleOut)
  const updatedPeak = Math.max(session.peakOccupancy, updatedOccupancy)

  // Generiraj heat map (akumulirana)
  const heatmap = generateHeatmap(detections)

  // Posodobi sejo
  await db.videoAnalyticsSession.update({
    where: { id: sessionId },
    data: {
      peopleIn: updatedPeopleIn,
      peopleOut: updatedPeopleOut,
      currentOccupancy: updatedOccupancy,
      peakOccupancy: updatedPeak,
      heatmapData: heatmap as never,
    },
  })

  return {
    sessionId,
    timestamp: new Date(),
    peopleIn: updatedPeopleIn,
    peopleOut: updatedPeopleOut,
    currentOccupancy: updatedOccupancy,
    peakOccupancy: updatedPeak,
    detections,
    heatmap,
  }
}

// --- 4. PRIDOBI trenutno stanje ---
export async function getCurrentStats(locationId?: string) {
  const sessions = await db.videoAnalyticsSession.findMany({
    where: {
      status: 'active',
      ...(locationId ? { locationId } : {}),
    },
    select: {
      id: true,
      cameraId: true,
      cameraName: true,
      peopleIn: true,
      peopleOut: true,
      currentOccupancy: true,
      peakOccupancy: true,
      startedAt: true,
      heatmapData: true,
    },
  })

  const totalOccupancy = sessions.reduce((sum, s) => sum + s.currentOccupancy, 0)
  const totalPeak = sessions.reduce((sum, s) => sum + s.peakOccupancy, 0)

  return {
    activeCameras: sessions.length,
    totalOccupancy,
    totalPeak,
    sessions,
  }
}

// --- 5. PRIDOBI zgodovino ---
export async function getSessionHistory(
  dateFrom: Date,
  dateTo: Date,
  locationId?: string,
) {
  const sessions = await db.videoAnalyticsSession.findMany({
    where: {
      startedAt: { gte: dateFrom, lte: dateTo },
      ...(locationId ? { locationId } : {}),
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      cameraId: true,
      cameraName: true,
      peopleIn: true,
      peopleOut: true,
      currentOccupancy: true,
      peakOccupancy: true,
      startedAt: true,
      endedAt: true,
      status: true,
    },
  })

  return {
    sessions,
    totalSessions: sessions.length,
    totalPeopleIn: sessions.reduce((s, x) => s + x.peopleIn, 0),
    totalPeopleOut: sessions.reduce((s, x) => s + x.peopleOut, 0),
    avgPeak: sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => s + x.peakOccupancy, 0) / sessions.length)
      : 0,
  }
}

// --- Helper: generiraj heat map iz detekcij ---
function generateHeatmap(detections: PersonDetection[]): HeatMapPoint[] {
  // Preprosta implementacija: vsaka detekcija prispeva točko
  // V produkciji: akumuliraj čez čas z decay
  const points: HeatMapPoint[] = []

  for (const det of detections) {
    points.push({
      x: det.x,
      y: det.y,
      intensity: det.confidence,
    })
  }

  return points
}

// --- 6. SIMULIRAJ detekcijo (za testiranje brez prave kamere) ---
export async function simulateDetection(sessionId: string): Promise<AnalyticsSnapshot> {
  // Generiraj random detekcije
  const numDetections = Math.floor(Math.random() * 5) + 1
  const detections: PersonDetection[] = Array.from({ length: numDetections }, () => ({
    x: Math.random(),
    y: Math.random(),
    confidence: 0.7 + Math.random() * 0.3,
    direction: Math.random() > 0.5 ? 'in' : 'out',
  }))

  return recordDetection(sessionId, detections)
}
