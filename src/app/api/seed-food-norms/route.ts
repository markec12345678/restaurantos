
// =====================================================================
// SEED NORMATIVOV HRANE - Inventarne postavke + Recepti za hrano
// Podatki iz kombinacije Gostilna Pod Lipco + Favola restavracija
// =====================================================================
// Ta endpoint doda obsežen inventar sestavin hrane in recepture (normative)
// za vse standardne jedi v slovenskih restavracijah in gostilnah.
// NE briše obstoječih inventarnih postavk pijač - samo doda hrano.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('seed-food-norms', getClientIp(req), SEED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Pridobi obstoječe menije in kategorije
    const menus = await db.menu.findMany()
    const menuHrana = menus.find(m => m.name === 'Hrana')
    const menuPijaca = menus.find(m => m.name === 'Pijača')
    const menuId = menuHrana?.id || menuPijaca?.id || menus[0]?.id

    if (!menuId) {
      return NextResponse.json({ error: 'Ni menija v bazi. Najprej poženi /api/seed' }, { status: 400 })
    }

    // Pridobi obstoječe kategorije
    const existingCats = await db.category.findMany({ where: { menuId } })
    const catByName = new Map<string, typeof existingCats[0]>()
    for (const c of existingCats) catByName.set(c.name, c)

    // Helper: poišči ali ustvari kategorijo
    const getOrCreateCat = async (name: string, icon: string, color: string, sortOrder: number) => {
      const existing = catByName.get(name)
      if (existing) return existing
      const cat = await db.category.create({ data: { name, icon, color, sortOrder, menuId } })
      catByName.set(name, cat)
      return cat
    }

    // =====================================================================
    // USTVARI KATEGORIJE ZA HRANO
    // =====================================================================
    const catPredjedi = await getOrCreateCat('Predjedi', '🥗', '#10b981', 0)
    const catJuhe = await getOrCreateCat('Juhe', '🍲', '#f59e0b', 1)
    const catTestenine = await getOrCreateCat('Testenine', '🍝', '#ef4444', 2)
    const catRizote = await getOrCreateCat('Rižote', '🍚', '#8b5cf6', 3)
    const catMesneJedi = await getOrCreateCat('Glavne jedi', '🥩', '#dc2626', 4)
    const catZar = await getOrCreateCat('Jedi z žara', '🔥', '#ea580c', 5)
    const catBurgerji = await getOrCreateCat('Burgerji', '🍔', '#b91c1c', 6)
    const catRibjeJedi = await getOrCreateCat('Ribje jedi', '🐟', '#0ea5e9', 7)
    const catPice = await getOrCreateCat('Pice', '🍕', '#e11d48', 8)
    const catSolate = await getOrCreateCat('Solate', '🥬', '#22c55e', 9)
    const catPriloge = await getOrCreateCat('Priloge', '🥔', '#a16207', 10)
    const catSladice = await getOrCreateCat('Sladice', '🍰', '#ec4899', 11)
    const catOtroški = await getOrCreateCat('Otroški meni', '🧒', '#6366f1', 12)

    // =====================================================================
    // 1. INVENTARNE POSTAVKE - Sestavine hrane
    // =====================================================================

    // --- MESO IZ REZANJA (kg) ---
    const invGovejaPecjenka = await db.inventoryItem.create({ data: { name: 'Goveja pečenka (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })
    const invGovejiFile = await db.inventoryItem.create({ data: { name: 'Goveji file (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 45.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 11.25 } })
    const invSvinjskiKare = await db.inventoryItem.create({ data: { name: 'Svinjski kare (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSvinjskiVrat = await db.inventoryItem.create({ data: { name: 'Svinjski vrat (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 2.50 } })
    const invPiscancjiFile = await db.inventoryItem.create({ data: { name: 'Piščančji file (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 9.00, supplier: 'Perutnina Ptuj', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.80 } })
    const invMletoSvinjsko = await db.inventoryItem.create({ data: { name: 'Mleto svinjsko meso (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 8.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.60 } })
    const invMletoGoveje = await db.inventoryItem.create({ data: { name: 'Mleto goveje meso (1kg)', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invRozbif = await db.inventoryItem.create({ data: { name: 'Goveji rozbif (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 20.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 5.00 } })
    const invDivjaci = await db.inventoryItem.create({ data: { name: 'Divjačina - golaž meso (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Lovska družina', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 4.40 } })
    const invKlobasa = await db.inventoryItem.create({ data: { name: 'Pikantna klobasa (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 9.00, supplier: 'Klobasarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.80 } })
    const invCevapci = await db.inventoryItem.create({ data: { name: 'Čevapčiči (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 2.50 } })
    const invPleskavica = await db.inventoryItem.create({ data: { name: 'Pleskavica (1kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 2.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 2.00 } })
    const invPrsut = await db.inventoryItem.create({ data: { name: 'Pršut kraški (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.50 } })
    const invSunka = await db.inventoryItem.create({ data: { name: 'Kuhana šunka (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invSlanina = await db.inventoryItem.create({ data: { name: 'Slanina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invPanceta = await db.inventoryItem.create({ data: { name: 'Panceta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.93 } })
    const invSalama = await db.inventoryItem.create({ data: { name: 'Suha salama (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 11.00, supplier: 'Klobasarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.55 } })
    const invHrenovke = await db.inventoryItem.create({ data: { name: 'Hrenovke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 7.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.70 } })

    // --- RIBE IN MORSKI SADEŽI ---
    const invLosos = await db.inventoryItem.create({ data: { name: 'Lososov file (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 25.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.00 } })
    const invPstrv = await db.inventoryItem.create({ data: { name: 'Pstrv (1kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 5.00, supplier: 'Ribogojstvo', category: 'seafood', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 5.00 } })
    const invLignji = await db.inventoryItem.create({ data: { name: 'Lignji očiščeni (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 16.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.20 } })
    const invKalamari = await db.inventoryItem.create({ data: { name: 'Kalamari (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.80 } })
    const invTuna = await db.inventoryItem.create({ data: { name: 'Tuna steak (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 28.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.60 } })
    const invTunaKonzerva = await db.inventoryItem.create({ data: { name: 'Tuna v konzervi (1kos)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'seafood', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 konzerva', costPerServing: 2.50 } })
    const invHobotnica = await db.inventoryItem.create({ data: { name: 'Hobotnica (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 4.00 } })
    const invGamberi = await db.inventoryItem.create({ data: { name: 'Gamberi (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 22.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 8, servingSize: '125g', costPerServing: 2.75 } })
    const invMorskiSadezi = await db.inventoryItem.create({ data: { name: 'Mešani morski sadeži (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 18.00, supplier: 'Ribarnica', category: 'seafood', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })

    // --- SIRI ---
    const invMozzarella = await db.inventoryItem.create({ data: { name: 'Mozzarella (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invParmezan = await db.inventoryItem.create({ data: { name: 'Parmezan Grana Padano (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.00 } })
    const invGorgonzola = await db.inventoryItem.create({ data: { name: 'Gorgonzola (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 1.07 } })
    const invFeta = await db.inventoryItem.create({ data: { name: 'Feta sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.67 } })
    const invOvcjaSkuta = await db.inventoryItem.create({ data: { name: 'Ovčja skuta (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.93 } })
    const invBrie = await db.inventoryItem.create({ data: { name: 'Brie (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 15.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 12, servingSize: '80g', costPerServing: 1.25 } })
    const invCamembert = await db.inventoryItem.create({ data: { name: 'Camembert (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 3.00 } })
    const invMladiSir = await db.inventoryItem.create({ data: { name: 'Mladi sir za žar (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.50, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 3.50 } })
    const invKislaSmetana = await db.inventoryItem.create({ data: { name: 'Kisla smetana (0.20L)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 0.80, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.80 } })
    const invSladkaSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana za kuho (0.25L)', unit: 'kos', quantity: 8, minQuantity: 2, costPerUnit: 1.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 2, servingSize: '0.125L', costPerServing: 0.50 } })
    const invMascarpone = await db.inventoryItem.create({ data: { name: 'Mascarpone (0.25kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 2.50, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 2, servingSize: '125g', costPerServing: 1.25 } })

    // --- TESTENINE IN ŽITA ---
    const invSpageti = await db.inventoryItem.create({ data: { name: 'Špageti (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
    const invPeresniki = await db.inventoryItem.create({ data: { name: 'Peresniki (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invSirokiRezanci = await db.inventoryItem.create({ data: { name: 'Široki rezanci (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invNjoki = await db.inventoryItem.create({ data: { name: 'Njoki krompirjevi (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invFuzi = await db.inventoryItem.create({ data: { name: 'Fuži (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invZlikrofi = await db.inventoryItem.create({ data: { name: 'Žlikrofi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Žlikrofarna', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 1.50 } })
    const invLazanjaTesto = await db.inventoryItem.create({ data: { name: 'Lazanja testo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRiz = await db.inventoryItem.create({ data: { name: 'Riž (1kg)', unit: 'kg', quantity: 6, minQuantity: 2, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.50 } })
    const invPicaTesto = await db.inventoryItem.create({ data: { name: 'Pica testo (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Pekarna', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 3, servingSize: '330g', costPerServing: 1.00 } })
    const invPolenta = await db.inventoryItem.create({ data: { name: 'Polenta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 8, servingSize: '125g', costPerServing: 0.25 } })
    const invAjdovaKasa = await db.inventoryItem.create({ data: { name: 'Ajdrova kaša (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 6, servingSize: '160g', costPerServing: 0.50 } })

    // --- ZELENJAVA IN SVEŽE SESTAVINE ---
    const invKrompir = await db.inventoryItem.create({ data: { name: 'Krompir (1kg)', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 1.00, supplier: 'Zelenjavnik', category: 'produce', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.20 } })
    const invParadiznik = await db.inventoryItem.create({ data: { name: 'Paradižnik (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.30 } })
    const invPelati = await db.inventoryItem.create({ data: { name: 'Pelati paradižnik (0.40kg)', unit: 'kos', quantity: 12, minQuantity: 4, costPerUnit: 1.20, supplier: 'Mutti', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 2, servingSize: '200g', costPerServing: 0.60 } })
    const invCebula = await db.inventoryItem.create({ data: { name: 'Čebula (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 1.50, supplier: 'Zelenjavnik', category: 'produce', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })
    const invCesen = await db.inventoryItem.create({ data: { name: 'Česen (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Zelenjavnik', category: 'produce', location: 'skladišče', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.16 } })
    const invPaprika = await db.inventoryItem.create({ data: { name: 'Paprika (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.35 } })
    const invBucke = await db.inventoryItem.create({ data: { name: 'Bučke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 8, servingSize: '125g', costPerServing: 0.31 } })
    const invJajcevec = await db.inventoryItem.create({ data: { name: 'Jajčevec (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 6, servingSize: '160g', costPerServing: 0.50 } })
    const invGobe = await db.inventoryItem.create({ data: { name: 'Šampinjoni (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Gobarstvo', category: 'produce', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.40 } })
    const invJurcki = await db.inventoryItem.create({ data: { name: 'Jurčki (1kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 20.00, supplier: 'Gobarstvo', category: 'produce', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 2.00 } })
    const invSparglji = await db.inventoryItem.create({ data: { name: 'Beluši (1kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 12.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invSolata = await db.inventoryItem.create({ data: { name: 'Listnata solata (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 1.50, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 3, servingSize: '1/3 kos', costPerServing: 0.50 } })
    const invRukola = await db.inventoryItem.create({ data: { name: 'Rukola (0.10kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 8, servingSize: '12g', costPerServing: 0.10 } })
    const invRadik = await db.inventoryItem.create({ data: { name: 'Radič (1kos)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 1.50, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '1/4 kos', costPerServing: 0.38 } })
    const invKoruznaMoka = await db.inventoryItem.create({ data: { name: 'Koruzna moka za paniranje (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.10 } })
    const invPecenaZelenjava = await db.inventoryItem.create({ data: { name: 'Pečena zelenjava (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Pripravljeno', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })
    const invKuhanaZelenjava = await db.inventoryItem.create({ data: { name: 'Kuhana zelenjava (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Pripravljeno', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })

    // --- OMAKE IN ZAČIMBE ---
    const invBolonjskaOmaka = await db.inventoryItem.create({ data: { name: 'Bolonjska omaka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Kuhinja', category: 'sauces', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.20 } })
    const invTrzaskaOmaka = await db.inventoryItem.create({ data: { name: 'Tržaška omaka (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Kuhinja', category: 'sauces', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.50 } })
    const invTartarskaOmaka = await db.inventoryItem.create({ data: { name: 'Tartarska omaka (0.20L)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 1.20, supplier: 'Kuhinja', category: 'sauces', location: 'hladilnik', servingsPerUnit: 2, servingSize: '0.10L', costPerServing: 0.60 } })
    const invPestoGenovese = await db.inventoryItem.create({ data: { name: 'Pesto Genovese (0.18kg)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 3.50, supplier: 'Barilla', category: 'sauces', location: 'hladilnik', servingsPerUnit: 6, servingSize: '30g', costPerServing: 0.58 } })
    const invBBQOmaka = await db.inventoryItem.create({ data: { name: 'BBQ omaka (0.25L)', unit: 'kos', quantity: 4, minQuantity: 1, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'sauces', location: 'skladišče', servingsPerUnit: 5, servingSize: '50ml', costPerServing: 0.50 } })
    const invTartufata = await db.inventoryItem.create({ data: { name: 'Tartufata (0.10kg)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Tartufarna', category: 'sauces', location: 'hladilnik', servingsPerUnit: 5, servingSize: '20g', costPerServing: 1.60 } })
    const invTartufnoOlje = await db.inventoryItem.create({ data: { name: 'Tartufno olje (0.10L)', unit: 'kos', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Tartufarna', category: 'sauces', location: 'skladišče', servingsPerUnit: 20, servingSize: '5ml', costPerServing: 0.50 } })
    const invOlivnoOlje = await db.inventoryItem.create({ data: { name: 'Olivno olje (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'sauces', location: 'skladišče', servingsPerUnit: 30, servingSize: '33ml', costPerServing: 0.27 } })
    const invJajca = await db.inventoryItem.create({ data: { name: 'Jajca (10kos)', unit: 'kos', quantity: 30, minQuantity: 10, costPerUnit: 0.30, supplier: 'Kmetija', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 jajce', costPerServing: 0.30 } })
    const invMoka = await db.inventoryItem.create({ data: { name: 'Moka (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 1.00, supplier: 'Mlinotest', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.05 } })
    const invDrobtine = await db.inventoryItem.create({ data: { name: 'Drobtine za paniranje (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 1.50, supplier: 'Mlinotest', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })
    const invKruh = await db.inventoryItem.create({ data: { name: 'Kruh (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 2.00, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 8, servingSize: '1 rezina', costPerServing: 0.25 } })
    const invLepinja = await db.inventoryItem.create({ data: { name: 'Lepinja (1kos)', unit: 'kos', quantity: 10, minQuantity: 4, costPerUnit: 1.00, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 1.00 } })

    // --- SADJE IN SLADICE ---
    const invJabolka = await db.inventoryItem.create({ data: { name: 'Jabolka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Sadjarstvo', category: 'produce', location: 'hladilnik', servingsPerUnit: 6, servingSize: '160g', costPerServing: 0.33 } })
    const invJagode = await db.inventoryItem.create({ data: { name: 'Jagode (0.25kg)', unit: 'kos', quantity: 4, minQuantity: 1, costPerUnit: 3.00, supplier: 'Sadjarstvo', category: 'produce', location: 'hladilnik', servingsPerUnit: 3, servingSize: '80g', costPerServing: 1.00 } })
    const invGranatnoJabolko = await db.inventoryItem.create({ data: { name: 'Granatno jabolko (1kos)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Sadjarstvo', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '1/4 kos', costPerServing: 0.50 } })

    // --- GOVEJA JUHA IN OSNOVE ---
    const invGovejaJuhovina = await db.inventoryItem.create({ data: { name: 'Goveja juhovina (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'soups', location: 'hladilnik', servingsPerUnit: 3, servingSize: '0.33L', costPerServing: 1.00 } })
    const invZelenjavnaJuhovina = await db.inventoryItem.create({ data: { name: 'Zelenjavna juhovina (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Kuhinja', category: 'soups', location: 'hladilnik', servingsPerUnit: 3, servingSize: '0.33L', costPerServing: 0.83 } })
    const invGobovaJuhovina = await db.inventoryItem.create({ data: { name: 'Gobova juhovina (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Kuhinja', category: 'soups', location: 'hladilnik', servingsPerUnit: 3, servingSize: '0.33L', costPerServing: 1.17 } })
    const invKisloZelje = await db.inventoryItem.create({ data: { name: 'Kislo zelje (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
    const invFizol = await db.inventoryItem.create({ data: { name: 'Fižol (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invKrompirjevaSolata = await db.inventoryItem.create({ data: { name: 'Krompirjeva solata (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Kuhinja', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 1.00 } })

    // --- PICA SESTAVINE ---
    const invOlive = await db.inventoryItem.create({ data: { name: 'Olive (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invArtičoke = await db.inventoryItem.create({ data: { name: 'Artičoke v olju (0.30kg)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 4, servingSize: '75g', costPerServing: 0.75 } })
    const invFeferoni = await db.inventoryItem.create({ data: { name: 'Feferoni (1kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 6.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 30, servingSize: '33g', costPerServing: 0.20 } })
    const invSlaniFileti = await db.inventoryItem.create({ data: { name: 'Slani fileti inčuni (0.10kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'seafood', location: 'hladilnik', servingsPerUnit: 4, servingSize: '25g', costPerServing: 0.75 } })
    const invKapre = await db.inventoryItem.create({ data: { name: 'Kapre (0.10kg)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '10g', costPerServing: 0.25 } })
    const invKajmak = await db.inventoryItem.create({ data: { name: 'Kajmak (0.20kg)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dairy', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.50 } })
    const invColeslaw = await db.inventoryItem.create({ data: { name: 'Coleslaw solata (0.20kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 1.50, supplier: 'Kuhinja', category: 'produce', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20kg', costPerServing: 1.50 } })
    const invBurgerBun = await db.inventoryItem.create({ data: { name: 'Burger žemlja (1kos)', unit: 'kos', quantity: 15, minQuantity: 5, costPerUnit: 0.50, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 0.50 } })

    const inventoryItems = [
      invGovejaPecjenka, invGovejiFile, invSvinjskiKare, invSvinjskiVrat, invPiscancjiFile,
      invMletoSvinjsko, invMletoGoveje, invRozbif, invDivjaci, invKlobasa,
      invCevapci, invPleskavica, invPrsut, invSunka, invSlanina, invPanceta, invSalama, invHrenovke,
      invLosos, invPstrv, invLignji, invKalamari, invTuna, invTunaKonzerva, invHobotnica, invGamberi, invMorskiSadezi,
      invMozzarella, invParmezan, invGorgonzola, invFeta, invOvcjaSkuta, invBrie, invCamembert,
      invMladiSir, invKislaSmetana, invSladkaSmetana, invMascarpone,
      invSpageti, invPeresniki, invSirokiRezanci, invNjoki, invFuzi, invZlikrofi,
      invLazanjaTesto, invRiz, invPicaTesto, invPolenta, invAjdovaKasa,
      invKrompir, invParadiznik, invPelati, invCebula, invCesen, invPaprika,
      invBucke, invJajcevec, invGobe, invJurcki, invSparglji,
      invSolata, invRukola, invRadik, invKoruznaMoka, invPecenaZelenjava, invKuhanaZelenjava,
      invBolonjskaOmaka, invTrzaskaOmaka, invTartarskaOmaka, invPestoGenovese,
      invBBQOmaka, invTartufata, invTartufnoOlje, invOlivnoOlje,
      invJajca, invMoka, invDrobtine, invKruh, invLepinja,
      invJabolka, invJagode, invGranatnoJabolko,
      invGovejaJuhovina, invZelenjavnaJuhovina, invGobovaJuhovina,
      invKisloZelje, invFizol, invKrompirjevaSolata,
      invOlive, invArtičoke, invFeferoni, invSlaniFileti, invKapre,
      invKajmak, invColeslaw, invBurgerBun,
    ]

    // =====================================================================
    // 2. MENU ITEMS + RECIPE ITEMS
    // =====================================================================

    const menuItems = await db.menuItem.findMany()
    const menuByName = new Map<string, typeof menuItems[0]>()
    for (const mi of menuItems) menuByName.set(mi.name, mi)

    // Helper: ustvari menuItem (če ne obstaja) + recepture
    const createFood = async (
      name: string,
      price: number,
      catId: string,
      desc: string,
      allergens: string,
      vatRate: number,
      recipes: Array<{ inv: { id: string }; qty: number; unit: string }>,
      image: string = ''
    ) => {
      let menuItem = menuByName.get(name)
      if (!menuItem) {
        menuItem = await db.menuItem.create({
          data: {
            name,
            description: desc,
            price,
            categoryId: catId,
            allergens,
            vatRate,
            isAvailable: true,
            image,
          }
        })
        menuByName.set(name, menuItem)
      } else if (image && !menuItem.image) {
        // Posodobi sliko če še ni nastavljena
        await db.menuItem.update({ where: { id: menuItem.id }, data: { image } })
      }

      for (const r of recipes) {
        await db.recipeItem.upsert({
          where: {
            menuItemId_inventoryItemId: {
              menuItemId: menuItem.id,
              inventoryItemId: r.inv.id,
            }
          },
          create: {
            menuItemId: menuItem.id,
            inventoryItemId: r.inv.id,
            quantityPerServing: r.qty,
            unit: r.unit,
          },
          update: {
            quantityPerServing: r.qty,
            unit: r.unit,
          }
        })
      }
      return menuItem
    }

    let count = 0

    // =====================================================================
    // PREDJEDI (HLADNE + TOPLE)
    // =====================================================================
    await createFood('Hladni rozbif na rukoli', 10.00, catPredjedi.id, 'Tanko rezan goveji rozbif na posteljici rukole z olivnim oljem', '1,2', 9.5, [
      { inv: invRozbif, qty: 0.10, unit: 'kg' }, { inv: invRukola, qty: 0.03, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/rozbif-rukola.png'); count++
    await createFood('Ovčja skuta s krompirjem', 8.00, catPredjedi.id, 'Kremasta ovčja skuta s kuhanim krompirjem in zelišči', '1,2', 9.5, [
      { inv: invOvcjaSkuta, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/ovcja-skuta-3.png'); count++
    await createFood('Hobotnica v solati', 10.00, catPredjedi.id, 'Mehka hobotnica na listnati solati z limoninim prelivom', '1,2,4', 9.5, [
      { inv: invHobotnica, qty: 0.10, unit: 'kg' }, { inv: invSolata, qty: 0.05, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/hobotnica-solata-3.png'); count++
    await createFood('Jurčki na žaru', 10.00, catPredjedi.id, 'Sveži jurčki na žaru s česnom in peteršiljem', '1', 9.5, [
      { inv: invJurcki, qty: 0.15, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ], '/menu-images/hrana/jurcki-zar.png'); count++
    await createFood('Goveji carpaccio', 14.00, catPredjedi.id, 'Goveji carpaccio na rukoli s parmezanom in prelivi granatnega jabolka', '1,2', 9.5, [
      { inv: invGovejaPecjenka, qty: 0.08, unit: 'kg' }, { inv: invRukola, qty: 0.03, unit: 'kg' }, { inv: invParmezan, qty: 0.04, unit: 'kg' }, { inv: invGranatnoJabolko, qty: 0.25, unit: 'kos' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ], '/menu-images/hrana/goveji-carpaccio.png'); count++
    await createFood('Hišna pašteta z medom in tartufi', 10.90, catPredjedi.id, 'Domača paštetka z medom, tartufi in popečenimi kruhki', '1', 9.5, [
      { inv: invMletoSvinjsko, qty: 0.10, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }, { inv: invTartufata, qty: 0.01, unit: 'kg' }
    ],
      '/menu-images/hrana/bruschetta.png'); count++
    await createFood('Zapečen camembert z jagodičevjem', 14.00, catPredjedi.id, 'Zapečen francoski sir Camembert z jagodičevjem in toastom', '1,2', 9.5, [
      { inv: invCamembert, qty: 1, unit: 'kos' }, { inv: invJagode, qty: 0.05, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }
    ], '/menu-images/hrana/camembert-zapecen.png'); count++
    await createFood('Burrata s paradižnikom', 12.00, catPredjedi.id, 'Kremasta burrata s sesekljanim paradižnikom volovskega srca in baziliko', '1,2', 9.5, [
      { inv: invMozzarella, qty: 0.12, unit: 'kg' }, { inv: invParadiznik, qty: 0.10, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ], '/menu-images/hrana/burrata-paradiznik.png'); count++
    await createFood('Hladna dila - mesnine in siri', 9.50, catPredjedi.id, 'Mešane suhe mesnine in siri s kruhom', '1,2', 9.5, [
      { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invSalama, qty: 0.05, unit: 'kg' }, { inv: invSunka, qty: 0.05, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }, { inv: invKruh, qty: 0.25, unit: 'kos' }
    ], '/menu-images/hrana/hladna-dila.png'); count++
    await createFood('Frito misto', 12.00, catPredjedi.id, 'Ocvrte morske dobrote s tartarsko omako', '1,2,4', 9.5, [
      { inv: invKalamari, qty: 0.10, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.10, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/frito-misto-2.png'); count++

    // =====================================================================
    // JUHE
    // =====================================================================
    await createFood('Goveja juha z rezanci', 3.50, catJuhe.id, 'Tradicionalna goveja juha s tankimi rezanci', '1', 9.5, [
      { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }, { inv: invSpageti, qty: 0.03, unit: 'kg' }
    ], '/menu-images/hrana/goveja-juha-rezanci-3.png'); count++
    await createFood('Goveja juha z jajcem', 3.50, catJuhe.id, 'Goveja juha s kuhanim jajcem', '1,3', 9.5, [
      { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }, { inv: invJajca, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/goveja-juha-jajce-2.png'); count++
    await createFood('Jota', 4.50, catJuhe.id, 'Tradicionalna jota s kislim zeljem, fižolom in krompirjem', '1', 9.5, [
      { inv: invKisloZelje, qty: 0.15, unit: 'kg' }, { inv: invFizol, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.10, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invSlanina, qty: 0.03, unit: 'kg' }
    ], '/menu-images/hrana/jota.png'); count++
    await createFood('Gobova juha', 4.50, catJuhe.id, 'Kremna gobova juha s šampinjoni in jurčki', '1', 9.5, [
      { inv: invGobovaJuhovina, qty: 0.33, unit: 'L' }, { inv: invGobe, qty: 0.05, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
    ], '/menu-images/hrana/gobova-juha-3.png'); count++
    await createFood('Zelenjavna juha', 3.50, catJuhe.id, 'Sveža zelenjavna juha s sezono zelenjave', '1', 9.5, [
      { inv: invZelenjavnaJuhovina, qty: 0.33, unit: 'L' }, { inv: invPecenaZelenjava, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/zelenjavna-juha-3.png'); count++
    await createFood('Dnevna juha', 4.00, catJuhe.id, 'Dnevna ponudba domače juhe', '1', 9.5, [
      { inv: invGovejaJuhovina, qty: 0.33, unit: 'L' }
    ],
      '/menu-images/hrana/dnevna-juha.png'); count++

    // =====================================================================
    // TESTENINE IN NJOKI
    // =====================================================================
    await createFood('Špageti s paradižnikom', 9.00, catTestenine.id, 'Špageti s svežim paradižnikom in baziliko', '1', 9.5, [
      { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invPelati, qty: 0.15, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ],
      '/menu-images/hrana/spageti-paradiznik.png'); count++
    await createFood('Špageti bolonjske', 10.00, catTestenine.id, 'Špageti z bogato bolonjsko omako', '1,3', 9.5, [
      { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invBolonjskaOmaka, qty: 0.20, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ], '/menu-images/hrana/spageti-bolonjske-3.png'); count++
    await createFood('Špageti carbonara', 11.80, catTestenine.id, 'Klasika s panceto, jajci in parmezanom', '1,2,3', 9.5, [
      { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invPanceta, qty: 0.05, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/spageti-carbonara.png'); count++
    await createFood('Špageti z morskimi sadeži', 14.50, catTestenine.id, 'Špageti z mešanimi morskimi sadeži v omaki iz paradižnika', '1,4', 9.5, [
      { inv: invSpageti, qty: 0.20, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.15, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/spageti-morski.png'); count++
    await createFood('Peresniki s paradižnikom in pestom', 9.80, catTestenine.id, 'Peresniki s svežim paradižnikom in bazilikinim pestom', '1,3', 9.5, [
      { inv: invPeresniki, qty: 0.20, unit: 'kg' }, { inv: invPestoGenovese, qty: 0.03, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ],
      '/menu-images/hrana/peresniki-pesto.png'); count++
    await createFood('Peresniki s piščancem in jurčki', 12.50, catTestenine.id, 'Peresniki s piščančjim filejem in jurčki v smetanovi omaki', '1,2', 9.5, [
      { inv: invPeresniki, qty: 0.20, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
    ],
      '/menu-images/hrana/peresniki-piscanec-jurcki.png'); count++
    await createFood('Široki rezanci z govejim filejem', 14.20, catTestenine.id, 'Široki rezanci s trakci govejega fileja in pečeno papriko', '1', 9.5, [
      { inv: invSirokiRezanci, qty: 0.20, unit: 'kg' }, { inv: invGovejiFile, qty: 0.08, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ],
      '/menu-images/hrana/fettuccine-alfredo.png'); count++
    await createFood('Široki rezanci z lososom', 13.70, catTestenine.id, 'Široki rezanci z dimljenim lososom in drobnjakom', '1,4', 9.5, [
      { inv: invSirokiRezanci, qty: 0.20, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
    ],
      '/menu-images/hrana/rezanci-losos.png'); count++
    await createFood('Fuži s tartufi', 13.50, catTestenine.id, 'Fuži s tartufato, tartufnim oljem in parmezanom', '1', 9.5, [
      { inv: invFuzi, qty: 0.20, unit: 'kg' }, { inv: invTartufata, qty: 0.02, unit: 'kg' }, { inv: invTartufnoOlje, qty: 0.005, unit: 'L' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/fuzi-tartufi.png'); count++
    await createFood('Fuži z gamberi', 13.90, catTestenine.id, 'Fuži z gamberi, beluši in panceto v mascarpone omaki', '1,2,4', 9.5, [
      { inv: invFuzi, qty: 0.20, unit: 'kg' }, { inv: invGamberi, qty: 0.06, unit: 'kg' }, { inv: invSparglji, qty: 0.03, unit: 'kg' }, { inv: invPanceta, qty: 0.03, unit: 'kg' }, { inv: invMascarpone, qty: 0.06, unit: 'kg' }
    ],
      '/menu-images/hrana/fuzi-gamberi.png'); count++
    await createFood('Njoki z jurčki', 12.90, catTestenine.id, 'Mehki njoki z jurčki in smetanovo omako', '1', 9.5, [
      { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ],
      '/menu-images/hrana/njoki-gorgonzola-2.png'); count++
    await createFood('Njoki z bučkami in panceto', 11.90, catTestenine.id, 'Njoki z bučkami, dimljeno panceto in sušenim paradižnikom', '1', 9.5, [
      { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invBucke, qty: 0.06, unit: 'kg' }, { inv: invPanceta, qty: 0.04, unit: 'kg' }, { inv: invPelati, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/njoki-bucke-panceta.png'); count++
    await createFood('Žlikrofi z gorgonzolo', 12.00, catTestenine.id, 'Klasiki žlikrofi s kremno gorgonzolo', '1,2', 9.5, [
      { inv: invZlikrofi, qty: 0.25, unit: 'kg' }, { inv: invGorgonzola, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
    ],
      '/menu-images/hrana/njoki-gorgonzola.png'); count++
    await createFood('Žlikrofi s tepkami', 6.00, catTestenine.id, 'Bovški krafi - štruklji s tepkami', '1,2', 9.5, [
      { inv: invZlikrofi, qty: 0.20, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/zlikrofi-tepke.png'); count++
    await createFood('Njoki z lososom', 12.00, catTestenine.id, 'Njoki z lososom v smetanovi omaki', '1,2,4', 9.5, [
      { inv: invNjoki, qty: 0.20, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }
    ],
      '/menu-images/hrana/njoki-losos.png'); count++
    await createFood('Mesna lazanja', 12.00, catTestenine.id, 'Tradicionalna mesna lazanja z bešamelom in parmezanom', '1,2,3,8', 9.5, [
      { inv: invLazanjaTesto, qty: 0.15, unit: 'kg' }, { inv: invBolonjskaOmaka, qty: 0.20, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/lasanja-2.png'); count++
    await createFood('Zelenjavna lazanja', 12.00, catTestenine.id, 'Lazanja s pečeno zelenjavo in sirom', '1,2', 9.5, [
      { inv: invLazanjaTesto, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }, { inv: invMozzarella, qty: 0.08, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/lasanja.png'); count++

    // =====================================================================
    // RIŽOTE
    // =====================================================================
    await createFood('Rižota z jurčki', 10.00, catRizote.id, 'Kremna rižota z jurčki in parmezanom', '1', 9.5, [
      { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/rizot-gobe-3.png'); count++
    await createFood('Rižota z morskimi sadeži', 14.00, catRizote.id, 'Rižota z mešanimi morskimi sadeži', '1,4', 9.5, [
      { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invMorskiSadezi, qty: 0.12, unit: 'kg' }, { inv: invPelati, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
    ],
      '/menu-images/hrana/rizot-morski-sadezi-2.png'); count++
    await createFood('Rižota s piščancem in zelenjavo', 11.00, catRizote.id, 'Rižota s piščančjim mesom in sezonsko zelenjavo', '1', 9.5, [
      { inv: invRiz, qty: 0.18, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.08, unit: 'kg' }, { inv: invParmezan, qty: 0.02, unit: 'kg' }
    ],
      '/menu-images/hrana/rizota-piscanec-zelenjava.png'); count++

    // =====================================================================
    // MESNE JEDI - ZREZKI
    // =====================================================================
    await createFood('Dunajski zrezek', 11.00, catMesneJedi.id, 'Klasik - paniran svinjski zrezek s pomfrijem in limono', '1,2,3', 9.5, [
      { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/dunajski-zrezek.png'); count++
    await createFood('Ljubljanski zrezek', 13.00, catMesneJedi.id, 'Paniran svinjski zrezek s šunko in sirom, pekovski krompirček', '1,2,3', 9.5, [
      { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/ljubljanski-zrezek.png'); count++
    await createFood('Piščančji zrezek s sirom', 11.00, catMesneJedi.id, 'Paniran piščančji file s sirom in pomfrijem', '1,2,3', 9.5, [
      { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invMoka, qty: 0.03, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/piscanji-zrezek-sir.png'); count++
    await createFood('Piščančji zrezek z gobami', 12.00, catMesneJedi.id, 'Piščančji file z gobovo omako in pire krompirjem', '1,2', 9.5, [
      { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invGobe, qty: 0.08, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/piscanji-zrezek-gobe.png'); count++
    await createFood('Rozbif z jurčki', 20.00, catMesneJedi.id, 'Goveji rozbif z jurčki in ocvrtim krompirjem', '1,2', 9.5, [
      { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/rozbif-jurcki.png'); count++
    await createFood('Hišni zrezek', 17.00, catMesneJedi.id, 'Specialni hišni zrezek z žara s prilogo', '1,2', 9.5, [
      { inv: invSvinjskiVrat, qty: 0.25, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/ribeye-zrezek.png'); count++
    await createFood('Svinjski medaljoni v jurčkovi omaki', 12.20, catMesneJedi.id, 'Svinjski medaljoni v kremni jurčkovi omaki z njoki', '1,2', 9.5, [
      { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invJurcki, qty: 0.05, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.06, unit: 'L' }, { inv: invNjoki, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/svinjski-kare-2.png'); count++
    await createFood('File mignon na polenti', 26.00, catMesneJedi.id, 'Goveji file mignon na dimljeni polenti s kozjim sirom', '1,2', 9.5, [
      { inv: invGovejiFile, qty: 0.25, unit: 'kg' }, { inv: invPolenta, qty: 0.10, unit: 'kg' }, { inv: invOvcjaSkuta, qty: 0.04, unit: 'kg' }
    ],
      '/menu-images/hrana/file-mignon-polenta.png'); count++
    await createFood('Rib-eye steak 300g', 26.00, catMesneJedi.id, 'Rib-eye z žara z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
      { inv: invGovejaPecjenka, qty: 0.30, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/ribeye-300g.png'); count++
    await createFood('T-bone 1000g', 36.00, catMesneJedi.id, 'T-bone za dva z ocvrtim krompirjem in pečeno zelenjavo', '1', 9.5, [
      { inv: invGovejaPecjenka, qty: 0.50, unit: 'kg' }, { inv: invSvinjskiKare, qty: 0.50, unit: 'kg' }, { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/tbone-1000g.png'); count++

    // =====================================================================
    // JEDI Z ŽARA
    // =====================================================================
    await createFood('Čevapčiči', 10.00, catZar.id, 'Domovi čevapčiči s pomfrijem in lepinjo', '1', 9.5, [
      { inv: invCevapci, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/cevapcici.png'); count++
    await createFood('Pleskavica', 10.00, catZar.id, 'Domova pleskavica s pomfrijem in lepinjo', '1', 9.5, [
      { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/pleskavica.png'); count++
    await createFood('Pleskavica s kajmakom', 11.00, catZar.id, 'Pleskavica s kajmakom, pomfrij in lepinja', '1,2', 9.5, [
      { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invKajmak, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invLepinja, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/pleskavica-kajmak.png'); count++
    await createFood('Polnjena pleskavica', 12.00, catZar.id, 'Pleskavica polnjena sirom s pomfrijem', '1,2', 9.5, [
      { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/polnjena-pleskavica.png'); count++
    await createFood('Vešalica - svinjski kare', 10.00, catZar.id, 'Svinjski kare z žara s pomfrijem', '1', 9.5, [
      { inv: invSvinjskiKare, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/svinjski-vrat-zar.png'); count++
    await createFood('Ražnjiči', 10.00, catZar.id, 'Svinjski ražnjiči s papriko in čebulo', '1', 9.5, [
      { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/raznjici.png'); count++
    await createFood('Mešano meso', 15.00, catZar.id, 'Mešano meso z žara s prilogo', '1', 9.5, [
      { inv: invCevapci, qty: 0.10, unit: 'kg' }, { inv: invPleskavica, qty: 1, unit: 'kos' }, { inv: invSvinjskiKare, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/mesano-meso.png'); count++
    await createFood('Rozbif na žaru', 20.00, catZar.id, 'Goveji rozbif z žara s prilogo', '1', 9.5, [
      { inv: invRozbif, qty: 0.25, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/rozbif-zar.png'); count++
    await createFood('Pikantna klobasa na žaru', 10.00, catZar.id, 'Pikantna klobasa z žara s pomfrijem', '1', 9.5, [
      { inv: invKlobasa, qty: 0.20, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/pikantna-klobasa-zar.png'); count++
    await createFood('Piščančji zrezek na žaru', 10.00, catZar.id, 'Piščančji file z žara s prilogo', '1', 9.5, [
      { inv: invPiscancjiFile, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/piscanji-zrezek-zar.png'); count++
    await createFood('BBQ rebrca', 14.50, catZar.id, 'Svinjska rebra z BBQ omako in krompirčki', '1,2', 9.5, [
      { inv: invSvinjskiVrat, qty: 0.30, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.05, unit: 'L' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/bbq-rebrca.png'); count++

    // =====================================================================
    // BURGERJI
    // =====================================================================
    await createFood('Black Angus burger', 9.50, catBurgerji.id, 'Black Angus burger z domačo omako in krompirčki', '1,2', 9.5, [
      { inv: invMletoGoveje, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/black-angus-burger.png'); count++
    await createFood('Pulled pork burger', 9.00, catBurgerji.id, 'Pulled pork burger sirom, coleslaw in krompirčki', '1,2', 9.5, [
      { inv: invSvinjskiVrat, qty: 0.20, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invMozzarella, qty: 0.03, unit: 'kg' }, { inv: invColeslaw, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/bacon-cheeseburger.png'); count++
    await createFood('Burger z lososom', 11.50, catBurgerji.id, 'Burger z lososom, kaviarjem, rukolo in krompirčki', '1,2,4', 9.5, [
      { inv: invLosos, qty: 0.15, unit: 'kg' }, { inv: invBurgerBun, qty: 1, unit: 'kos' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/burger-losos.png'); count++

    // =====================================================================
    // RIBJE JEDI
    // =====================================================================
    await createFood('Postrv s tržaško omako', 16.00, catRibjeJedi.id, 'Celà postrv s tržaško omako in krompirjem', '1,2,4', 9.5, [
      { inv: invPstrv, qty: 1, unit: 'kos' }, { inv: invTrzaskaOmaka, qty: 0.10, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/pstrv-trzaska-3.png'); count++
    await createFood('Lososov file na žaru', 17.00, catRibjeJedi.id, 'Lososov file z žara s šparglji in pire krompirjem', '1,2,4', 9.5, [
      { inv: invLosos, qty: 0.20, unit: 'kg' }, { inv: invSparglji, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/losos-zar-3.png'); count++
    await createFood('Lignji ocvrti', 12.00, catRibjeJedi.id, 'Hrustljavi ocvrti lignji s tartarsko omako', '1,2,4', 9.5, [
      { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/lignji-ocvrti-2.png'); count++
    await createFood('Lignji na žaru', 12.00, catRibjeJedi.id, 'Lignji na žaru s česnom in peteršiljem', '1,4', 9.5, [
      { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invCesen, qty: 0.01, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/lignji-zar-2.png'); count++
    await createFood('Lignji polnjeni', 13.50, catRibjeJedi.id, 'Polnjeni lignji s sirom in šunko', '1,2,4', 9.5, [
      { inv: invLignji, qty: 0.20, unit: 'kg' }, { inv: invMozzarella, qty: 0.05, unit: 'kg' }, { inv: invSunka, qty: 0.04, unit: 'kg' }
    ],
      '/menu-images/hrana/lignji-polnjeni.png'); count++
    await createFood('Hobotnica na žaru', 15.00, catRibjeJedi.id, 'Hobotnica na žaru s pečeno zelenjavo', '1,4', 9.5, [
      { inv: invHobotnica, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/hobotnica-zar-3.png'); count++
    await createFood('Tunin steak', 22.50, catRibjeJedi.id, 'Tunin steak z mediteransko zelenjavo in baziličnim oljem', '1,4', 9.5, [
      { inv: invTuna, qty: 0.20, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.10, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/tunin-steak.png'); count++
    await createFood('File bele ribe z blitva', 14.80, catRibjeJedi.id, 'File bele ribe z blitva krompirjem', '1,2,4', 9.5, [
      { inv: invKalamari, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invKuhanaZelenjava, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/file-bele-ribe.png'); count++

    // =====================================================================
    // PICE
    // =====================================================================
    const picaBase = () => [
      { inv: invPicaTesto, qty: 0.33, unit: 'kg' }, { inv: invPelati, qty: 0.10, unit: 'kg' }, { inv: invMozzarella, qty: 0.08, unit: 'kg' }
    ]
    await createFood('Margerita', 9.50, catPice.id, 'Pelati, mozzarella', '1,2', 9.5, picaBase()); count++
    await createFood('Česnova', 10.00, catPice.id, 'Pelati, mozzarella, česen', '1,2', 9.5, [...picaBase(), { inv: invCesen, qty: 0.02, unit: 'kg' }],
      '/menu-images/hrana/cesnova-pica.png'); count++
    await createFood('Siciliana', 10.50, catPice.id, 'Pelati, mozzarella, šunka, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.05, unit: 'kg' }, { inv: invGobe, qty: 0.04, unit: 'kg' }],
      '/menu-images/hrana/siciliana-pica.png'); count++
    await createFood('Capricioza', 11.00, catPice.id, 'Pelati, mozzarella, šunka, gobe, artičoke, olive', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }, { inv: invArtičoke, qty: 0.03, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }],
      '/menu-images/hrana/capricioza-pica.png'); count++
    await createFood('Mafiozo', 11.00, catPice.id, 'Pelati, mozzarella, pikantna salama, feferoni', '1,2', 9.5, [...picaBase(), { inv: invSalama, qty: 0.05, unit: 'kg' }, { inv: invFeferoni, qty: 0.02, unit: 'kg' }],
      '/menu-images/hrana/mafiozo-pica.png'); count++
    await createFood('Kraška', 13.00, catPice.id, 'Pelati, mozzarella, olive, pršut', '1,2', 9.5, [...picaBase(), { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/kraska-pica.png'); count++
    await createFood('4 siri', 11.00, catPice.id, 'Pelati, mozzarella, gorgonzola, brie, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGorgonzola, qty: 0.04, unit: 'kg' }, { inv: invBrie, qty: 0.04, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/4-siri-pica.png'); count++
    await createFood('Morska', 13.40, catPice.id, 'Pelati, mozzarella, morske dobrote, tržaška omaka', '1,2,4', 9.5, [...picaBase(), { inv: invMorskiSadezi, qty: 0.08, unit: 'kg' }, { inv: invTrzaskaOmaka, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/morska-pica.png'); count++
    await createFood('Tuna', 11.50, catPice.id, 'Pelati, mozzarella, tuna, čebula', '1,2,4', 9.5, [...picaBase(), { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invCebula, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/tuna-zrezek.png'); count++
    await createFood('Zelenjavna', 12.20, catPice.id, 'Pelati, mozzarella, bučke, paprika, gobe', '1,2', 9.5, [...picaBase(), { inv: invBucke, qty: 0.04, unit: 'kg' }, { inv: invPaprika, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/zelenjavna-pica.png'); count++
    await createFood('Tartuf', 15.90, catPice.id, 'Tartufno olje, tartufata, mozzarella, rukola, bufala', '1,2', 9.5, [...picaBase(), { inv: invTartufata, qty: 0.02, unit: 'kg' }, { inv: invTartufnoOlje, qty: 0.005, unit: 'L' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
      '/menu-images/hrana/rizot-gobe-tartufi.png'); count++
    await createFood('BBQ pizza', 11.90, catPice.id, 'Pelati, sir, slanina, piščančji trakci, rdeča čebula, BBQ omaka', '1,2', 9.5, [...picaBase(), { inv: invSlanina, qty: 0.04, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invBBQOmaka, qty: 0.03, unit: 'L' }],
      '/menu-images/hrana/bbq-pica.png'); count++
    await createFood('Rustika', 12.90, catPice.id, 'Pelati, mozzarella, feta, pršut, rukola, bazilično olje', '1,2', 9.5, [...picaBase(), { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invPrsut, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }],
      '/menu-images/hrana/rustika-pica.png'); count++
    await createFood('Carpaccio', 15.00, catPice.id, 'Pelati, mozzarella, goveji carpaccio, rukola, parmezan', '1,2', 9.5, [...picaBase(), { inv: invGovejaPecjenka, qty: 0.05, unit: 'kg' }, { inv: invRukola, qty: 0.02, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/carpaccio-pica.png'); count++
    await createFood('Domača', 12.50, catPice.id, 'Pelati, sir, domača šunka, suha salama, panceta, hren, gobe', '1,2', 9.5, [...picaBase(), { inv: invSunka, qty: 0.04, unit: 'kg' }, { inv: invSalama, qty: 0.03, unit: 'kg' }, { inv: invPanceta, qty: 0.03, unit: 'kg' }, { inv: invGobe, qty: 0.03, unit: 'kg' }],
      '/menu-images/hrana/domaca-pica.png'); count++

    // =====================================================================
    // SOLATE
    // =====================================================================
    await createFood('Mešana solata', 3.50, catSolate.id, 'Zelena solata, zelje, korenje, paradižnik', '1', 9.5, [
      { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.005, unit: 'L' }
    ],
      '/menu-images/hrana/mesana-solata.png'); count++
    await createFood('Šopska solata', 4.00, catSolate.id, 'Paradižnik, paprika, kumarice, čebula, feta sir', '1,2', 9.5, [
      { inv: invParadiznik, qty: 0.08, unit: 'kg' }, { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invCebula, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/sopska-solata.png'); count++
    await createFood('Grška solata', 4.50, catSolate.id, 'Paprika, paradižnik, kumarice, olive, čebula, feta sir', '1,2', 9.5, [
      { inv: invPaprika, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }, { inv: invOlive, qty: 0.03, unit: 'kg' }, { inv: invFeta, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/grska-solata.png'); count++
    await createFood('Italijanska solata', 8.00, catSolate.id, 'Rukola, paradižnik, mozzarella, olive, bazilika, olivno olje', '1,2', 9.5, [
      { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.06, unit: 'kg' }, { inv: invMozzarella, qty: 0.06, unit: 'kg' }, { inv: invOlive, qty: 0.02, unit: 'kg' }, { inv: invOlivnoOlje, qty: 0.01, unit: 'L' }
    ],
      '/menu-images/hrana/italijanska-solata.png'); count++
    await createFood('Solata s tuno', 10.00, catSolate.id, 'Mešana solata s tuno, sončnična semena, gorčični preliv', '1,2,4', 9.5, [
      { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invTunaKonzerva, qty: 1, unit: 'kos' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/solata-s-tuno-2.png'); count++
    await createFood('Piščančja solata', 10.00, catSolate.id, 'Mešana solata z orehi, piščancem, gorčični preliv', '1,2', 9.5, [
      { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/piscancja-solata.png'); count++
    await createFood('Solata z ocvrtim piščancem', 11.00, catSolate.id, 'Solata s hrustljavim ocvrtim piščancem in jogurtovim prelivom', '1,2,3', 9.5, [
      { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/solata-ocvrti-piscanec.png'); count++
    await createFood('Solata z dimljenim lososom', 12.00, catSolate.id, 'Rukola, paradižnik, feta, dimljen losos, jogurtov preliv', '1,2,4', 9.5, [
      { inv: invRukola, qty: 0.04, unit: 'kg' }, { inv: invLosos, qty: 0.08, unit: 'kg' }, { inv: invFeta, qty: 0.04, unit: 'kg' }, { inv: invParadiznik, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/solata-losos.png'); count++
    await createFood('Roastbeef solata', 13.50, catSolate.id, 'Listnata solata, paradižnik, roastbeef, jajce, grana padano', '1,2,3', 9.5, [
      { inv: invSolata, qty: 0.10, unit: 'kg' }, { inv: invRozbif, qty: 0.10, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/roastbeef-solata.png'); count++
    await createFood('Cezar solata', 12.00, catSolate.id, 'Rukola, piščanec, parmezan, krutoni, cezar preliv', '1,2,3', 9.5, [
      { inv: invRukola, qty: 0.05, unit: 'kg' }, { inv: invPiscancjiFile, qty: 0.10, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }, { inv: invKruh, qty: 0.15, unit: 'kos' }
    ],
      '/menu-images/hrana/cezar-solata-2.png'); count++

    // =====================================================================
    // PRILOGE
    // =====================================================================
    await createFood('Pomfrit', 3.50, catPriloge.id, 'Hrustljav ocvrt krompir', '1', 9.5, [
      { inv: invKrompir, qty: 0.20, unit: 'kg' }
    ],
      '/menu-images/hrana/pomfri-2.png'); count++
    await createFood('Kuhan krompir', 3.50, catPriloge.id, 'Kuhan krompir z maslom in drobnjakom', '1', 9.5, [
      { inv: invKrompir, qty: 0.20, unit: 'kg' }
    ],
      '/menu-images/hrana/kuhan-krompir.png'); count++
    await createFood('Pražen krompir', 3.50, catPriloge.id, 'Pražen krompir s čebulo', '1', 9.5, [
      { inv: invKrompir, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/prazen-krompir.png'); count++
    await createFood('Pečena zelenjava', 4.00, catPriloge.id, 'Pečena sezonska zelenjava', '1', 9.5, [
      { inv: invPecenaZelenjava, qty: 0.20, unit: 'kg' }
    ],
      '/menu-images/hrana/pecena-zelenjava-2.png'); count++
    await createFood('Kuhana zelenjava', 4.00, catPriloge.id, 'Kuhana zelenjava z maslom', '1', 9.5, [
      { inv: invKuhanaZelenjava, qty: 0.20, unit: 'kg' }
    ],
      '/menu-images/hrana/kuhana-zelenjava-3.png'); count++
    await createFood('Njoki', 3.20, catPriloge.id, 'Krompirjevi njoki kot priloga', '1', 9.5, [
      { inv: invNjoki, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/njoki-preprosti.png'); count++
    await createFood('Žlikrofi', 5.00, catPriloge.id, 'Žlikrofi kot priloga', '1', 9.5, [
      { inv: invZlikrofi, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/zlikrofi-2.png'); count++
    await createFood('Polenta', 3.50, catPriloge.id, 'Kremna polenta', '1', 9.5, [
      { inv: invPolenta, qty: 0.15, unit: 'kg' }
    ],
      '/menu-images/hrana/zlikrofi.png'); count++
    await createFood('Đuveč riž', 4.00, catPriloge.id, 'Đuveč riž z zelenjavo', '1', 9.5, [
      { inv: invRiz, qty: 0.15, unit: 'kg' }, { inv: invPecenaZelenjava, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/duvec-riz.png'); count++
    await createFood('Lepinja', 2.00, catPriloge.id, 'Sveža lepinja', '1', 9.5, [
      { inv: invLepinja, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/lepinja-2.png'); count++

    // =====================================================================
    // SLADICE
    // =====================================================================
    await createFood('Jabolčni zavitek', 4.00, catSladice.id, 'Hrustljav jabolčni zavitek s cimetom', '1,2', 9.5, [
      { inv: invJabolka, qty: 0.15, unit: 'kg' }, { inv: invMoka, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/cesnov-kruh.png'); count++
    await createFood('Panna cotta', 4.00, catSladice.id, 'Kremna panna cotta z jagodnim prelivom', '1,2', 9.5, [
      { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJagode, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/cokoladna-torta.png'); count++
    await createFood('Tiramisu', 4.50, catSladice.id, 'Klasik tiramisu z mascarpone kremo in kavo', '1,2', 9.5, [
      { inv: invMascarpone, qty: 0.08, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }
    ],
      '/menu-images/hrana/panna-cotta.png'); count++
    await createFood('Lava cake', 5.00, catSladice.id, 'Topla čokoladna tortica s tekočim sredinskim delom', '1,2', 9.5, [
      { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invSladkaSmetana, qty: 0.04, unit: 'L' }
    ],
      '/menu-images/hrana/tiramisu.png'); count++
    await createFood('Limonin creme brulee', 5.90, catSladice.id, 'Kremast limonin creme brulee s hrustljavo skorjico', '1,2', 9.5, [
      { inv: invSladkaSmetana, qty: 0.10, unit: 'L' }, { inv: invJajca, qty: 2, unit: 'kos' }
    ],
      '/menu-images/hrana/cokoladni-lava-cake.png'); count++
    await createFood('Bovški krafi', 6.00, catSladice.id, 'Bovški krafi - sladki štruklji s tepkami', '1,2', 9.5, [
      { inv: invZlikrofi, qty: 0.15, unit: 'kg' }, { inv: invKislaSmetana, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/creme-brulee.png'); count++
    await createFood('Ocvrti sir s steak krompirčki', 10.00, catSladice.id, 'Ocvrti sir s steak krompirčki in domačo tatarsko omako', '1,2,3', 9.5, [
      { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/ocvrti-sir-krompircki.png'); count++

    // =====================================================================
    // OTROŠKI MENI
    // =====================================================================
    await createFood('Scooby Doo', 8.00, catOtroški.id, 'Piščančji dunajski in pomfrit', '1,2,3', 9.5, [
      { inv: invPiscancjiFile, qty: 0.12, unit: 'kg' }, { inv: invMoka, qty: 0.02, unit: 'kg' }, { inv: invJajca, qty: 1, unit: 'kos' }, { inv: invDrobtine, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/scooby-doo.png'); count++
    await createFood('Duffy Duck', 8.00, catOtroški.id, 'Ocvrti lignji in pomfrit', '1,2,4', 9.5, [
      { inv: invLignji, qty: 0.12, unit: 'kg' }, { inv: invKoruznaMoka, qty: 0.03, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/duffy-duck-burger.png'); count++
    await createFood('Aladin', 8.00, catOtroški.id, 'Čevapčiči in pomfrit', '1', 9.5, [
      { inv: invCevapci, qty: 0.15, unit: 'kg' }, { inv: invKrompir, qty: 0.12, unit: 'kg' }
    ],
      '/menu-images/hrana/aladin-mesano.png'); count++

    // =====================================================================
    // VEGETARIJANSKE JEDI
    // =====================================================================
    await createFood('Vegetarijanski krožnik', 11.00, catMesneJedi.id, 'Sezonska zelenjava, riž, solata', '1', 9.5, [
      { inv: invPecenaZelenjava, qty: 0.15, unit: 'kg' }, { inv: invRiz, qty: 0.10, unit: 'kg' }, { inv: invSolata, qty: 0.05, unit: 'kg' }
    ],
      '/menu-images/hrana/vegetarijanski-kroznik.png'); count++
    await createFood('Ocvrti sir', 10.00, catMesneJedi.id, 'Ocvrti sir s pomfrijem in tatarsko omako', '1,2,3', 9.5, [
      { inv: invMladiSir, qty: 1, unit: 'kos' }, { inv: invKoruznaMoka, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.15, unit: 'kg' }, { inv: invTartarskaOmaka, qty: 0.05, unit: 'L' }
    ],
      '/menu-images/hrana/ocvrti-sir-3.png'); count++
    await createFood('Divjačinski golaž', 12.00, catMesneJedi.id, 'Divjačinski golaž s kruhom ali prilogo', '1', 9.5, [
      { inv: invDivjaci, qty: 0.20, unit: 'kg' }, { inv: invCebula, qty: 0.05, unit: 'kg' }, { inv: invKrompir, qty: 0.10, unit: 'kg' }
    ],
      '/menu-images/hrana/golaz-polenta.png'); count++
    await createFood('Ajdrova kaša z jurčki', 11.90, catMesneJedi.id, 'Ajdrova kaša z jurčki, pečenimi bučkami in parmezanom', '1', 9.5, [
      { inv: invAjdovaKasa, qty: 0.15, unit: 'kg' }, { inv: invJurcki, qty: 0.04, unit: 'kg' }, { inv: invBucke, qty: 0.05, unit: 'kg' }, { inv: invParmezan, qty: 0.03, unit: 'kg' }
    ],
      '/menu-images/hrana/ajdova-kasa-jurcki.png'); count++
    await createFood('Falafel wrap', 11.20, catMesneJedi.id, 'Hrustljavi falafel v lepinji z zelenjavo in tahini omako', '1,2', 9.5, [
      { inv: invLepinja, qty: 1, unit: 'kos' }, { inv: invSolata, qty: 0.05, unit: 'kg' }, { inv: invParadiznik, qty: 0.04, unit: 'kg' }
    ],
      '/menu-images/hrana/falafel-wrap.png'); count++

    // Get references to items created by beverage seed (if they exist)
    const existingKavnaZrna = await db.inventoryItem.findFirst({ where: { name: { contains: 'Kavna zrna' } } })
    const existingCokolada = await db.inventoryItem.findFirst({ where: { name: { contains: 'Čokolada za vročo' } } })
    const existingSladkor = await db.inventoryItem.findFirst({ where: { name: { contains: 'Sladkor' } } })
    const existingMed = await db.inventoryItem.findFirst({ where: { name: { contains: 'Med' } } })

    // Update tiramisu with coffee if available
    if (existingKavnaZrna) {
      const tiramisu = menuByName.get('Tiramisu')
      if (tiramisu) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: tiramisu.id, inventoryItemId: existingKavnaZrna.id } },
          create: { menuItemId: tiramisu.id, inventoryItemId: existingKavnaZrna.id, quantityPerServing: 0.01, unit: 'kg' },
          update: { quantityPerServing: 0.01, unit: 'kg' }
        })
      }
    }

    // Update lava cake with chocolate if available
    if (existingCokolada) {
      const lavaCake = menuByName.get('Lava cake')
      if (lavaCake) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: lavaCake.id, inventoryItemId: existingCokolada.id } },
          create: { menuItemId: lavaCake.id, inventoryItemId: existingCokolada.id, quantityPerServing: 0.06, unit: 'kg' },
          update: { quantityPerServing: 0.06, unit: 'kg' }
        })
      }
    }

    // Update creme brulee with sugar if available
    if (existingSladkor) {
      const brulee = menuByName.get('Limonin creme brulee')
      if (brulee) {
        await db.recipeItem.upsert({
          where: { menuItemId_inventoryItemId: { menuItemId: brulee.id, inventoryItemId: existingSladkor.id } },
          create: { menuItemId: brulee.id, inventoryItemId: existingSladkor.id, quantityPerServing: 0.02, unit: 'kg' },
          update: { quantityPerServing: 0.02, unit: 'kg' }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seed hrane uspešno dodan!`,
      stats: {
        inventoryItemsCreated: inventoryItems.length,
        foodItemsCreated: count,
        categoriesCreated: [...catByName.keys()].filter(k => !existingCats.find(c => c.name === k)).length,
      }
    })

  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/seed-food-norms', 'Napaka pri seedu hrane')
  }
}
