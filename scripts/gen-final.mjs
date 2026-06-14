import { PrismaClient } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.menuItem.findMany({ 
    select: { id: true, name: true, image: true, category: { select: { name: true } } } 
  });
  
  const missing = items.filter(i => i.image && !fs.existsSync('/home/z/my-project/public' + i.image));
  console.log(`Missing images: ${missing.length} / ${items.length}`);
  
  const zai = await ZAI.create();
  let generated = 0, failed = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    const fullPath = '/home/z/my-project/public' + item.image;
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(fullPath)) { generated++; continue; }
    
    // Create prompt based on name and category
    const catName = item.category.name;
    let prompt = `Professional commercial photography of ${item.name}`;
    if (catName.includes('Pivo') || catName.includes('pivo')) prompt += ' beer glass or bottle';
    else if (catName.includes('Vina') || catName.includes('vino')) prompt += ' wine bottle or glass';
    else if (catName.includes('Viski') || catName.includes('Gin') || catName.includes('Destilat')) prompt += ' spirit bottle with glass';
    else if (catName.includes('Napitki')) prompt += ' hot beverage in cup';
    else if (catName.includes('Pijač')) prompt += ' cocktail or drink';
    else if (catName.includes('Vode')) prompt += ' water bottle';
    else if (catName.includes('Sok')) prompt += ' juice in glass';
    else if (catName.includes('Gazirane')) prompt += ' soda can or bottle';
    else if (catName.includes('Likerj')) prompt += ' liqueur bottle';
    else if (catName.includes('Grenč')) prompt += ' bitter liqueur';
    else prompt += ' food dish on plate';
    prompt += ', studio lighting, high quality commercial photography';
    
    try {
      const response = await zai.images.generations.create({
        prompt: prompt.substring(0, 500),
        size: '864x1152'
      });
      
      const base64 = response.data[0].base64;
      fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
      generated++;
      console.log(`[${i+1}/${missing.length}] OK: ${item.name}`);
      
      // Update DB
      await prisma.menuItem.update({ where: { id: item.id }, data: { image: item.image } });
    } catch (err) {
      failed++;
      console.log(`[${i+1}/${missing.length}] FAIL: ${item.name} - ${err.message?.substring(0, 80)}`);
      
      if (err.message?.includes('429')) {
        console.log('Rate limited, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
    
    // Pause between requests
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log(`\nDONE: ${generated} generated, ${failed} failed`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
