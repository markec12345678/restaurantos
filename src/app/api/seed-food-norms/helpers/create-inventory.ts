// =====================================================================
// INVENTARNE POSTAVKE - Sestavine hrane
// =====================================================================

import { db } from '@/lib/db'
import type { InvItem, InvMap } from './types'

export async function createFoodInventoryItems(): Promise<InvMap> {

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

  return {
  invGovejaPecjenka,
  invGovejiFile,
  invSvinjskiKare,
  invSvinjskiVrat,
  invPiscancjiFile,
  invMletoSvinjsko,
  invMletoGoveje,
  invRozbif,
  invDivjaci,
  invKlobasa,
  invCevapci,
  invPleskavica,
  invPrsut,
  invSunka,
  invSlanina,
  invPanceta,
  invSalama,
  invHrenovke,
  invLosos,
  invPstrv,
  invLignji,
  invKalamari,
  invTuna,
  invTunaKonzerva,
  invHobotnica,
  invGamberi,
  invMorskiSadezi,
  invMozzarella,
  invParmezan,
  invGorgonzola,
  invFeta,
  invOvcjaSkuta,
  invBrie,
  invCamembert,
  invMladiSir,
  invKislaSmetana,
  invSladkaSmetana,
  invMascarpone,
  invSpageti,
  invPeresniki,
  invSirokiRezanci,
  invNjoki,
  invFuzi,
  invZlikrofi,
  invLazanjaTesto,
  invRiz,
  invPicaTesto,
  invPolenta,
  invAjdovaKasa,
  invKrompir,
  invParadiznik,
  invPelati,
  invCebula,
  invCesen,
  invPaprika,
  invBucke,
  invJajcevec,
  invGobe,
  invJurcki,
  invSparglji,
  invSolata,
  invRukola,
  invRadik,
  invKoruznaMoka,
  invPecenaZelenjava,
  invKuhanaZelenjava,
  invBolonjskaOmaka,
  invTrzaskaOmaka,
  invTartarskaOmaka,
  invPestoGenovese,
  invBBQOmaka,
  invTartufata,
  invTartufnoOlje,
  invOlivnoOlje,
  invJajca,
  invMoka,
  invDrobtine,
  invKruh,
  invLepinja,
  invJabolka,
  invJagode,
  invGranatnoJabolko,
  invGovejaJuhovina,
  invZelenjavnaJuhovina,
  invGobovaJuhovina,
  invKisloZelje,
  invFizol,
  invKrompirjevaSolata,
  invOlive,
  invArtičoke,
  invFeferoni,
  invSlaniFileti,
  invKapre,
  invKajmak,
  invColeslaw,
  invBurgerBun
  }
}
