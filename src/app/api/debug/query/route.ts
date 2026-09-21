import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// R93-c produkcija-gate analiza (odločitev: (b) — vedenje ohranjeno, gate
// zadosten; ta blok DOKUMENTIRA analizo, brez spremembe obnašanja):
//
//   KAJ ruta dela: 5 FIXNIH Prisma introspekcijskih probe poizvedb
//   (order.findMany({ take: 1, include: ... }) z različnimi relacijami).
//   NIČ request-kontroliranega vnosa (brez body/params/query uporabe), NIČ
//   arbitrary SQL ($queryRaw ne obstaja), NIČ table-listing-a. Odgovor vsebuje
//   SAMO števce (length ≤ 1) + Prisma error sporočila skrajšana na 300 znakov.
//   Razvojni diagnostični endpoint (debug "full include" Prisma težave).
//
//   GATE: requireAuth(req, { permission: 'admin' }) — role 'admin' (bypass,
//   permissions.ts:40) ALI kateri koli employee s 'admin' v Job.permissions
//   (tudi lokacijsko vezan). To je NAMERNO širše kot debug/env
//   platformAdminGate (R86-4) — razlika v blast radiusu:
//
//   ZAKAJ platformAdminGate NI potreben (razmatrano in zavrženo):
//     - debug/env izpostavi DB connection config (DATABASE_URL) = PLATFORMSKI
//       vir (ena instanca za vse tenantе) → R86-4 platform gate.
//     - debug/query ne vrača NIČ platformskega in NIČ tenant podatkov: odgovor
//       je { orders*: number ≤ 1 } + skrajšana error string-a. Celoten DB
//       (vsi tenanti) je viden le kot "ali obstaja kateri koli order" (0/1) —
//       ni cross-tenant read surface.
//     - Zavrnjene alternative: SETUP_SECRET-style gate (ni hišnega precedensa
//       za secret-gated GET debug rute; admin/migrate platform gate brani
//       GLOBALNI DDL, tukaj je read-only count probe) in NODE_ENV==='production'
//       disable (hišni precedens je samo za konfiguracijske 503 pogoje,
//       npr. rotate route R82-D — ne za debug rute; ruta ostaja uporabna za
//       produkcijo diagnostiko Prisma relacij po migracijah).
//
//   Preostali (sprejeti) residual: Prisma error string-i (≤ 300 znakov) so
//   vidni lokacijskemu adminu s 'admin' permission-om — shema-internals leak,
//   LOW severity, sprejeto (vsebina je Prisma validacijska sporočila, ne
//   connection string-i).
// ============================================
export async function GET(req: Request) {
  // FIX Code Review: Dodan admin auth — prej je bil brez auth!
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  const results: Record<string, unknown> = {}
  
  // Test 1: Order findMany without include
  try {
    const orders = await db.order.findMany({ take: 1 })
    results.ordersSimple = orders.length
  } catch (e: unknown) {
    results.ordersSimpleError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 2: Order with table include
  try {
    const orders = await db.order.findMany({ take: 1, include: { table: true } })
    results.ordersWithTable = orders.length
  } catch (e: unknown) {
    results.ordersWithTableError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 3: Order with virtualBrand include
  try {
    const orders = await db.order.findMany({ take: 1, include: { virtualBrand: { select: { id: true, name: true, code: true, color: true } } } })
    results.ordersWithBrand = orders.length
  } catch (e: unknown) {
    results.ordersWithBrandError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 4: Order with orderItems include
  try {
    const orders = await db.order.findMany({ take: 1, include: { orderItems: true } })
    results.ordersWithItems = orders.length
  } catch (e: unknown) {
    results.ordersWithItemsError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  // Test 5: Order with full include (the one that fails)
  try {
    const orders = await db.order.findMany({
      take: 1,
      include: {
        table: true,
        virtualBrand: { select: { id: true, name: true, code: true, color: true } },
        orderItems: { include: { menuItem: { include: { prepStation: true, category: { include: { menu: true } } } } } },
      },
    })
    results.ordersFullInclude = orders.length
  } catch (e: unknown) {
    results.ordersFullIncludeError = e instanceof Error ? e.message.substring(0, 300) : 'Unknown'
  }
  
  return NextResponse.json(results)
}
