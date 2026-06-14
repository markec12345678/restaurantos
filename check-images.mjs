import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const data = JSON.parse(readFileSync('/home/z/my-project/all_items.json', 'utf8'));
const { menu, inventory } = data;

// Pick strategic samples: 2-3 from each category
const byCategory = {};
menu.forEach(i => {
  if (!byCategory[i.category]) byCategory[i.category] = [];
  byCategory[i.category].push(i);
});

const samples = [];
for (const [cat, items] of Object.entries(byCategory)) {
  // First item, middle item, last item
  if (items.length >= 3) {
    samples.push(items[0]);
    samples.push(items[Math.floor(items.length / 2)]);
    samples.push(items[items.length - 1]);
  } else {
    samples.push(...items);
  }
}

// Add all inventory items
const allChecks = [
  ...samples.map(s => ({ ...s, type: 'menu' })),
  ...inventory.map(s => ({ ...s, type: 'inventory' }))
];

console.log(`Will check ${allChecks.length} images...`);

const results = [];
let checked = 0;

for (const item of allChecks) {
  const imagePath = `/home/z/my-project/restaurantos/public${item.image}`;
  
  try {
    const prompt = `You are a food/drink image verifier for a restaurant menu app. The item name is "${item.name}" (category: ${item.category || item.type}). Does this image ACTUALLY show what the name describes? Answer ONLY with: MATCH or MISMATCH, followed by a brief reason. For example: "MATCH - shows spaghetti with tomato sauce" or "MISMATCH - shows a fish dish instead of pasta". Be strict: if the item is "Špageti" the image MUST show spaghetti pasta. If it's "Coca-Cola" it MUST show a Coca-Cola drink. If it's "Margerita" pizza it MUST show a margherita pizza.`;
    
    const result = execSync(
      `z-ai vision -p "${prompt.replace(/"/g, '\\"')}" -i "${imagePath}"`,
      { encoding: 'utf8', timeout: 30000 }
    ).trim();
    
    checked++;
    const isMismatch = result.toUpperCase().includes('MISMATCH');
    
    results.push({
      name: item.name,
      category: item.category || item.type,
      image: item.image,
      verdict: isMismatch ? 'MISMATCH' : 'MATCH',
      details: result
    });
    
    if (isMismatch) {
      console.log(`❌ MISMATCH: ${item.name} -> ${item.image}`);
      console.log(`   ${result}`);
    } else {
      console.log(`✅ MATCH: ${item.name} (${checked}/${allChecks.length})`);
    }
    
  } catch (err) {
    console.log(`⚠️ ERROR checking ${item.name}: ${err.message.slice(0, 100)}`);
    results.push({
      name: item.name,
      category: item.category || item.type,
      image: item.image,
      verdict: 'ERROR',
      details: err.message.slice(0, 200)
    });
  }
}

// Summary
const matches = results.filter(r => r.verdict === 'MATCH').length;
const mismatches = results.filter(r => r.verdict === 'MISMATCH');
const errors = results.filter(r => r.verdict === 'ERROR').length;

console.log(`\n========== RESULTS ==========`);
console.log(`Checked: ${results.length}`);
console.log(`Match: ${matches}`);
console.log(`Mismatch: ${mismatches.length}`);
console.log(`Errors: ${errors}`);

if (mismatches.length > 0) {
  console.log(`\n========== MISMATCHES ==========`);
  mismatches.forEach(m => {
    console.log(`${m.name} (${m.category}) -> ${m.image}`);
    console.log(`  ${m.details}`);
  });
}

// Save results
writeFileSync('/home/z/my-project/vlm-check-results.json', JSON.stringify(results, null, 2));
console.log('\nResults saved to vlm-check-results.json');
