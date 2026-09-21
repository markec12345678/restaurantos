// =====================================================================
// GET /api/auth/employees — seznam zaposlenih za dvostopenjsko prijavo
// (R95-a: izbira zaposlenega → PIN)
//
// Namenska javna površina za POS login grid (Toast/Square standard UX):
// kiosk naprava na znani lokaciji najprej prikaže imena zaposlenih,
// nato uporabnik vpiše svoj PIN (POST /api/auth z employeeId bindingom —
// verifyPin binding veja v ../_helpers.ts).
//
// PII odločitev: imena + vloge zaposlenih TE lokacije so javno vidni
// (standard POS login grid), scope pa je omejen na IZRECNO podano AKTIVNO
// lokacijo (?locationId obvezen). Vrne se SAMO { id, name, role } — brez
// email, permissions, payRate ali PIN/hash (minimalen PII).
//
// Varnostne plasti:
//  - rate limit GENERAL_PUBLIC_LIMIT (20/min) na NAJVIŠJI točki handlerja —
//    anonimna površina, throttle PRED čimer koli drugim (R90 canon model);
//  - javna prek '/api/auth' prefixa v isPublicRoute (startsWith — brez
//    allowlist edita, permissions.ts:15);
//  - manjkajoč / napačen format / neznana / neaktivna lokacija → unificiran
//    notInScopeResponse 404 (ni obstoja-oraklja — isti odgovor za vse primere,
//    ZERO db klicev za manjkajoč ali napačen format);
//  - seznam vsebuje SAMO aktivne zaposlene z nastavljenim PIN-om
//    (pin: { not: '' }) — brez PIN-a se na grid ne prikažejo.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkRateLimitAsync, getClientIp, GENERAL_PUBLIC_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b; testi lastnijo
// barrel mocke, ta modul mora ostati realen)
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

// Dovoljena oblika locationId — ENAK vzorec kot LOCATION_ID_RE v
// src/lib/ordering-token.ts (kiosk razred id-jev: prisma cuid/uuid-like,
// 5–50 znakov [a-zA-Z0-9_-]). Regex je samo vhodna sanitacija PRED poizvedbo
// (zero db klici za slab format); varnost nosi where { isActive: true }.
const LOCATION_ID_RE = /^[a-zA-Z0-9_-]{5,50}$/

export async function GET(req: Request) {
  // R90 canon model: anonimna površina — throttle pred vsem (tudi pred
  // validacijo parametrov, da bucket meri surovi promet na tej površini).
  const rl = await checkRateLimitAsync('auth-employees', getClientIp(req), GENERAL_PUBLIC_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // ?locationId je OBVEZEN: manjkajoč ali napačen format → isti unificiran
  // 404 (ni razlikovanja med manjkajočim in slabim formatom = ni oraklja)
  const id = new URL(req.url).searchParams.get('locationId')?.trim() || ''
  if (!id || !LOCATION_ID_RE.test(id)) {
    return notInScopeResponse('Lokacija')
  }

  // Lokacija MORA obstajati IN biti AKTIVNA (neznana / tuja / neaktivna →
  // ISTI 404; select { id, name } = minimalen — ZERO nadaljnih klicev ob zavrnitvi)
  const location = await db.location.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  })
  if (!location) {
    return notInScopeResponse('Lokacija')
  }

  // Login grid: aktivni zaposleni s PIN-om na tej lokaciji, po imenu naraščajoče.
  // select IZRECNO omejen na id/name/role — Prisma select filtrira PII že na
  // viru (email/permissions/payRate/pin sploh ne potujeta iz baze).
  const employees = await db.employee.findMany({
    where: { locationId: id, status: 'active', pin: { not: '' } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ location, employees })
}
