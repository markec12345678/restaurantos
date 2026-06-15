// =====================================================================
// INVENTARNE POSTAVKE - Zelenjava, omake, začimbe in ostalo
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem } from '../types'

export async function createProduceSaucesAndExtras(): Promise<Record<string, InvItem>> {
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

    // --- PICA SESTAVINE IN EXTRAS ---
    const invOlive = await db.inventoryItem.create({ data: { name: 'Olive (1kg)', unit: 'kg', quantity: 2, minQuantity: 1, costPerUnit: 6.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 20, servingSize: '50g', costPerServing: 0.30 } })
    const invArtičoke = await db.inventoryItem.create({ data: { name: 'Artičoke v olju (0.30kg)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 4, servingSize: '75g', costPerServing: 0.75 } })
    const invFeferoni = await db.inventoryItem.create({ data: { name: 'Feferoni (1kg)', unit: 'kg', quantity: 1, minQuantity: 0.5, costPerUnit: 6.00, supplier: 'Zelenjavnik', category: 'produce', location: 'hladilnik', servingsPerUnit: 30, servingSize: '33g', costPerServing: 0.20 } })
    const invSlaniFileti = await db.inventoryItem.create({ data: { name: 'Slani fileti inčuni (0.10kg)', unit: 'kos', quantity: 6, minQuantity: 2, costPerUnit: 3.00, supplier: 'Dobavitelj', category: 'seafood', location: 'hladilnik', servingsPerUnit: 4, servingSize: '25g', costPerServing: 0.75 } })
    const invKapre = await db.inventoryItem.create({ data: { name: 'Kapre (0.10kg)', unit: 'kos', quantity: 3, minQuantity: 1, costPerUnit: 2.50, supplier: 'Dobavitelj', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 10, servingSize: '10g', costPerServing: 0.25 } })
    const invKajmak = await db.inventoryItem.create({ data: { name: 'Kajmak (0.20kg)', unit: 'kos', quantity: 4, minQuantity: 2, costPerUnit: 2.00, supplier: 'Dobavitelj', category: 'dairy', location: 'hladilnik', servingsPerUnit: 4, servingSize: '50g', costPerServing: 0.50 } })
    const invColeslaw = await db.inventoryItem.create({ data: { name: 'Coleslaw solata (0.20kg)', unit: 'kos', quantity: 5, minQuantity: 2, costPerUnit: 1.50, supplier: 'Kuhinja', category: 'produce', location: 'hladilnik', servingsPerUnit: 1, servingSize: '0.20kg', costPerServing: 1.50 } })
    const invBurgerBun = await db.inventoryItem.create({ data: { name: 'Burger žemlja (1kos)', unit: 'kos', quantity: 15, minQuantity: 5, costPerUnit: 0.50, supplier: 'Pekarna', category: 'dry-goods', location: 'skladišče', servingsPerUnit: 1, servingSize: '1kos', costPerServing: 0.50 } })

    return {
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
    }
}
