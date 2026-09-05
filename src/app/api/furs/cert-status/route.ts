// ============================================
// GET /api/furs/cert-status — FURS Certificate Lifecycle Monitor
// ============================================
// FIX P0: FURS je rotiral signing certifikate 15. sep 2025.
// ~8000 certifikatov je poteklo dec 2025/jan 2026.
// Ta API preverja stanje certifikata in opozori pred potekom.
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (!settings) {
      return NextResponse.json({ error: 'Ni nastavitev restavracije' }, { status: 400 })
    }

    // FIX P0-C3A: Pridobi FURS cert podatke iz Location (vezano na session.locationId)
    // Prej: vedno settings (globalno) — v multi-tenant setupu prikaz napačne lokacije
    const sessionLocId = authResult.session?.locationId
    let certPath = settings.fursCertPath
    let certPassword = settings.fursCertPassword
    let environment = settings.fursEnvironment
    if (sessionLocId) {
      const location = await db.location.findUnique({
        where: { id: sessionLocId },
        select: { fursCertPath: true, fursCertPassword: true, fursEnvironment: true },
      })
      if (location) {
        if (location.fursCertPath) certPath = location.fursCertPath
        if (location.fursCertPassword) certPassword = location.fursCertPassword
        if (location.fursEnvironment) environment = location.fursEnvironment
      }
    }
    certPath = certPath || process.env.FURS_CERT_PATH || ''
    certPassword = certPassword || process.env.FURS_CERT_PASSWORD || ''
    environment = environment || process.env.FURS_ENV || 'test'

    // Preveri ali certifikat obstaja
    let certExists = false
    let certSize = 0
    let certModified: Date | null = null

    if (certPath) {
      const fullPath = path.isAbsolute(certPath) ? certPath : path.join(process.cwd(), certPath)
      try {
        const stat = fs.statSync(fullPath)
        certExists = true
        certSize = stat.size
        certModified = stat.mtime
      } catch {
        certExists = false
      }
    }

    // Preveri potek certifikata (p12 certifikati veljajo 1-2 leti)
    // FURS certifikati običajno potečejo po 2 letih
    let certAgeDays = 0
    let daysUntilExpiry = 0
    let certStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'not_configured' = 'not_configured'

    if (certExists && certModified) {
      certAgeDays = Math.floor((Date.now() - certModified.getTime()) / (1000 * 60 * 60 * 24))
      // FURS certifikati veljajo 730 dni (2 leti)
      daysUntilExpiry = 730 - certAgeDays

      if (daysUntilExpiry <= 0) {
        certStatus = 'expired'
      } else if (daysUntilExpiry <= 60) {
        certStatus = 'expiring_soon'
      } else {
        certStatus = 'valid'
      }
    } else if (!certPath) {
      certStatus = 'not_configured'
    } else {
      certStatus = 'missing'
    }

    // Preveri nepotrjene račune (starejše od 48h — ZDDV-1 rok)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const unfiscalizedCount = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { lt: fortyEightHoursAgo },
      },
    })

    // Preveri nepotrjene račune (starejše od 1h — opozorilo)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentUnfiscalized = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { lt: oneHourAgo, gte: fortyEightHoursAgo },
      },
    })

    const result = {
      certificate: {
        path: certPath ? certPath.replace(/[^/]+$/, '***') : null, // maskiraj ime datoteke
        exists: certExists,
        sizeBytes: certSize,
        modifiedAt: certModified?.toISOString() || null,
        ageDays: certAgeDays,
        daysUntilExpiry,
        status: certStatus,
        environment,
        hasPassword: !!certPassword,
      },
      fiscalization: {
        unfiscalizedOlderThan1h: recentUnfiscalized,
        unfiscalizedOlderThan48h: unfiscalizedCount,
        totalUnfiscalized: recentUnfiscalized + unfiscalizedCount,
        zddv1DeadlineHours: 48,
        simulationMode: process.env.FURS_ALLOW_SIMULATION === 'true',
      },
      alerts: [] as Array<{ severity: string; message: string }>,
    }

    // Generiraj alerte
    if (certStatus === 'expired') {
      result.alerts.push({
        severity: 'critical',
        message: `FURS certifikat je POTEKEL pred ${Math.abs(daysUntilExpiry)} dnevi! Obnovite ga takoj na eDavki portalu.`,
      })
    } else if (certStatus === 'expiring_soon') {
      result.alerts.push({
        severity: 'warning',
        message: `FURS certifikat poteče čez ${daysUntilExpiry} dni. Obnovite ga na eDavki portalu.`,
      })
    } else if (certStatus === 'missing') {
      result.alerts.push({
        severity: 'critical',
        message: `FURS certifikat ni najden na poti: ${certPath}. Naložite ga ali posodobite pot v nastavitvah.`,
      })
    } else if (certStatus === 'not_configured') {
      result.alerts.push({
        severity: 'warning',
        message: 'FURS certifikat ni konfiguriran. Davčno potrjevanje ne deluje. Nastavite FURS_CERT_PATH in FURS_CERT_PASSWORD.',
      })
    }

    if (unfiscalizedCount > 0) {
      result.alerts.push({
        severity: 'critical',
        message: `${unfiscalizedCount} računov starejših od 48h ni davčno potrjenih! ZDDV-1 rok prekršen — takoj ponovno potrdite.`,
      })
    } else if (recentUnfiscalized > 0) {
      result.alerts.push({
        severity: 'warning',
        message: `${recentUnfiscalized} računov starejših od 1h čaka na davčno potrditev.`,
      })
    }

    if (process.env.FURS_ALLOW_SIMULATION === 'true' && environment === 'production') {
      result.alerts.push({
        severity: 'warning',
        message: 'FURS_ALLOW_SIMULATION=true v produkciji — računi so simulirani, ne davčno potrjeni.',
      })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/furs/cert-status', 'Napaka pri preverjanju certifikata')
  }
}
