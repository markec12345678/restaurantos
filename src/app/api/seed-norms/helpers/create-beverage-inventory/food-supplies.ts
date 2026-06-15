// Hrana: zelenjava, meso, mlečni izdelki, suhe sestavine
import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createFoodSupplies(): Promise<Record<string, InvItem>> {
    // --- ZELENJAVA IN SADJE ---
    const invRimskiOhrovt = await db.inventoryItem.create({ data: { name: 'Rimski ohrovt (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.35 } })
    const invParadiznik = await db.inventoryItem.create({ data: { name: 'Paradižnik (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invBazilika = await db.inventoryItem.create({ data: { name: 'Sveža bazilika (šen)', unit: 'šen', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 15, servingSize: '1 vejica', costPerServing: 0.20 } })
    const invCebula = await db.inventoryItem.create({ data: { name: 'Čebula (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 1.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })
    const invPaprika = await db.inventoryItem.create({ data: { name: 'Paprika (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '1 paprika', costPerServing: 0.44 } })
    const invGobe = await db.inventoryItem.create({ data: { name: 'Gobe šampinjoni (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 5.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.50 } })
    const invAvokado = await db.inventoryItem.create({ data: { name: 'Avokado (1kos)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 2.00 } })
    const invZelje = await db.inventoryItem.create({ data: { name: 'Zelje (1glava)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 1.50, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 4, servingSize: '250g', costPerServing: 0.38 } })
    const invKorenje = await db.inventoryItem.create({ data: { name: 'Korenje (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 1.80, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.18 } })

    // --- MESO IN RIBE ---
    const invGovedinaMleta = await db.inventoryItem.create({ data: { name: 'Mleta govedina (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSlanina = await db.inventoryItem.create({ data: { name: 'Slanina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invPanceta = await db.inventoryItem.create({ data: { name: 'Panceta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 15, servingSize: '65g', costPerServing: 0.80 } })
    const invJanjetina = await db.inventoryItem.create({ data: { name: 'Janječji kotleti (1kg)', unit: 'kg', quantity: 4, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', servingsPerUnit: 4, servingSize: '250g', costPerServing: 4.50 } })
    const invJajca = await db.inventoryItem.create({ data: { name: 'Jajca (10kos)', unit: 'kos', quantity: 30, minQuantity: 10, costPerUnit: 0.30, supplier: 'Kmetija', category: 'dairy', servingsPerUnit: 10, servingSize: '1 jajce', costPerServing: 0.30 } })

    // --- MLEKO IN MLEČNI IZDELKI ---
    const invMocarela = await db.inventoryItem.create({ data: { name: 'Mocarela (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 8, servingSize: '125g', costPerServing: 1.00 } })
    const invCheddarSir = await db.inventoryItem.create({ data: { name: 'Cheddar sir (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.60 } })
    const invSvicarskiSir = await db.inventoryItem.create({ data: { name: 'Švicarski sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.70 } })
    const invGorgonzola = await db.inventoryItem.create({ data: { name: 'Gorgonzola (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 16.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.80 } })
    const invRicotta = await db.inventoryItem.create({ data: { name: 'Ricotta (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 6.00, supplier: 'Sirarna', category: 'dairy', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invMaslo = await db.inventoryItem.create({ data: { name: 'Maslo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })

    // --- SUHE SESTAVINE ---
    const invMoka = await db.inventoryItem.create({ data: { name: 'Moka (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.05 } })
    const invKruh = await db.inventoryItem.create({ data: { name: 'Kruh za bruschetta (1 hlebček)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dry-goods', servingsPerUnit: 8, servingSize: '1 rezina', costPerServing: 0.31 } })
    const invTestoZaPico = await db.inventoryItem.create({ data: { name: 'Testo za pico (1 kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 1, servingSize: '1 testo', costPerServing: 1.50 } })
    const invPivskoTesto = await db.inventoryItem.create({ data: { name: 'Pivsko testo (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.30 } })
    const invKrompir = await db.inventoryItem.create({ data: { name: 'Krompir (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 1.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.20 } })
    const invRiz = await db.inventoryItem.create({ data: { name: 'Riž (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invOljcnoOlje = await db.inventoryItem.create({ data: { name: 'Oljčno olje (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Oljarstvo', category: 'dry-goods', servingsPerUnit: 50, servingSize: '0.02L', costPerServing: 0.16 } })
    const invKis = await db.inventoryItem.create({ data: { name: 'Balzamični kis (0.50L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '0.01L', costPerServing: 0.16 } })
    const invCesn = await db.inventoryItem.create({ data: { name: 'Česen (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.12 } })
    const invBBQOmaka = await db.inventoryItem.create({ data: { name: 'BBQ omaka (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '0.05L', costPerServing: 0.20 } })
    const invTartarskaOmaka = await db.inventoryItem.create({ data: { name: 'Tartarska omaka (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 30, servingSize: '0.03L', costPerServing: 0.17 } })
    const invParadiznikovaOmaka = await db.inventoryItem.create({ data: { name: 'Paradižnikova omaka za pico (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 8, servingSize: '0.12L', costPerServing: 0.38 } })
    const invBechamel = await db.inventoryItem.create({ data: { name: 'Béchamel omaka (1L)', unit: 'L', quantity: 3, minQuantity: 1, costPerUnit: 4.00, supplier: 'Kuhinja', category: 'dairy', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.40 } })
    const invKavaZaTiramisu = await db.inventoryItem.create({ data: { name: 'Kava za tiramisu (1L)', unit: 'L', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Kavarna', category: 'beverages', servingsPerUnit: 10, servingSize: '0.10L', costPerServing: 0.30 } })
    const invMascarpone = await db.inventoryItem.create({ data: { name: 'Mascarpone (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', servingsPerUnit: 5, servingSize: '200g', costPerServing: 1.60 } })
    const invKakavPrašek = await db.inventoryItem.create({ data: { name: 'Kakav prah za tiramisu (0.50kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.30 } })
    const invPiskoti = await db.inventoryItem.create({ data: { name: 'Piškoti Savoiardi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invCrnoFižol = await db.inventoryItem.create({ data: { name: 'Črni fižol (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.30 } })
    const invKoruza = await db.inventoryItem.create({ data: { name: 'Koruza (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invSolata = await db.inventoryItem.create({ data: { name: 'Mešana solata (1kg)', unit: 'kg', quantity: 4, minQuantity: 2, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 8, servingSize: '125g', costPerServing: 0.50 } })
    const invZrezki = await db.inventoryItem.create({ data: { name: 'Testenine špageti (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invPenneTestenine = await db.inventoryItem.create({ data: { name: 'Testenine penne (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.00, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.20 } })
    const invFettuccine = await db.inventoryItem.create({ data: { name: 'Testenine fettuccine (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invGovejaJuha = await db.inventoryItem.create({ data: { name: 'Goveja juha osnova (5L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Kuhinja', category: 'dry-goods', servingsPerUnit: 10, servingSize: '0.50L', costPerServing: 1.50 } })
    const invZrezkiRezanci = await db.inventoryItem.create({ data: { name: 'Rezanci za juho (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Mlinotest', category: 'dry-goods', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invPeprikaChili = await db.inventoryItem.create({ data: { name: 'Chili paprika (0.5kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 8.00, supplier: 'Green Valley', category: 'produce', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.16 } })
    const invOlive = await db.inventoryItem.create({ data: { name: 'Črne olive (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invKruhoveDrobtine = await db.inventoryItem.create({ data: { name: 'Krušne drobtine (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.08 } })

    return {
      invRimskiOhrovt, invParadiznik, invBazilika, invCebula, invPaprika, invGobe,
      invAvokado, invZelje, invKorenje,
      invGovedinaMleta, invSlanina, invPanceta, invJanjetina, invJajca,
      invMocarela, invCheddarSir, invSvicarskiSir, invGorgonzola, invRicotta, invMaslo,
      invMoka, invKruh, invTestoZaPico, invPivskoTesto, invKrompir, invRiz,
      invOljcnoOlje, invKis, invCesn, invBBQOmaka, invTartarskaOmaka,
      invParadiznikovaOmaka, invBechamel, invKavaZaTiramisu, invMascarpone,
      invKakavPrašek, invPiskoti, invCrnoFižol,
      invKoruza, invSolata, invZrezki, invPenneTestenine, invFettuccine,
      invGovejaJuha, invZrezkiRezanci, invPeprikaChili, invOlive, invKruhoveDrobtine,
    }
}
