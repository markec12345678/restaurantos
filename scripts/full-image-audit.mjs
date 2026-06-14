#!/usr/bin/env node
/**
 * Full audit: Check ALL seed files for:
 * 1. Missing image files
 * 2. Same image path used for different menu items (duplicates by path)
 * 3. Same file content used under different filenames (duplicates by hash)
 * Also includes seed-food-norms route which adds additional menu items
 */
import { readFileSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { createHash } from 'crypto';

const PUBLIC_DIR = '/home/z/my-project/public';
const SEED_FILE = '/home/z/my-project/src/app/api/seed/route.ts';
const FOOD_NORMS_FILE = '/home/z/my-project/src/app/api/seed-food-norms/route.ts';

// 1. Extract image paths AND their menu item names from seed route
function extractImagePaths(content) {
  // Match patterns like: { name: 'Foo', ... image: '/menu-images/x.png' ... }
  // or image: '/menu-images/x.png'
  const results = [];
  const lines = content.split('\n');
  let currentName = '';
  for (const line of lines) {
    const nameMatch = line.match(/name:\s*'([^']+)'/);
    if (nameMatch) currentName = nameMatch[1];
    
    const imageMatch = line.match(/image:\s*'([^']+)'|'([^']+)'\s*\)/);
    if (imageMatch) {
      const imgPath = imageMatch[1] || imageMatch[2];
      if (imgPath && imgPath.startsWith('/menu-images/')) {
        results.push({ name: currentName, image: imgPath });
      }
    }
  }
  return results;
}

// Also extract from food norms - different format (createFood function)
function extractFoodNormsPaths(content) {
  const results = [];
  const lines = content.split('\n');
  let currentName = '';
  for (const line of lines) {
    // In createFood, the name is the first param
    const nameMatch = line.match(/createFood\(\s*'([^']+)'/);
    if (nameMatch) currentName = nameMatch[1];
    
    const imageMatch = line.match(/'\/menu-images\/[^']+'/);
    if (imageMatch) {
      const imgPath = imageMatch[0].replace(/'/g, '');
      results.push({ name: currentName, image: imgPath });
    }
  }
  return results;
}

const seedContent = readFileSync(SEED_FILE, 'utf-8');
const foodNormsContent = readFileSync(FOOD_NORMS_FILE, 'utf-8');

const seedItems = extractImagePaths(seedContent);
const foodNormItems = extractFoodNormsPaths(foodNormsContent);

console.log(`\n=== FULL AUDIT: All Seed Image Paths ===\n`);
console.log(`Seed route items with images: ${seedItems.length}`);
console.log(`Food norms items with images: ${foodNormItems.length}`);

// Combine all
const allItems = [...seedItems, ...foodNormItems];
console.log(`Total: ${allItems.length}`);

// 2. Find duplicate image PATHS (same image used for different items)
const imageToItems = new Map();
for (const item of allItems) {
  if (!imageToItems.has(item.image)) {
    imageToItems.set(item.image, []);
  }
  imageToItems.get(item.image).push(item.name);
}

const duplicatePaths = [];
for (const [image, names] of imageToItems) {
  if (names.length > 1) {
    duplicatePaths.push({ image, names });
  }
}

console.log(`\nUnique image paths: ${imageToItems.size}`);
console.log(`Image paths used by multiple items: ${duplicatePaths.length}`);

if (duplicatePaths.length > 0) {
  console.log(`\n--- DUPLICATE IMAGE PATHS (same image for different items) ---`);
  for (const dup of duplicatePaths) {
    console.log(`\n  🖼️  ${dup.image} (${dup.names.length} items):`);
    dup.names.forEach(n => console.log(`    - ${n}`));
  }
}

// 3. Check missing files
const allPaths = [...new Set(allItems.map(i => i.image))];
const missing = [];
for (const imgPath of allPaths) {
  const fullPath = join(PUBLIC_DIR, imgPath);
  try {
    statSync(fullPath);
  } catch {
    missing.push(imgPath);
  }
}

console.log(`\n--- MISSING IMAGE FILES ---`);
if (missing.length > 0) {
  missing.forEach(p => console.log(`  ❌ ${p}`));
} else {
  console.log(`  ✅ All image files exist!`);
}

// 4. Check for duplicate file content (same hash, different filename)
const hashMap = new Map();
function scanDir(dir, prefix = '') {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (entry.isFile() && ['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(extname(entry.name).toLowerCase())) {
        const content = readFileSync(fullPath);
        const hash = createHash('md5').update(content).digest('hex');
        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }
        hashMap.get(hash).push(`/menu-images/${relPath}`);
      }
    }
  } catch(e) {}
}

scanDir(join(PUBLIC_DIR, 'menu-images'));

const duplicateFiles = [];
for (const [hash, files] of hashMap) {
  if (files.length > 1) {
    duplicateFiles.push({ hash: hash.substring(0, 8), files });
  }
}

console.log(`\n--- DUPLICATE FILE CONTENT (same bytes, different names) ---`);
if (duplicateFiles.length > 0) {
  for (const group of duplicateFiles) {
    console.log(`  Hash ${group.hash}: ${group.files.length} identical files`);
    group.files.forEach(f => console.log(`    📄 ${f}`));
  }
} else {
  console.log(`  ✅ No duplicate file content found!`);
}

// 5. Items from seed-food-norms that share image paths with other items
const seedNormsDupes = [];
for (const item of foodNormItems) {
  const otherUsers = imageToItems.get(item.image);
  if (otherUsers && otherUsers.length > 1) {
    seedNormsDupes.push(item);
  }
}

console.log(`\n--- FOOD NORMS ITEMS SHARING IMAGES ---`);
console.log(`Items in seed-food-norms sharing an image: ${seedNormsDupes.length}`);

// Summary
console.log(`\n=== SUMMARY ===`);
console.log(`Total menu items with images: ${allItems.length}`);
console.log(`Unique image paths: ${imageToItems.size}`);
console.log(`Image paths reused by multiple items: ${duplicatePaths.length}`);
console.log(`Missing image files: ${missing.length}`);
console.log(`Duplicate file content groups: ${duplicateFiles.length}`);

const results = {
  totalItems: allItems.length,
  uniqueImagePaths: imageToItems.size,
  duplicatePaths: duplicatePaths,
  missingFiles: missing,
  duplicateFileContent: duplicateFiles,
};

writeFileSync('/home/z/my-project/download/full-image-audit.json', JSON.stringify(results, null, 2));
console.log(`\nResults saved to /home/z/my-project/download/full-image-audit.json`);

function writeFileSync(path, data) {
  import('fs').then(fs => fs.writeFileSync(path, data));
}
