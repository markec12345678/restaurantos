# Feature Request: Multi-level (Nested) Recipes

## Status
- **Datum:** 2026-08-31
- **Prioriteta:** Medium (ni kritična za osnovni POS flow)
- **Tip:** Nova funkcionalnost (ne bug)
- **Trenutno stanje:** Enostavni 1:1 recepti (MenuItem → InventoryItem)

## Opis

Trenutno sistema podpira samo enostavne recepte kjer je vsak `MenuItem`
povezan z eno ali več `InventoryItem` sestavinami preko `RecipeItem` tabele.
Vsaka `RecipeItem` ima `menuItemId` in `inventoryItemId` — 1:1 povezava.

**Multi-level recepti** omogočajo gnezdenje receptov:
- "Pizza Margherita" → "Piza testo" (sub-recept) + "Paradižnikova omaka" (sub-recept) + "Mozzarella"
- "Piza testo" (sub-recept) → "Moka" + "Kvas" + "Voda" + "Olje"
- "Paradižnikova omaka" (sub-recept) → "Paradižnik" + "Bazilika" + "Česen"

## Trenutno stanje

### Kar DELUJE:
- ✅ Enostavni recepti: MenuItem → InventoryItem (1:1)
- ✅ Avtomatska razknjižba ob prodaji
- ✅ Recepti UI (master-detail view)
- ✅ Food cost calculator
- ✅ Recipe scaling
- ✅ Maržna poročila
- ✅ StockTransaction zapisi

### Kar MANJKA:
- ❌ Sub-recepti (npr. "Piza testo" kot recept z svojimi sestavinami)
- ❌ Multi-level razknjižba (skozi sub-recept do osnovnih sestavin)
- ❌ Nested recipe structure
- ❌ `parentRecipeItemId` polje obstaja v bazi ampak se ne uporablja (vsi = null)

## Za implementacijo potrebno

### 1. Prisma Schema
`RecipeItem` model že ima `parentRecipeItemId` polje, ampak:
- Mora imeti `@relation` do `RecipeItem` (self-referencing)
- Dodati `parentRecipeItem` in `childRecipeItems` relaciji

```prisma
model RecipeItem {
  // ... obstoječa polja ...
  parentRecipeItemId String?  // Če nastavljeno, je ta item sub-recept
  parentRecipeItem  RecipeItem? @relation("RecipeItemHierarchy", fields: [parentRecipeItemId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  childRecipeItems  RecipeItem[] @relation("RecipeItemHierarchy")
}
```

### 2. API (POST/PUT /api/recipes)
- Podpora za `parentRecipeItemId` v create/update
- Validacija proti krožnim referencam (A → B → A)
- GET naj vrača drevesno strukturo (z `include: { childRecipeItems: true }`)

### 3. Stock Deduction (lib/stock-deduction/deduct-recipe.ts)
- Rekurzivna razknjižba: če `RecipeItem` ima `parentRecipeItemId`,
  sledi sub-receptu in razknjiži njegove sestavine
- Prepreči neskončno rekurzijo (max depth = 5)
- Cost rollup: strošek glavnega recepta = vsota sub-receptov + lastnih sestavin

```typescript
async function deductRecipeItemRecursive(
  tx, recipeItem, quantity, depth = 0
): Promise<void> {
  if (depth > 5) throw new Error('Prevelika globina recepta (max 5)')
  
  if (recipeItem.parentRecipeItemId) {
    // Sledi sub-receptu
    const subRecipe = await tx.recipeItem.findMany({
      where: { menuItemId: recipeItem.parentRecipeItemId },
    })
    for (const sub of subRecipe) {
      await deductRecipeItemRecursive(tx, sub, quantity * recipeItem.quantityPerServing, depth + 1)
    }
  } else {
    // Razknjiži inventory item
    await deductInventoryItem(tx, recipeItem.inventoryItemId, quantity)
  }
}
```

### 4. UI (RecipeManager)
- Drevesni prikaz receptov z expand/collapse
- Drag-and-drop za premikanje sestavin med nivoji
- Vizualno ločevanje sub-receptov od sestavin
- Cost rollup prikaz na vsakem nivoju

### 5. Validacija
- Prepreči krožne reference (A → B → A)
- Prepreči self-reference (A → A)
- Max globina = 5 nivojev
- Sub-recept mora obstajati preden se uporabi

## Primer uporabe

### Trenutno (1:1):
```
Pizza Margherita
  → Piza testo (1 kos)
  → Paradižnik (0.150 kg)
  → Mozzarella (0.125 kg)
```
Problem: "Piza testo" je inventory item, ne sub-recept. Če se testenina
pripravi v kuhinji (iz moka, kvasa, vode), se ne more slediti stroškom
posameznih sestavin testa.

### Multi-level:
```
Pizza Margherita
  → [Sub-recept] Piza testo (1 kos)
      → Moka (0.250 kg)
      → Kvas (0.005 kg)
      → Voda (0.150 L)
      → Olje (0.010 L)
  → [Sub-recept] Paradižnikova omaka (0.150 kg)
      → Paradižnik (0.200 kg)
      → Bazilika (0.005 kg)
      → Česen (0.005 kg)
  → Mozzarella (0.125 kg)
```

## Prednosti
- Natančnejši izračun stroškov (food cost)
- Sledljivost sestavin za alergene
- Boljši inventory management (povezava polizdelkov)
- Standardizacija receptov (sub-recepti se lahko uporabijo v več jedeh)

## Slabosti
- Večja kompleksnost UI
- Potencialno počasnejša razknjižba (rekurzivna)
- Težje debugiranje (kateri sub-recept je povzročil napako)

## Ocene implementacije
- **Backend (schema + API + stock deduction):** ~4-6 ure
- **Frontend (UI + drevesni prikaz):** ~6-8 ur
- **Testiranje:** ~2-3 ure
- **Skupaj:** ~12-17 ur

## Prioriteta
**Medium** — trenutni 1:1 recepti pokrivajo 90% realnih scenarijev.
Multi-level je bolj primerno za:
- Pekarne s polizdelki
- Produkcije z medfazami
- Verige z centralno kuhinjo

## Test case za validacijo
1. Ustvari sub-recept "Piza testo" z moko, kvasom, vodo
2. Ustvari glavni recept "Pizza Margherita" ki uporablja "Piza testo" kot sub-recept
3. Prodaj 1x Pizza Margherita
4. Preveri: moka je razknjižena (ne piza testo)
5. Preveri: cost rollup = moka + kvas + voda + paradižnik + mozzarella
6. Preveri: StockTransaction zapisi za vse osnovne sestavine
