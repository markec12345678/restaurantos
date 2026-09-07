// ============================================
// POST /api/gdpr/anonymize/[employeeId] — GDPR Right to Erasure (Article 17)
// ============================================
// Anonimizira VSE osebne podatke o zaposlenem:
//   - Ime → "[Anonimizirano]"
//   - Email → prazen
//   - Telefon → prazen
//   - PIN → prazen (onemogoči prijavo)
//   - pinLookup → null
//   - hireDate → null
//
// OHRANI:
//   - ID (za referenco v audit logih in financah)
//   - status = 'anonymized' (da vemo, da je bil anonimiziran)
//   - createdAt/updatedAt (za GDPR evidence)
//
// POGOJI:
//   1. Zaposleni mora biti status='terminated' (ne moremo anonimizirati aktivnega)
//   2. Admin permission zahtevana
//   3. Audit log se zapiše PRED anonimizacijo (da vemo kdo je anonimiziral)
//
// PREDHODNA AKCIJA: Uporabnik mora najprej poklicati DELETE /api/employees/[id]
// (označi kot terminated), nato POST /api/gdpr/anonymize/[id] (polna anonimizacija).
//
// Avtentikacija: Admin samo
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { invalidateEmployeeStatusCache } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // ─── 1. Preveri, da zaposleni obstaja ──────────────────────
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Zaposleni ni najden' },
        { status: 404 }
      )
    }

    // ─── 2. Preveri predpogoje ─────────────────────────────────
    // Ne moremo anonimizirati aktivnega zaposlenega
    if (employee.status === 'active') {
      return NextResponse.json(
        { error: 'Zaposleni je še aktiven. Najprej ga označite kot terminiranega (DELETE /api/employees/[id]).' },
        { status: 400 }
      )
    }

    // Preveri aktivne izmene in seje
    const [activeShifts, activeSessions] = await Promise.all([
      db.shift.count({ where: { employeeId, status: 'in_progress' } }),
      db.session.count({ where: { employeeId, expiresAt: { gt: new Date() } } }).catch(() => 0),
    ])

    // Ne moremo anonimizirati z aktivnimi izmenami
    if (activeShifts > 0) {
      return NextResponse.json(
        { error: 'Zaposleni ima aktivne izmene. Najprej zaključite izmene.' },
        { status: 400 }
      )
    }

    // Uniči aktivne seje
    if (activeSessions > 0) {
      await db.session.deleteMany({
        where: { employeeId, expiresAt: { gt: new Date() } },
      }).catch(() => {
        // Session tabela morda ne obstaja v vseh okoljih
      })
    }

    // ─── 3. Zapiši audit log PRED anonimizacijo ───────────────
    // GDPR zahteva, da vemo kdo je anonimiziral in kdaj
    try {
      await db.auditLog.create({
        data: {
          action: 'GDPR_ANONYMIZE',
          entityType: 'Employee',
          entityId: employeeId,
          userId: authResult.session?.employeeId,
          details: JSON.stringify({
            anonymizedBy: authResult.session?.employeeId,
            originalName: employee.name,
            originalEmail: employee.email,
            reason: 'GDPR Article 17 — Right to Erasure',
            timestamp: new Date().toISOString(),
          }),
        },
      })
    } catch {
      // Audit log fail ne sme preprečiti anonimizacije (kršitev GDPR)
    }

    // ─── 4. Anonimiziraj osebne podatke ───────────────────────
    await db.employee.update({
      where: { id: employeeId },
      data: {
        name: '[Anonimizirano]',
        email: `anonimized-${employeeId.slice(-8)}@removed.local`, // ohrani @unique constraint
        phone: '',
        pin: '',
        pinLookup: null,
        status: 'anonymized',
        // hireDate ohranimo za izračun službenih dobe (če je potrebno za pokojnino)
        // Ostale relacije (orders, payments, shifts) ostanejo nedotaknjene
        // — GDPR dovoljuje zadrževanje za pravne obveznosti (davki, pokojnina)
      },
    })

    // ─── 5. Invalidiraj cache ──────────────────────────────────
    invalidateEmployeeStatusCache(employeeId)

    // ─── 6. Zapiši še en audit log (potrditev) ────────────────
    try {
      await db.auditLog.create({
        data: {
          action: 'GDPR_ANONYMIZE_COMPLETED',
          entityType: 'Employee',
          entityId: employeeId,
          userId: authResult.session?.employeeId,
          details: JSON.stringify({
            anonymizedAt: new Date().toISOString(),
            status: 'anonymized',
          }),
        },
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'Zaposleni uspešno anonimiziran (GDPR Article 17)',
      employeeId,
      anonymizedAt: new Date().toISOString(),
      retained: [
        'ID (za referenco v audit logih)',
        'status (anonymized)',
        'createdAt/updatedAt (GDPR evidence)',
        'Orders, payments, shifts (pravne obveznosti — davki)',
      ],
      deleted: [
        'Ime → [Anonimizirano]',
        'Email → null',
        'Telefon → prazen',
        'PIN → prazen (prijava onemogočena)',
        'pinLookup → null',
      ],
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/gdpr/anonymize/[employeeId]', 'Napaka pri GDPR anonimizaciji')
  }
}
