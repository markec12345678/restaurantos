// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Omake, začimbe, sladice
// =====================================================================

import { db } from '@/lib/db'

export async function createSaucesDessertsInventory() {
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

  return {
    invPelati, invOlivnoOlje, invKruhoveRezine, invGorciica, invHren,
    invAjvar, invOrigano, invKetchup, invPesto, invTartufi, invCurryPrah,
    invPoper, invSol, invKislaKumara, invTatarskaOmaka,
    invMokaPalacinke, invNutella, invLinoLada, invKakavZaPalačinke,
    invVanilijevPuding, invOreoPiskot, invPlazmaPiskot, invJagodniPire,
    invBelaCokolada, invPistacija, invArasidi, invMandlji,
    invKinderBueno, invFerreroRocher, invRaffaello, invMandM,
    invSnickers, invKokosovaMoka,
  }
}
