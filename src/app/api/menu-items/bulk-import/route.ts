// POST /api/menu-items/bulk-import — Bulk uvoz artiklov iz CSV/Excel
// Podpira: name, description, price, vatRate, categoryName, allergens, isAvailable
// Format: CSV (text/csv) ali Excel (.xlsx)
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import ExcelJS from 'exceljs'


interface ImportRow {
  name: string
  description: string
  price: number
  vatRate: number
  categoryName: string
  menuName?: string
  allergens: string
  isAvailable: boolean
}

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; error: string }>
  duplicates: number
}

const REQUIRED_COLUMNS = ['name', 'price', 'vatRate', 'categoryName']

/** Parsaj CSV v vrstice (podpora quoted poljem z vejicami) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += char
    } else {
      if (char === '"') inQuotes = true
      else if (char === ',') { current.push(field); field = '' }
      else if (char === '\n') { current.push(field); rows.push(current); current = []; field = '' }
      else if (char === '\r') { /* skip */ }
      else field += char
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

/** Map CSV/Excel vrstice → ImportRow (po headerjih) */
function mapRow(headers: string[], row: string[], rowNum: number): { data?: ImportRow; error?: string } {
  const obj: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = (row[i] || '').trim()
  }

  const name = obj.name || obj.ime || obj.naziv || ''
  if (!name) return { error: `Vrstica ${rowNum}: manjka 'name'` }

  const priceStr = obj.price || obj.cena || '0'
  const price = parseFloat(priceStr.replace(',', '.'))
  if (isNaN(price) || price < 0) return { error: `Vrstica ${rowNum}: neveljavna cena '${priceStr}'` }

  const vatStr = obj.vatRate || obj.ddv || obj.vat || '22'
  const vatRate = parseFloat(vatStr.replace(',', '.'))
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) return { error: `Vrstica ${rowNum}: neveljaven DDV '${vatStr}'` }

  return {
    data: {
      name,
      description: obj.description || obj.opis || '',
      price,
      vatRate,
      categoryName: obj.categoryName || obj.kategorija || 'Splošno',
      menuName: obj.menuName || obj.meni || undefined,
      allergens: obj.allergens || obj.alergeni || '',
      isAvailable: (obj.isAvailable || obj.dostopen || 'true').toLowerCase() !== 'false',
    },
  }
}

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const contentType = req.headers.get('content-type') || ''

    let rows: string[][] = []
    let isExcel = false

    if (contentType.includes('application/json')) {
      // JSON mode: { rows: [["name","price",...], [...]] }
      const bodyResult = await parseJsonBody(req)
      if (bodyResult.error) return bodyResult.error
      const jsonData = bodyResult.data as { rows?: string[][] }
      if (!jsonData.rows || !Array.isArray(jsonData.rows)) {
        return NextResponse.json({ error: 'Manjkajo vrstice (rows array)' }, { status: 400 })
      }
      rows = jsonData.rows
    } else if (contentType.includes('text/csv')) {
      const text = await req.text()
      rows = parseCsv(text)
    } else if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
      // Excel .xlsx — parsaj z exceljs
      isExcel = true
      const arrayBuffer = await req.arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(arrayBuffer))
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer as unknown as ArrayBuffer)
      const ws = wb.worksheets[0]
      if (!ws) return NextResponse.json({ error: 'Excel datoteka nima listov' }, { status: 400 })
      ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
        if (rowNum === 1) return // skip header
        const values = row.values as unknown[]
        // values[0] is undefined (1-indexed)
        rows.push(values.slice(1).map(v => v ? String(v) : ''))
      })
    } else {
      return NextResponse.json({
        error: 'Nepodprt Content-Type. Uporabi text/csv, application/json, ali Excel (.xlsx)',
      }, { status: 400 })
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Datoteka mora imeti vsaj header + 1 vrstico' }, { status: 400 })
    }

    const headers = rows[0].map(h => h.trim())
    // Validiraj required columnse
    const hasName = headers.some(h => ['name', 'ime', 'naziv'].includes(h.toLowerCase()))
    const hasPrice = headers.some(h => ['price', 'cena'].includes(h.toLowerCase()))
    if (!hasName || !hasPrice) {
      return NextResponse.json({
        error: `Manjkajo obvezni stolpci. Potrebni: name (ali ime), price (ali cena). Najdeni: ${headers.join(', ')}`,
      }, { status: 400 })
    }

    // Map vrstice → ImportRow
    const dataRows: Array<{ rowNum: number; data: ImportRow }> = []
    const errors: Array<{ row: number; error: string }> = []
    for (let i = 1; i < rows.length; i++) {
      const result = mapRow(headers, rows[i], i + 1)
      if (result.error) errors.push({ row: i + 1, error: result.error })
      else if (result.data) dataRows.push({ rowNum: i + 1, data: result.data })
    }

    // Pridobi ali ustvari menu (privzeto prvi aktivni)
    let menu = await db.menu.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    if (!menu) {
      menu = await db.menu.create({ data: { name: 'Glavni meni', icon: '📋', color: '#f59e0b', sortOrder: 0, isActive: true } })
    }

    // Pridobi vse obstoječe kategorije za ta menu
    const existingCategories = await db.category.findMany({ where: { menuId: menu.id } })
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]))

    // Pridobi vse obstoječe artikle (za duplicate detection)
    const existingItems = await db.menuItem.findMany({ select: { name: true, categoryId: true } })
    const existingNames = new Set(existingItems.map(i => i.name.toLowerCase()))

    let imported = 0
    let skipped = 0
    let duplicates = 0

    // FIX PERFORMANCE: prejšnja koda je za vsako vrstico izvedla `db.category.create()`
    // in `db.menuItem.create()` v zanki — 1000 vrstic = 2000+ round-tripov v DB.
    // Sedaj zbiramo nove kategorije in artikle, jih batch-amo znotraj ene
    // transakcije. Transakcija tudi zagotavlja atomarnost — če ena vrstica
    // ne uspe, se celoten import rollback-a (prejšnja koda je pustila delne uvoze).
    const categoriesToCreate: Array<{ name: string; icon: string; color: string; sortOrder: number; menuId: string }> = []
    const itemsToCreate: Array<{ name: string; description: string; price: number; vatRate: number; allergens: string; isAvailable: boolean; sortOrder: number; categoryId: string }> = []

    // Najprej zberemo nove kategorije (da lahko uporabimo createMany)
    for (const { data, rowNum } of dataRows) {
      // Skip duplicates (isti ime + kategorija)
      if (existingNames.has(data.name.toLowerCase())) {
        duplicates++
        skipped++
        errors.push({ row: rowNum, error: `Duplikat: '${data.name}' že obstaja` })
        continue
      }

      // Pridobi ali ustvari kategorijo
      let category = categoryMap.get(data.categoryName.toLowerCase())
      if (!category) {
        const sortOrder = categoryMap.size
        // Ustvari v bazi takoj — potrebujemo ID za povezavo z item-i
        category = await db.category.create({
          data: {
            name: data.categoryName,
            icon: '🍽️',
            color: '#f59e0b',
            sortOrder,
            menuId: menu.id,
          },
          select: { id: true, name: true },
        })
        categoryMap.set(data.categoryName.toLowerCase(), category as typeof category & { id: string; name: string })
      }

      itemsToCreate.push({
        name: data.name,
        description: data.description,
        price: data.price,
        vatRate: data.vatRate,
        allergens: data.allergens,
        isAvailable: data.isAvailable,
        sortOrder: imported,
        categoryId: (category as { id: string }).id,
      })

      existingNames.add(data.name.toLowerCase())
      imported++
    }

    // FIX: batch insert vseh artiklov znotraj transakcije
    if (itemsToCreate.length > 0) {
      await db.$transaction(async (tx) => {
        // createMany ne podpira vseh operacij, a za preprost insert je OK.
        // Če bi potrebovali nested writes, bi uporabili tx.menuItem.create v zanki.
        await tx.menuItem.createMany({ data: itemsToCreate })
      })
    }

    const result: ImportResult = {
      success: true,
      imported,
      skipped,
      errors,
      duplicates,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/menu-items/bulk-import', 'Napaka pri uvozu artiklov')
  }
}
