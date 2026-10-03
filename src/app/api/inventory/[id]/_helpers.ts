// Pomožne funkcije za inventory/[id] API — DELETE handler

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { toNum, round2, multiply } from '@/lib/decimal'
import { structuredErrorResponse } from '@/lib/structured-error'
import { Prisma } from '@prisma/client'
import { acquireInvStockLocks } from '@/lib/stock-deduction/locks'

// R220 (#152 korak 2, G5): pariteta s kanonom (stock-mutations TX_OPTS /
// R214 G4) — redka operacija, Serializable brez P2034 retry-noise tveganja
// na vroči poti.
const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
}

// FIX: Soft-delete namesto hard-delete — ohrani transakcijsko zgodovino
export async function handleDeleteInventory(req: Request, id: string) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    // R86-2b (M2 razred): prej raw spread `session?.locationId ?? undefined` —
    // fail-open za non-admin seja z NULL lokacijo (cross-tenant uničenje zaloge:
    // quantity→0 + write-off StockTransaction tujega artikla). Resolver:
    // fail-closed 403; conditional spread iz scope-a (nikoli raw session).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/inventory/[id]',
    })
    if ('error' in scope) return scope.error
    const item = await db.inventoryItem.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: { transactions: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    // Preveri, če je artikel povezan z menijem
    if (item.menuItemId) {
      const menuItem = await db.menuItem.findUnique({ where: { id: item.menuItemId } })
      if (menuItem && menuItem.isAvailable) {
        return NextResponse.json(
          { error: 'Artikel je povezan z aktivnim menijem — najprej odstranite povezavo ali onemogočite meni artikel.' },
          { status: 400 }
        )
      }
    }

    // FIX MEDIUM: Preveri, če je artikel sestavina v receptih drugih meni artiklov
    const recipeItems = await db.recipeItem.findMany({
      where: { inventoryItemId: id },
      include: { menuItem: { select: { name: true, isAvailable: true } } },
    })
    const activeRecipeItems = recipeItems.filter(ri => ri.menuItem?.isAvailable)
    if (activeRecipeItems.length > 0) {
      const itemNames = activeRecipeItems.map(ri => ri.menuItem?.name || 'Neznan').join(', ')
      return NextResponse.json(
        { error: `Artikel je sestavina v receptih aktivnih artiklov: ${itemNames}. Najprej odstranite iz receptov ali onemogočite te artikle.` },
        { status: 400 }
      )
    }

    // Namesto hard-delete, nastavi količino na 0 in označi kot nedoseno
    // Tako ohranimo transakcijsko zgodovino za FURS/audit
    //
    // R220 (#152 korak 2, G5): kanon pariteta — trije manjkajoči kanonski
    // elementi (isti vzorec kot R214 G4 batch adjust / R106 stock-mutations):
    //   1. advisory ključavnica acquireInvStockLocks (R182 vesolj — sort+dedup
    //      v helperju) PRED prvo mutacijo; entitetni kontekst (scoped read +
    //      menu/recipe varovalki) je bil izveden že pred tx → ključavnica je
    //      list lock grafa, deadlock nemogoč; prej je bil DELETE 6. zalogovni
    //      pisec MIMO kanona (sočasna prodaja ∥ brisanje se NI serializirala
    //      → preplet StockTx revizijskih vrstic, §21 kontinuiteta prelomljena),
    //   2. tx-fresh scoped re-read — prej je stale pre-tx `item.quantity`
    //      določal previousQty na write-off StockTx (sočasna prodaja med
    //      readom in tx = previousQty ne odraža dejanske vrednosti ob
    //      mutaciji — izgubljen odstotek v ledgerju),
    //   3. CAS updateMany (where quantity == tx-fresh vrednost) — zapiše 0
    //      SAMO če se zaloga ni premaknila; 0 vrstic → strukturirani 409
    //      (nikoli tiho prepisovanje; obrambna globina poleg ključavnice,
    //      pariteta s P3 atomarnim vzorcem).
    const deleteResult = await db.$transaction(async (tx) => {
      // (1) ključavnica PRED re-readom in prvo mutacijo (R182 vesolj)
      await acquireInvStockLocks(tx, [id])
      // (2) tx-fresh scoped re-read (prej stale pre-tx read)
      const fresh = await tx.inventoryItem.findFirst({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      })
      if (!fresh) {
        throw { error: 'Artikel zaloge ni najden (sočasna sprememba)', status: 404 }
      }
      const previousQty = toNum(fresh.quantity)
      // (3) CAS: zapiši 0 samo nad tx-fresh vrednostjo (pariteta s P3)
      const updated = await tx.inventoryItem.updateMany({
        where: { id, quantity: fresh.quantity },
        data: {
          quantity: 0,
          menuItemId: null, // Odstrani povezavo z menijem
        },
      })
      if (updated.count === 0) {
        throw { error: 'Brisanje zaloge je v obdelavi (sočasen dostop) — poskusite znova', status: 409 }
      }
      await tx.stockTransaction.create({
        data: {
          inventoryItemId: id,
          type: 'write-off',
          quantity: -previousQty,
          previousQty,
          newQty: 0,
          costPerUnit: fresh.costPerUnit,
          totalCost: round2(multiply(fresh.quantity, fresh.costPerUnit)),
          reason: 'Izbris artikla iz zaloge',
          note: 'Artikel odstranjen iz sistema',
          employeeName: authResult.session?.employeeId || '',
          // R155/#43: employeeName JE session cuid → FK = isti vir
          employeeId: authResult.session?.employeeId ?? null,
        },
      })
      return { previousQty, itemName: fresh.name }
    }, TX_OPTS)

    // R220 (G5): revizija brisanja — EN vnos INVENTORY_DELETE per uspešen
    // soft-delete (isti details shape kot INVENTORY_ADJUST :92-105;
    // tx-fresh vrednosti; never-throws, PCI hash veriga prek createAuditLog).
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'INVENTORY_DELETE',
      entityType: 'InventoryItem',
      entityId: id,
      details: {
        type: 'write-off',
        quantity: -deleteResult.previousQty,
        previousQty: deleteResult.previousQty,
        newQty: 0,
        reason: 'Izbris artikla iz zaloge',
        itemName: deleteResult.itemName,
      },
    })

    return NextResponse.json({ success: true, message: 'Artikel označen kot izbrisan, transakcijska zgodovina ohranjena' })
  } catch (error: unknown) {
    // R220 (G5): error kontrakt pariteta s stockRaceErrorResponse (route.ts
    // PUT/PATCH) — P2002/P2034 race-pathi → 409 (nikoli 500); strukturirani
    // { error, status } throw-i iz tx telesa (404/409) → pravi statusi.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Brisanje zaloge je v obdelavi (sočasen dostop) — poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'DELETE /api/inventory/[id]', 'Napaka pri brisanju zaloge')
  }
}
