#!/usr/bin/env node
/**
 * Audit script: Cross-reference image paths from seed route with actual files
 * and check for duplicate file content (same bytes = duplicate image)
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { createHash } from 'crypto';

const PUBLIC_DIR = '/home/z/my-project/public';
const SEED_FILE = '/home/z/my-project/src/app/api/seed/route.ts';

// 1. Extract all image paths from seed file
const seedContent = readFileSync(SEED_FILE, 'utf-8');
const imageRegex = /image:\s*'([^']+)'/g;
const imagePaths = [];
let match;
while ((match = imageRegex.exec(seedContent)) !== null) {
  imagePaths.push(match[1]);
}

console.log(`\n=== AUDIT: Menu Images ===\n`);
console.log(`Total image paths in seed route: ${imagePaths.length}`);

// 2. Check which files exist and which are missing
const missing = [];
const existing = [];
for (const imgPath of imagePaths) {
  const fullPath = join(PUBLIC_DIR, imgPath);
  try {
    statSync(fullPath);
    existing.push(imgPath);
  } catch {
    missing.push(imgPath);
  }
}

console.log(`Existing images: ${existing.length}`);
console.log(`Missing images: ${missing.length}`);

if (missing.length > 0) {
  console.log(`\n--- MISSING IMAGES ---`);
  missing.forEach(p => console.log(`  ❌ ${p}`));
}

// 3. Check for duplicate files (same content hash)
const hashMap = new Map(); // hash -> [filepath, ...]
const duplicateGroups = [];

function scanDir(dir, prefix = '') {
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
}

const menuImagesDir = join(PUBLIC_DIR, 'menu-images');
scanDir(menuImagesDir);

// Check for groups with more than one file
let duplicateCount = 0;
for (const [hash, files] of hashMap) {
  if (files.length > 1) {
    duplicateGroups.push({ hash: hash.substring(0, 8), files });
    duplicateCount += files.length - 1;
  }
}

console.log(`\nTotal unique image files in public/menu-images/: ${hashMap.size}`);
console.log(`Duplicate file groups: ${duplicateGroups.length}`);
console.log(`Extra duplicate files: ${duplicateCount}`);

if (duplicateGroups.length > 0) {
  console.log(`\n--- DUPLICATE IMAGE GROUPS ---`);
  for (const group of duplicateGroups) {
    console.log(`\n  Hash: ${group.hash} (${group.files.length} files with same content):`);
    group.files.forEach(f => console.log(`    📄 ${f}`));
  }
}

// 4. Cross-reference: are any seed image paths pointing to duplicate files?
const seedExistingSet = new Set(existing);
const seedDuplicates = [];
for (const group of duplicateGroups) {
  const seedFilesInGroup = group.files.filter(f => seedExistingSet.has(f));
  if (seedFilesInGroup.length > 1) {
    seedDuplicates.push(seedFilesInGroup);
  }
}

console.log(`\n--- SEED PATHS POINTING TO DUPLICATE CONTENT ---`);
if (seedDuplicates.length > 0) {
  for (const group of seedDuplicates) {
    console.log(`  ⚠️ These seed items share the same image file:`);
    group.forEach(f => console.log(`    ${f}`));
  }
} else {
  console.log(`  ✅ No seed paths point to duplicate content!`);
}

// 5. Summary
console.log(`\n=== SUMMARY ===`);
console.log(`Seed image references: ${imagePaths.length}`);
console.log(`Missing images: ${missing.length}`);
console.log(`Duplicate file groups: ${duplicateGroups.length}`);
console.log(`Seed paths with duplicate content: ${seedDuplicates.length}`);

// Write results to a JSON file for easy processing
const results = {
  totalSeedImages: imagePaths.length,
  existingCount: existing.length,
  missingCount: missing.length,
  missing: missing,
  duplicateGroups: duplicateGroups,
  seedDuplicates: seedDuplicates,
};

import { writeFileSync } from 'fs';
writeFileSync('/home/z/my-project/download/image-audit-results.json', JSON.stringify(results, null, 2));
console.log(`\nResults saved to /home/z/my-project/download/image-audit-results.json`);
