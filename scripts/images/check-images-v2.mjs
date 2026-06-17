import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const data = JSON.parse(readFileSync('/home/z/my-project/all_items.json', 'utf8'));
const { menu, inventory } = data;

// Load previous results if any
let previousResults = [];
if (existsSync('/home/z/my-project/vlm-results-progress.json')) {
  previousResults = JSON.parse(readFileSync('/home/z/my-project/vlm-results-progress.json', 'utf8'));
}
const alreadyChecked = new Set(previousResults.map(r => r.name + r.image));

// Focus on items NOT yet checked - prioritize remaining categories
const allItems = [
  ...menu.map(s => ({ ...s, type: 'menu' })),
  ...inventory.map(s => ({ ...s, category: 'inventory', type: 'inventory' }))
];

const toCheck = allItems.filter(item => !alreadyChecked.has(item.name + item.image));
console.log(`Already checked: ${alreadyChecked.size}, Remaining: ${toCheck.length}`);

const results = [...previousResults];
let checked = 0;
const DELAY = 2500; // 2.5 second delay between requests

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

for (const item of toCheck) {
  const imagePath = `/home/z/my-project/restaurantos/public${item.image}`;
  
  try {
    const prompt = `You are verifying a restaurant menu image. Item: "${item.name}" (${item.category}). Does this image show what the name describes? Answer ONLY: MATCH or MISMATCH + brief reason.`;
    
    const result = execSync(
      `z-ai vision -p "${prompt.replace(/"/g, '\\"')}" -i "${imagePath}"`,
      { encoding: 'utf8', timeout: 45000 }
    ).trim();
    
    // Extract just the content from JSON response
    let verdict = result;
    try {
      const parsed = JSON.parse(result);
      if (parsed.choices?.[0]?.message?.content) {
        verdict = parsed.choices[0].message.content;
      }
    } catch(e) {
      // Not JSON, use raw text
    }
    
    const isMismatch = verdict.toUpperCase().includes('MISMATCH');
    
    const entry = {
      name: item.name,
      category: item.category,
      image: item.image,
      verdict: isMismatch ? 'MISMATCH' : 'MATCH',
      details: verdict.slice(0, 200)
    };
    
    results.push(entry);
    checked++;
    
    if (isMismatch) {
      console.log(`❌ MISMATCH: ${item.name} -> ${item.image}`);
      console.log(`   ${verdict.slice(0, 150)}`);
    } else {
      process.stdout.write(`✅ ${item.name} (${checked}/${toCheck.length})\n`);
    }
    
    // Save progress every 5 items
    if (checked % 5 === 0) {
      writeFileSync('/home/z/my-project/vlm-results-progress.json', JSON.stringify(results, null, 2));
    }
    
    await sleep(DELAY);
    
  } catch (err) {
    const errMsg = err.message.slice(0, 100);
    if (errMsg.includes('429')) {
      console.log(`⏳ Rate limited, waiting 10s...`);
      await sleep(10000);
      // Retry once
      try {
        const result = execSync(
          `z-ai vision -p "You are verifying a restaurant menu image. Item: '${item.name}' (${item.category}). Does this image show what the name describes? Answer ONLY: MATCH or MISMATCH + brief reason." -i "${imagePath}"`,
          { encoding: 'utf8', timeout: 45000 }
        ).trim();
        let verdict = result;
        try {
          const parsed = JSON.parse(result);
          if (parsed.choices?.[0]?.message?.content) verdict = parsed.choices[0].message.content;
        } catch(e) {}
        const isMismatch = verdict.toUpperCase().includes('MISMATCH');
        results.push({ name: item.name, category: item.category, image: item.image, verdict: isMismatch ? 'MISMATCH' : 'MATCH', details: verdict.slice(0, 200) });
        checked++;
        if (isMismatch) console.log(`❌ MISMATCH: ${item.name}`);
        else process.stdout.write(`✅ ${item.name} (${checked}/${toCheck.length})\n`);
      } catch (retryErr) {
        console.log(`⚠️ Retry failed for ${item.name}, skipping`);
        results.push({ name: item.name, category: item.category, image: item.image, verdict: 'SKIPPED', details: retryErr.message.slice(0, 100) });
        checked++;
      }
    } else {
      console.log(`⚠️ ERROR: ${item.name}: ${errMsg}`);
      results.push({ name: item.name, category: item.category, image: item.image, verdict: 'ERROR', details: errMsg });
      checked++;
    }
    await sleep(DELAY);
  }
}

// Final save
writeFileSync('/home/z/my-project/vlm-results-progress.json', JSON.stringify(results, null, 2));

// Summary
const matches = results.filter(r => r.verdict === 'MATCH').length;
const mismatches = results.filter(r => r.verdict === 'MISMATCH');
const errors = results.filter(r => r.verdict === 'ERROR' || r.verdict === 'SKIPPED').length;

console.log(`\n========== FINAL RESULTS ==========`);
console.log(`Total checked: ${results.length}`);
console.log(`Match: ${matches}`);
console.log(`Mismatch: ${mismatches.length}`);
console.log(`Errors/Skipped: ${errors}`);

if (mismatches.length > 0) {
  console.log(`\n========== ALL MISMATCHES ==========`);
  mismatches.forEach(m => {
    console.log(`❌ ${m.name} (${m.category}) -> ${m.image}`);
    console.log(`   ${m.details}`);
  });
}
