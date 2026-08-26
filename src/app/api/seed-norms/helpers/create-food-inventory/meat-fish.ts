// =====================================================================
// USTVARJANJE INVENTARNIH POSTAVK - Meso, mesnine, ribe
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createMeatFishInventory() {
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

  return {
    invSvinjskiZrezek, invTelecjiZrezek, invPuramjiFile, invPiscancjiFile,
    invGovedinaZaGolaz, invMletnoMeso, invSvinjskaPecenko, invTelecjaPrsa,
    invBeefsteak, invRostbeef, invSvinjskaKraca, invRebra,
    invPecenaKlobasa, invKrvavica, invPiscanecCeli, invGovedinaBograch,
    invBurgerPatty, invPljucnaPecenka,
    invPrsut, invKuhanPrsut, invDomacaSunka, invSuhaSalama,
    invHrenovka, invMesnineIzbira, invKebabMeso,
    invLosos, invFileOrade, invFileBrancina, invOslic,
    invFilePostrvi, invGamberi, invKalamari, invTunaKos,
  }
}
