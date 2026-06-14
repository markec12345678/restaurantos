import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BASE = '/home/z/my-project/public/menu-images';

async function convertSvgsToPng() {
  const svgFiles = [];
  
  function findSvgFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSvgFiles(fullPath);
      } else if (entry.name.endsWith('.png')) {
        // Check if it's actually an SVG
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.trim().startsWith('<svg')) {
          svgFiles.push(fullPath);
        }
      }
    }
  }
  
  findSvgFiles(BASE);
  console.log(`Found ${svgFiles.length} SVG files to convert to PNG`);
  
  let success = 0;
  let failed = 0;
  
  for (const filePath of svgFiles) {
    try {
      const svgContent = fs.readFileSync(filePath, 'utf8');
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(1024, 1024)
        .png()
        .toBuffer();
      
      fs.writeFileSync(filePath, pngBuffer);
      console.log(`OK: ${path.relative(BASE, filePath)}`);
      success++;
    } catch (error) {
      console.error(`FAILED: ${path.relative(BASE, filePath)} - ${error.message}`);
      failed++;
    }
  }
  
  console.log('');
  console.log(`=== Conversion Complete ===`);
  console.log(`Success: ${success}, Failed: ${failed}, Total: ${svgFiles.length}`);
}

convertSvgsToPng().catch(console.error);
