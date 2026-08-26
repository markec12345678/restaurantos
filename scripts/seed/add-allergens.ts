// ============================================
// ALLERGEN MAPPING SCRIPT — EU 1169/2011 (14 mandatory allergens)
// ============================================
//
// EU 14 alergenov (Annex II of Regulation (EU) No 1169/2011):
//   1  — Žita, ki vsebujejo gluten (pšenica, rž, ječmen, oves, pira, kamut)
//   2  — Raki/rakovci (jastog, kozica, rak, jastog)
//   3  — Jajca
//   4  — Ribe
//   5  — Arašidi
//   6  — Soja
//   7  — Mleko (incl. laktoza)
//   8  — Oreški (mandelj, lešnik, oreh, indijski oreh, pistacija, makadamija)
//   9  — Zeler
//  10  — Gorčica
//  11  — Sezam
//  12  — Žveplov dioksid in sulfidi (koncentracija > 10 mg/kg)
//  13  — Volčji bob (lupin)
//  14  — Mehkužci (dagnje, lignji, hobotnice, polži)
//
// Glej: https://eur-lex.europa.eu/LexUriServ/LexUriServ.do?uri=OJ:L:2011:304:0018:0063:en:PDF
//

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping: katera beseda v imenu/opisu/kategoriji → kateri alergen(i)
const ALLERGEN_RULES: Array<{ keywords: string[], allergens: number[] }> = [
  // 1 — Gluten (žita)
  { keywords: ['pica', 'pizza', 'testo', 'testenin', 'špaget', 'njok', 'makaron', 'rezanc', 'kruh', 'palačink', 'burger', 'bun', 'dough', 'bread', 'pancake', 'pasta', 'noodle', 'flour', 'cake', 'torta', 'tart', 'piškot', 'cookie', 'biscuit', 'crust', 'prelijc', 'strudelj', 'strudel', 'pita', 'krof', 'donut', 'waffle', 'vafl', 'knedl', 'cmok', 'žemja', 'kifla', 'croissant'], allergens: [1] },
  
  // 3 — Jajca
  { keywords: ['jajce', 'jajca', 'jajčn', 'omeleta', 'fritaja', 'palačink', 'pancake', 'cmok', 'knedl', 'šnicle', 'dunajska', 'pariška', 'paniran', 'ocvrt', 'battered', 'egg', 'mayon', 'majone', 'tartar', 'holandez', 'hollandais', 'custard', 'krema', 'pudding', 'zabaione', 'tiramisu', 'panna cotta', 'creme', 'souffle', 'meringue', 'bešamel', 'bechamel'], allergens: [3, 7] },
  
  // 4 — Ribe
  { keywords: ['riba', 'ribj', 'ribe', 'losos', 'tuna', 'oslič', 'brancin', 'orada', 'postrv', 'sardel', 'sardina', 'inčun', 'inčuni', 'skuša', 'bakalar', 'ribež', 'fish', 'salmon', 'tuna', 'cod', 'trout', 'sardine', 'anchovy', 'mackerel', 'herring', 'caviar', 'ikre'], allergens: [4] },
  
  // 14 — Mehkužci
  { keywords: ['lignj', 'kalamari', 'dagnj', 'hobotnic', 'polž', 'mušnj', 'lignji', 'calamari', 'squid', 'mussel', 'octopus', 'snail', 'clam', 'oyster', 'scallop', 'školjk'], allergens: [14, 4] },
  
  // 2 — Raki/rakovci
  { keywords: ['kozica', 'jastog', 'rak', 'gamberi', 'škamp', 'langust', 'rajčica', 'shrimp', 'prawn', 'lobster', 'crab', 'crayfish', 'langoustine', 'scampi'], allergens: [2] },
  
  // 7 — Mleko
  { keywords: ['sir', 'sira', 'siri', 'sirovi', 'mozzarell', 'parmezan', 'gorgonzol', 'feta', 'ricotta', 'mascarpone', 'cheddar', 'emmentaler', 'edamec', 'camembert', 'brie', 'mleko', 'mlečn', 'smetana', 'krem', 'jogurt', 'varenika', 'masl', 'lakt', 'laktoz', 'cheese', 'milk', 'cream', 'butter', 'yogurt', 'whey', 'casein', 'cappuccino', 'kava z mlekom', 'bela kava', 'kakav', 'latte', 'milkshak'], allergens: [7] },
  
  // 8 — Oreški
  { keywords: ['oreh', 'orehi', 'mandelj', 'lešnik', 'indijski oreh', 'pistac', 'makadam', 'pekan', ' brazil', 'cashew', 'walnut', 'almond', 'hazelnut', 'pecan', 'pistachio', 'nutella', 'raffaello', 'kinder bueno', 'ferrero', 'snickers', 'pistachio', 'nuttella'], allergens: [8, 7] },
  
  // 5 — Arašidi
  { keywords: ['arašid', 'kikiriki', 'peanut', 'groundnut'], allergens: [5] },
  
  // 6 — Soja
  { keywords: ['soja', 'sojin', 'soy', 'soybean', 'tofu', 'tempeh', 'miso', 'shoyu', 'tadži', 'pad thai'], allergens: [6] },
  
  // 9 — Zeler
  { keywords: ['zeler', 'celer', 'celery'], allergens: [9] },
  
  // 10 — Gorčica
  { keywords: ['gorčic', 'mustard', 'dijon', 'senf'], allergens: [10] },
  
  // 11 — Sezam
  { keywords: ['sezam', 'sesame', 'tahini', 'tahin'], allergens: [11] },
  
  // 12 — Sulfidi (žveplov dioksid)
  { keywords: ['vino', 'penina', 'šampanj', 'champagne', 'prosecco', 'marsala', 'sherry', 'port', 'vinaigrette', 'suho sadje', 'dried fruit', 'sultana', 'rozin'], allergens: [12] },
  
  // 13 — Volčji bob (lupin)
  { keywords: ['volčji bob', 'lupin', 'lupine'], allergens: [13] },
  
  // Kava — brez alergenov (sam kofein)
  // Alkohol — pogosto sulfidi (12), posebej vino/penine
  { keywords: ['viski', 'whisky', 'gin', 'vodka', 'rum', 'cognac', 'konjak', 'brandy', 'slivovk', 'viljamovk', 'travaric', 'liker', 'liker', 'likér', 'aperol', 'martini', 'negroni', 'spritz', 'mojito', 'gin tonic'], allergens: [12] },
  
  // Čokolada — mleko (7), pogosto oreški (8), soja (6) lecitin
  { keywords: ['čokolad', 'chocolate', 'cocoa', 'kakav', 'cokolad', 'nutella', 'torta', 'sladica', 'dessert', 'brownie', 'mousse', 'truffle', 'praline'], allergens: [7, 8, 6] },
  
  // Burger — gluten (1), mleko (7) sir
  { keywords: ['burger', 'cheese', 'cheddar'], allergens: [1, 7] },
  
  // Sojina omaka — soja (6), gluten (1)
  { keywords: ['soy sauce', 'sojina omaka', 'asijsk', 'pad thai'], allergens: [6, 1] },
]

