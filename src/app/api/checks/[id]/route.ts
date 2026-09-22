
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateCheckSchema } from '@/lib/validations'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { deepToNumbers } from '@/lib/decimal'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { updateCheckWithLock, deleteCheckWithLock } from './_helpers'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateCheckSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX P0-C1 (IDOR): findUnique → findFirst s scope prek order.locationId (Check nima lastnega locationId)
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'PUT /api/checks/[id]',
    })
    if ('error' in scope) return scope.error

    // FIX R81-F (WRITE IDOR): fast-path scoped lookup — izven scope-a → 404
    // (zgodnja stopnica; R109 CK-1: dejanski pisalni tok je v kanonu
    // updateCheckWithLock() s tx-fresh scoped re-readom).
    const existingCheck = await db.check.findFirst({
      where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
      select: { id: true },
    })

    if (!existingCheck) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // R109 (CK-4): paymentStatus je STREŽNIŠKO DERIVIRAN iz plačil
    // (create-payment/qr-pay/refund → updateCheckAndOrderStatus /
    // recalculatePaymentStatus). Klient ga ne sme pisati:
    //   - 'paid' brez plačila = revenue oracle (EOD/Z/finančna poročila
    //     filtrirajo po paid → prihodek, ki ne obstaja),
    //   - 'storno' je rezerviran za refund tok (FURS storno semantika).
    // GUI tega polja ne pošilja; blokirano fail-closed.
    if (data.paymentStatus !== undefined) {
      return NextResponse.json(
        { error: 'paymentStatus je strežniško deriviran iz plačil in ga ni mogoče nastaviti prek tega endpointa' },
        { status: 400 }
      )
    }

    // R109 (CK-1, kanon R106/R107/R108): pisalni tok V ENEM kanonu —
    // $transaction(Serializable) + pg_advisory_xact_lock(checkWriteLockKey =
    // raw checkId, pariteta create-payment/qr-pay) + tx-fresh scoped re-read
    // + totals iz SVEŽEGA čeka + discount usage primerjava proti svežemu
    // stanju (prej: stale existingCheck izven tx → lost update na totals,
    // dvojen decrement currentUses, napačna DDV osnova).
    const check = await updateCheckWithLock({
      checkId: id,
      sessionLocationId: scope.locationId,
      appliedDiscountId: data.appliedDiscountId,
      paymentMethod: data.paymentMethod,
    })

    return NextResponse.json(deepToNumbers(check))
  } catch (error: unknown) {
    // R109 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles → pravi statusi
    // (prej: handleApiError string-matching → 500 '[object Object]').
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Ček je v obdelavi (sočasen dostop) — osvežite in poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'PUT /api/checks/[id]', 'Napaka pri posodobitvi čeka')
  }
}

// FIX H-06: Soft-delete namesto hard-delete (ohrani audit sled)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX P0-C1 (IDOR): findUnique → findFirst s scope prek order.locationId (Check nima lastnega locationId)
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'DELETE /api/checks/[id]',
    })
    if ('error' in scope) return scope.error

    // FIX R81-F (WRITE IDOR): fast-path scoped lookup — izven scope-a → 404
    const existingCheck = await db.check.findFirst({
      where: { id, ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}) },
      select: { id: true },
    })

    if (!existingCheck) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // R109 (CK-2, kanon R106/R107/R108): izbris kot ATOMARNA enota —
    // $transaction(Serializable) + advisory lock (raw checkId, pariteta
    // create-payment/qr-pay) + tx-fresh re-read plačil (prej: stale
    // check-then-act → sočasno plačilo = P2003 FK Restrict → 500 PO delnih
    // mutacijah) + pogojni discount decrement + deleteMany + count guard.
    const result = await deleteCheckWithLock({
      checkId: id,
      sessionLocationId: scope.locationId,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    // R109 (error kontrakt): pariteta PUT
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Ček je v obdelavi (sočasen dostop) — osvežite in poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'DELETE /api/checks/[id]', 'Napaka pri brisanju čeka')
  }
}
