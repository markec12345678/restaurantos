// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Hrana (RestorantOS)
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem } from './types'

export async function createFoodInventory(): Promise<Record<string, InvItem>> {
    // =====================================================================
    // 4. INVENTARNE POSTAVKE ZA HRANO - RestorantOS
    // =====================================================================

    // --- MESO ---
    const invSvinjskiZrezek = await db.inventoryItem.create({ data: { name: 'Svinjski zrezek (1kg)', unit: 'kg', quantity: 15, minQuantity: 5, costPerUnit: 12.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 3.00 } })
    const invTelecjiZrezek = await db.inventoryItem.create({ data: { name: 'Telečji zrezek (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 28.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 7.00 } })
    const invPuramjiFile = await db.inventoryItem.create({ data: { name: 'Puranji file (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 14.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 6, servingSize: '170g', costPerServing: 2.33 } })
    const invPiscancjiFile = await db.inventoryItem.create({ data: { name: 'Piščančji file (1kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 6, servingSize: '170g', costPerServing: 1.67 } })
    const invGovedinaZaGolaz = await db.inventoryItem.create({ data: { name: 'Govedina za golaž (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 18.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })
    const invMletnoMeso = await db.inventoryItem.create({ data: { name: 'Mletno meso goveje (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })
    const invSvinjskaPecenko = await db.inventoryItem.create({ data: { name: 'Svinjska pečenka (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 2, servingSize: '450g', costPerServing: 4.50 } })
    const invTelecjaPrsa = await db.inventoryItem.create({ data: { name: 'Telečja prsa (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.60 } })
    const invBeefsteak = await db.inventoryItem.create({ data: { name: 'Beefsteak goveji (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 35.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 8.75 } })
    const invRostbeef = await db.inventoryItem.create({ data: { name: 'Rostbeef (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 7.50 } })
    const invSvinjskaKraca = await db.inventoryItem.create({ data: { name: 'Svinjska krača (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1500g', costPerServing: 12.00 } })
    const invRebra = await db.inventoryItem.create({ data: { name: 'Svinjska rebra (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 9.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '350g', costPerServing: 3.15 } })
    const invPecenaKlobasa = await db.inventoryItem.create({ data: { name: 'Pečenica (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 10.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 3.00 } })
    const invKrvavica = await db.inventoryItem.create({ data: { name: 'Krvavica (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 7.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 2.10 } })
    const invPiscanecCeli = await db.inventoryItem.create({ data: { name: 'Pišanec cel (kos)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 12.00, supplier: 'Perutninarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1500g', costPerServing: 12.00 } })
    const invGovedinaBograch = await db.inventoryItem.create({ data: { name: 'Govedina za bograč (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 16.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.20 } })
    const invBurgerPatty = await db.inventoryItem.create({ data: { name: 'Burger patty goveji 170g', unit: 'kos', quantity: 30, minQuantity: 10, costPerUnit: 3.50, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '170g', costPerServing: 3.50 } })
    const invPljucnaPecenka = await db.inventoryItem.create({ data: { name: 'Pljučna pečenka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo RestorantOS', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 3.60 } })

    // --- MESNINE / PRŠUT / ŠUNKA ---
    const invPrsut = await db.inventoryItem.create({ data: { name: 'Kraški pršut (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 30.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 3.00 } })
    const invKuhanPrsut = await db.inventoryItem.create({ data: { name: 'Kuhan pršut (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.80 } })
    const invDomacaSunka = await db.inventoryItem.create({ data: { name: 'Domača šunka (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 15.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.50 } })
    const invSuhaSalama = await db.inventoryItem.create({ data: { name: 'Suha goveja salama (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 14.00, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.40 } })
    const invHrenovka = await db.inventoryItem.create({ data: { name: 'Hrenovka (kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 1.50, supplier: 'Mesarstvo', category: 'meat', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invMesnineIzbira = await db.inventoryItem.create({ data: { name: 'Izbira kraških mesnin (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Kraški pršut', category: 'meat', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 7.33 } })
    const invKebabMeso = await db.inventoryItem.create({ data: { name: 'Piščančji kebab (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'meat', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.40 } })

    // --- RIBE IN MORSKI SADEŽI ---
    const invLosos = await db.inventoryItem.create({ data: { name: 'File lososa (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 22.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.60 } })
    const invFileOrade = await db.inventoryItem.create({ data: { name: 'File orade (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 18.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 5.40 } })
    const invFileBrancina = await db.inventoryItem.create({ data: { name: 'File brancina (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 6.00 } })
    const invOslic = await db.inventoryItem.create({ data: { name: 'Ocvrt oslič (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 12.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 4.00 } })
    const invFilePostrvi = await db.inventoryItem.create({ data: { name: 'File postrvi (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 3, servingSize: '300g', costPerServing: 4.20 } })
    const invGamberi = await db.inventoryItem.create({ data: { name: 'Gamberi (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 25.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 5.00 } })
    const invKalamari = await db.inventoryItem.create({ data: { name: 'Kalamari sveži (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 14.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 2.80 } })
    const invTunaKos = await db.inventoryItem.create({ data: { name: 'Tuna v kosih (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Ribarnica', category: 'fish', location: 'hladilnik', servingsPerUnit: 6, servingSize: '150g', costPerServing: 3.33 } })

    // --- SIRI ---
    const invMozzarella = await db.inventoryItem.create({ data: { name: 'Mozzarella (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 10.00, supplier: 'Mlekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invParmezan = await db.inventoryItem.create({ data: { name: 'Parmezan Grana Padano (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.40 } })
    const invFetaSir = await db.inventoryItem.create({ data: { name: 'Feta sir (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invKozjiSir = await db.inventoryItem.create({ data: { name: 'Kozji sir (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 20.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 2.00 } })
    const invEdamec = await db.inventoryItem.create({ data: { name: 'Edamec (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 12.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invGauda = await db.inventoryItem.create({ data: { name: 'Gauda (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Sirarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invSiroviStrukelj = await db.inventoryItem.create({ data: { name: 'Sirovi štrukelj (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 2.50 } })

    // --- MLEČNI IZDELKI ---
    const invKislaSmetana = await db.inventoryItem.create({ data: { name: 'Kisla smetana (0.20L)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 0.80, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 0.80 } })
    const invSladkaSmetana = await db.inventoryItem.create({ data: { name: 'Sladka smetana za kuhanje (0.20L)', unit: 'kos', quantity: 15, minQuantity: 5, costPerUnit: 1.00, supplier: 'Ljubljanske mlekarne', category: 'dairy', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.00 } })

    // --- TESTENINE IN RIŽ ---
    const invSpageti = await db.inventoryItem.create({ data: { name: 'Špageti (1kg)', unit: 'kg', quantity: 10, minQuantity: 3, costPerUnit: 2.00, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })
    const invRezanci = await db.inventoryItem.create({ data: { name: 'Široki rezanci (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Barilla', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.50 } })
    const invNjoki = await db.inventoryItem.create({ data: { name: 'Njoki (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRizeviRezanci = await db.inventoryItem.create({ data: { name: 'Riževi rezanci (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })

    // --- ZELINJAVA ---
    const invPommesFrites = await db.inventoryItem.create({ data: { name: 'Pommes frites zamrznjeni (2.5kg)', unit: 'kg', quantity: 8, minQuantity: 3, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'produce', location: 'zamrzovalnik', servingsPerUnit: 5, servingSize: '500g', costPerServing: 1.25 } })
    const invSampinjoni = await db.inventoryItem.create({ data: { name: 'Sveži šampinjoni (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 4.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.80 } })
    const invMešanaZelenjava = await db.inventoryItem.create({ data: { name: 'Mešana zelenjava (1kg)', unit: 'kg', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '250g', costPerServing: 0.75 } })
    const invCesen = await db.inventoryItem.create({ data: { name: 'Česen (0.5kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Green Valley', category: 'produce', location: 'skladišče', servingsPerUnit: 50, servingSize: '10g', costPerServing: 0.12 } })
    const invBucke = await db.inventoryItem.create({ data: { name: 'Bučke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invMelancani = await db.inventoryItem.create({ data: { name: 'Melancani (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 3.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.70 } })
    const invRukola = await db.inventoryItem.create({ data: { name: 'Rukola (0.2kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 2.50, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.63 } })
    const invBlitva = await db.inventoryItem.create({ data: { name: 'Blitva (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.60 } })
    const invFeferoni = await db.inventoryItem.create({ data: { name: 'Feferoni (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'produce', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invAnanas = await db.inventoryItem.create({ data: { name: 'Ananas (1kos)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 3.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 6, servingSize: '1 rezina', costPerServing: 0.50 } })
    const invRepa = await db.inventoryItem.create({ data: { name: 'Repa (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 2.00, supplier: 'Green Valley', category: 'produce', location: 'hladilnik', servingsPerUnit: 5, servingSize: '200g', costPerServing: 0.40 } })

    // --- OMAKE, ZAČIMBE, OLJA ---
    const invPelati = await db.inventoryItem.create({ data: { name: 'Pelati paradižnik (2.5kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.50, supplier: 'Mutti', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 5, servingSize: '500g', costPerServing: 0.70 } })
    const invOlivnoOlje = await db.inventoryItem.create({ data: { name: 'Olivno olje (1L)', unit: 'L', quantity: 5, minQuantity: 2, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50ml', costPerServing: 0.40 } })
    const invKruhoveRezine = await db.inventoryItem.create({ data: { name: 'Kruhove rezine (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.25 } })
    const invGorciica = await db.inventoryItem.create({ data: { name: 'Gorčica (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '20g', costPerServing: 0.10 } })
    const invHren = await db.inventoryItem.create({ data: { name: 'Hren (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })
    const invAjvar = await db.inventoryItem.create({ data: { name: 'Ajvar (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.50 } })
    const invOrigano = await db.inventoryItem.create({ data: { name: 'Origano (0.1kg)', unit: 'kg', quantity: 0.5, minQuantity: 0.2, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '2g', costPerServing: 0.30 } })
    const invKetchup = await db.inventoryItem.create({ data: { name: 'Ketchup (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.15 } })
    const invPesto = await db.inventoryItem.create({ data: { name: 'Bazilični pesto (0.20kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.75 } })
    const invTartufi = await db.inventoryItem.create({ data: { name: 'Tartufi (0.05kg)', unit: 'kg', quantity: 0.2, minQuantity: 0.1, costPerUnit: 150.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 10, servingSize: '5g', costPerServing: 7.50 } })
    const invCurryPrah = await db.inventoryItem.create({ data: { name: 'Curry prah (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '5g', costPerServing: 0.75 } })
    const invPoper = await db.inventoryItem.create({ data: { name: 'Črni poper (0.1kg)', unit: 'kg', quantity: 0.3, minQuantity: 0.1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 50, servingSize: '2g', costPerServing: 0.24 } })
    const invSol = await db.inventoryItem.create({ data: { name: 'Sol (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 0.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 100, servingSize: '10g', costPerServing: 0.01 } })
    const invKislaKumara = await db.inventoryItem.create({ data: { name: 'Kisle kumarice (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 4.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.40 } })
    const invTatarskaOmaka = await db.inventoryItem.create({ data: { name: 'Tatarska omaka (0.20L)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20L', costPerServing: 1.50 } })

    // --- PALAČINKE IN SLADICE ---
    const invMokaPalacinke = await db.inventoryItem.create({ data: { name: 'Moka za palačinke (1kg)', unit: 'kg', quantity: 3, minQuantity: 1, costPerUnit: 1.50, supplier: 'Mlinotest', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.15 } })
    const invNutella = await db.inventoryItem.create({ data: { name: 'Nutella (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 10.00, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.00 } })
    const invLinoLada = await db.inventoryItem.create({ data: { name: 'Lino Lada (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Droga Kolinska', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invKakavZaPalačinke = await db.inventoryItem.create({ data: { name: 'Kakav za palačinke (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 10.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.50 } })
    const invVanilijevPuding = await db.inventoryItem.create({ data: { name: 'Vanilijev puding (kos)', unit: 'kos', quantity: 20, minQuantity: 5, costPerUnit: 1.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.00 } })
    const invOreoPiskot = await db.inventoryItem.create({ data: { name: 'Oreo piškot (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.80 } })
    const invPlazmaPiskot = await db.inventoryItem.create({ data: { name: 'Plazma piškot (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Droga Kolinska', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invJagodniPire = await db.inventoryItem.create({ data: { name: 'Jagodni pire (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'zamrzovalnik', servingsPerUnit: 10, servingSize: '100g', costPerServing: 0.60 } })
    const invBelaCokolada = await db.inventoryItem.create({ data: { name: 'Bela čokolada (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '100g', costPerServing: 1.20 } })
    const invPistacija = await db.inventoryItem.create({ data: { name: 'Pistacija (1kg)', unit: 'kg', quantity: 0.5, minQuantity: 0.2, costPerUnit: 30.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 1.50 } })
    const invArasidi = await db.inventoryItem.create({ data: { name: 'Arašidi (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 8.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.40 } })
    const invMandlji = await db.inventoryItem.create({ data: { name: 'Mleti mandlji (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 15.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.75 } })
    const invKinderBueno = await db.inventoryItem.create({ data: { name: 'Kinder Bueno (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invFerreroRocher = await db.inventoryItem.create({ data: { name: 'Ferrero Rocher (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.80, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.80 } })
    const invRaffaello = await db.inventoryItem.create({ data: { name: 'Raffaello (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.50, supplier: 'Ferrero', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.50 } })
    const invMandM = await db.inventoryItem.create({ data: { name: "M&M's bonboni (1kg)", unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 12.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.60 } })
    const invSnickers = await db.inventoryItem.create({ data: { name: 'Snickers (kos)', unit: 'kos', quantity: 10, minQuantity: 3, costPerUnit: 1.20, supplier: 'Mars', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1 kos', costPerServing: 1.20 } })
    const invKokosovaMoka = await db.inventoryItem.create({ data: { name: 'Kokosova moka (1kg)', unit: 'kg', quantity: 1, minQuantity: 1, costPerUnit: 5.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.25 } })

    // --- TESTO ZA PICE ---

    // =====================================================================
    // 5. RECEPTI ZA HRANO - RestorantOS
    // =====================================================================

  return {
  invSvinjskiZrezek,
  invTelecjiZrezek,
  invPuramjiFile,
  invPiscancjiFile,
  invGovedinaZaGolaz,
  invMletnoMeso,
  invSvinjskaPecenko,
  invTelecjaPrsa,
  invBeefsteak,
  invRostbeef,
  invSvinjskaKraca,
  invRebra,
  invPecenaKlobasa,
  invKrvavica,
  invPiscanecCeli,
  invGovedinaBograch,
  invBurgerPatty,
  invPljucnaPecenka,
  invPrsut,
  invKuhanPrsut,
  invDomacaSunka,
  invSuhaSalama,
  invHrenovka,
  invMesnineIzbira,
  invKebabMeso,
  invLosos,
  invFileOrade,
  invFileBrancina,
  invOslic,
  invFilePostrvi,
  invGamberi,
  invKalamari,
  invTunaKos,
  invMozzarella,
  invParmezan,
  invFetaSir,
  invKozjiSir,
  invEdamec,
  invGauda,
  invSiroviStrukelj,
  invKislaSmetana,
  invSladkaSmetana,
  invSpageti,
  invRezanci,
  invNjoki,
  invRizeviRezanci,
  invPommesFrites,
  invSampinjoni,
  invMešanaZelenjava,
  invCesen,
  invBucke,
  invMelancani,
  invRukola,
  invBlitva,
  invFeferoni,
  invAnanas,
  invRepa,
  invPelati,
  invOlivnoOlje,
  invKruhoveRezine,
  invGorciica,
  invHren,
  invAjvar,
  invOrigano,
  invKetchup,
  invPesto,
  invTartufi,
  invCurryPrah,
  invPoper,
  invSol,
  invKislaKumara,
  invTatarskaOmaka,
  invMokaPalacinke,
  invNutella,
  invLinoLada,
  invKakavZaPalačinke,
  invVanilijevPuding,
  invOreoPiskot,
  invPlazmaPiskot,
  invJagodniPire,
  invBelaCokolada,
  invPistacija,
  invArasidi,
  invMandlji,
  invKinderBueno,
  invFerreroRocher,
  invRaffaello,
  invMandM,
  invSnickers,
  invKokosovaMoka
  }
}
