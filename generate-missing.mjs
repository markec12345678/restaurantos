import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const missing = JSON.parse(readFileSync('missing-images.json', 'utf-8'));
const CONCURRENT = 4;
let generated = 0;
let failed = 0;

for (let i = 0; i < missing.length; i += CONCURRENT) {
  const batch = missing.slice(i, i + CONCURRENT);
  console.log(`\n=== Batch ${Math.floor(i/CONCURRENT)+1}/${Math.ceil(missing.length/CONCURRENT)} ===`);
  
  const promises = batch.map(async (item) => {
    const outputPath = `public/menu-images/${item.file}`;
    const dir = outputPath.substring(0, outputPath.lastIndexOf('/'));
    
    try {
      console.log(`Generating: ${item.name} -> ${item.file}`);
      execSync(`z-ai-generate -p "${item.prompt}" -o "${outputPath}" -s 1024x1024`, {
        timeout: 60000,
        stdio: 'pipe'
      });
      console.log(`  ✅ OK: ${item.file}`);
      generated++;
    } catch (err) {
      console.log(`  ❌ FAILED: ${item.file} - ${err.message?.substring(0, 100)}`);
      failed++;
    }
  });
  
  await Promise.all(promises);
  
  // Small delay between batches
  if (i + CONCURRENT < missing.length) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Generated: ${generated}/${missing.length}`);
console.log(`Failed: ${failed}`);