// Helper: določi alergene za artikel glede na ime, opis in kategorijo
function determineAllergens(name: string, description: string, categoryName: string): string {
  const text = `${name} ${description} ${categoryName}`.toLowerCase()
  const allergens = new Set<number>()
  
  for (const rule of ALLERGEN_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        for (const a of rule.allergens) {
          allergens.add(a)
        }
        break // ena beseda zadostuje za to pravilo
      }
    }
  }
  
  // Pretvori v string (urejeno po številki)
  return Array.from(allergens).sort((a, b) => a - b).join(',')
}

// EU alergeni imena (za prikaz)
export const EU_ALLERGENS: Record<number, string> = {
  1: 'Gluten',
  2: 'Raki',
  3: 'Jajca',
  4: 'Ribe',
  5: 'Arašidi',
  6: 'Soja',
  7: 'Mleko',
  8: 'Oreški',
  9: 'Zeler',
  10: 'Gorčica',
  11: 'Sezam',
  12: 'Sulfidi',
  13: 'Volčji bob',
  14: 'Mehkužci',
}

async function main() {
  console.log('🚀 Dodajam alergene k vsem artiklom...\n')
  
  const items = await prisma.menuItem.findMany({
    include: { category: true },
  })
  
  console.log(`📋 Najdeno ${items.length} artiklov\n`)
  
  let updated = 0
  let noAllergens = 0
  
  for (const item of items) {
    const allergens = determineAllergens(
      item.name,
      item.description || '',
      item.category?.name || '',
    )
    
    if (allergens) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { allergens },
      })
      updated++
      
      // Prikaži prvih 30
      if (updated <= 30) {
        const names = allergens.split(',').map(n => EU_ALLERGENS[parseInt(n)] || `?${n}`).join(', ')
        console.log(`  ✅ ${item.name.padEnd(35)} → ${names}`)
      }
    } else {
      noAllergens++
    }
  }
  
  console.log(`\n${'─'.repeat(55)}`)
  console.log(`✅ Alergeni dodani: ${updated} artiklov`)
  console.log(`⚪ Brez alergenov:  ${noAllergens} artiklov (kava, voda, itd.)`)
  console.log(`${'─'.repeat(55)}\n`)
  
  // Prikaži nekaj primerov brez alergenov
  const noAllergenItems = await prisma.menuItem.findMany({
    where: { allergens: '' },
    take: 10,
    select: { name: true },
  })
  if (noAllergenItems.length > 0) {
    console.log('📋 Brez alergenov (prvih 10):')
    for (const i of noAllergenItems) {
      console.log(`  ⚪ ${i.name}`)
    }
  }
  
  // Statistika po alergenih
  console.log('\n📊 Statistika po alergenih:')
  for (const [num, name] of Object.entries(EU_ALLERGENS)) {
    const count = await prisma.menuItem.count({
      where: { allergens: { contains: num } },
    })
    if (count > 0) {
      console.log(`  ${num.padStart(2)}. ${name.padEnd(15)} → ${count} artiklov`)
    }
  }
  
  console.log('\n✅ ZAKLJUČENO')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
