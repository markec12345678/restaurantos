/**
 * Category Consolidation Script for RestaurantOS
 * 
 * HRANA: 23 → ~12 categories
 * PIJAČA: 21 → ~8 categories
 * 
 * Strategy: For each merge group, pick a "target" category, move all menuItems
 * from "source" categories into it, then delete the empty source categories.
 * Finally, update target names/icons/colors and re-sort.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ─── MERGE PLAN ───────────────────────────────────────────────────────────────

const MERGE_PLAN = {
  hrana: [
    {
      name: "Predjedi",
      icon: "🥗",
      color: "#10b981",
      targetName: "Hladne predjedi",  // We'll use this ID but rename
      // Actually let's use "Predjedi" as target since it has more items
      targetNameExact: "Predjedi",
      sources: ["Hladne predjedi"],
    },
    {
      name: "Testenine in njoki",
      icon: "🍝",
      color: "#ef4444",
      targetNameExact: "Testenine, njoki",
      sources: ["Testenine"],
    },
    {
      name: "Ribje jedi in kalamari",
      icon: "🐟",
      color: "#0ea5e9",
      targetNameExact: "Ribje jedi",
      sources: ["Kalamari"],
    },
    {
      name: "Pizze",
      icon: "🍕",
      color: "#e11d48",
      targetNameExact: "Pizze",
      sources: ["Pice"],
    },
    {
      name: "Otroške jedi",
      icon: "🧒",
      color: "#a78bfa",
      targetNameExact: "Otroške jedi",
      sources: ["Otroški meni"],
    },
    {
      name: "Priloge in omake",
      icon: "🍟",
      color: "#84cc16",
      targetNameExact: "Priloge",
      sources: ["Omake"],
    },
  ],
  pijaca: [
    {
      name: "Vina",
      icon: "🍷",
      color: "#7c2d12",
      targetNameExact: "Bela Vina",
      sources: ["Penine in Šampanjci", "Rosé Vino", "Rdeča Vina", "Tuja Vina", "Likersko Vino"],
    },
    {
      name: "Pivo",
      icon: "🍺",
      color: "#d97706",
      targetNameExact: "Točeno Pivo",
      sources: ["Pivo", "Craft Piva", "Brezalkoholno Pivo"],
    },
    {
      name: "Žgane pijače",
      icon: "🥃",
      color: "#6b21a8",
      targetNameExact: "Destilati, Konjak in Rum",
      sources: ["Viski", "Gin", "Likerji", "Grenčice"],
    },
    {
      name: "Osvežilne pijače",
      icon: "🥤",
      color: "#0ea5e9",
      targetNameExact: "Gazirane Pijače",
      sources: ["Vode", "Naravni Sokovi", "Sokovi"],
    },
  ],
};

// Categories that stay unchanged (just need sortOrder updates)
const HRANA_KEEP = [
  { name: "Tople predjedi", icon: "🍲", color: "#f97316" },
  { name: "Juhe", icon: "🥣", color: "#a78bfa" },
  { name: "Glavne jedi", icon: "🥩", color: "#ef4444" },
  { name: "Rižote", icon: "🍚", color: "#a3e635" },
  { name: "Jedi z žara", icon: "🔥", color: "#ea580c" },
  { name: "Solate", icon: "🥬", color: "#22c55e" },
  { name: "Burgerji", icon: "🍔", color: "#ec4899" },
  { name: "Vegetarijanske jedi", icon: "🥦", color: "#14b8a6" },
  { name: "Palačinke", icon: "🥞", color: "#f59e0b" },
  { name: "Sladice", icon: "🍰", color: "#06b6d4" },
  { name: "Malice", icon: "📋", color: "#059669" },
];

const PIJACA_KEEP = [
  { name: "Topli Napitki", icon: "☕", color: "#92400e" },
  { name: "Mešane Pijače", icon: "🍹", color: "#ec4899" },
];

// Final sort orders for the consolidated categories
const HRANA_FINAL_ORDER = [
  "Predjedi",
  "Tople predjedi",
  "Juhe",
  "Testenine in njoki",
  "Glavne jedi",
  "Rižote",
  "Jedi z žara",
  "Ribje jedi in kalamari",
  "Solate",
  "Pizze",
  "Burgerji",
  "Vegetarijanske jedi",
  "Palačinke",
  "Otroške jedi",
  "Sladice",
  "Malice",
  "Priloge in omake",
];

const PIJACA_FINAL_ORDER = [
  "Vina",
  "Pivo",
  "Žgane pijače",
  "Topli Napitki",
  "Mešane Pijače",
  "Osvežilne pijače",
];

async function main() {
  console.log("🔄 Starting category consolidation...\n");

  // ─── Step 0: Get all categories with IDs ─────────────────────────────────
  const allCategories = await prisma.category.findMany({
    include: { menu: true, _count: { select: { menuItems: true } } }
  });

  const catMap = new Map();
  for (const cat of allCategories) {
    catMap.set(cat.name, cat);
  }

  const hranaMenuId = allCategories.find(c => c.menu.name === "Hrana")?.menuId;
  const pijacaMenuId = allCategories.find(c => c.menu.name === "Pijača")?.menuId;

  console.log(`📋 Hrana menu ID: ${hranaMenuId}`);
  console.log(`📋 Pijača menu ID: ${pijacaMenuId}`);

  // ─── Step 1: Process all merges ──────────────────────────────────────────
  const allMerges = [
    ...MERGE_PLAN.hrana.map(m => ({ ...m, menuName: "Hrana" })),
    ...MERGE_PLAN.pijaca.map(m => ({ ...m, menuName: "Pijača" })),
  ];

  let totalItemsMoved = 0;
  let totalCategoriesDeleted = 0;

  for (const merge of allMerges) {
    const targetCat = catMap.get(merge.targetNameExact);
    if (!targetCat) {
      console.error(`❌ Target category "${merge.targetNameExact}" not found!`);
      continue;
    }

    console.log(`\n🔀 Merging into "${merge.name}" (was "${merge.targetNameExact}", ${targetCat._count.menuItems} items)`);

    for (const sourceName of merge.sources) {
      const sourceCat = catMap.get(sourceName);
      if (!sourceCat) {
        console.error(`  ⚠️  Source category "${sourceName}" not found, skipping`);
        continue;
      }

      // Count items to move
      const itemsInSource = await prisma.menuItem.count({
        where: { categoryId: sourceCat.id }
      });

      if (itemsInSource > 0) {
        // Move all menuItems from source to target
        const result = await prisma.menuItem.updateMany({
          where: { categoryId: sourceCat.id },
          data: { categoryId: targetCat.id }
        });
        console.log(`  ✅ Moved ${result.count} items from "${sourceName}" → "${merge.name}"`);
        totalItemsMoved += result.count;
      } else {
        console.log(`  ℹ️  No items in "${sourceName}" to move`);
      }
    }

    // Rename and update icon/color of target category
    await prisma.category.update({
      where: { id: targetCat.id },
      data: {
        name: merge.name,
        icon: merge.icon,
        color: merge.color,
      }
    });
    console.log(`  🏷️  Renamed "${merge.targetNameExact}" → "${merge.name}" with icon ${merge.icon}`);

    // Now delete the empty source categories
    for (const sourceName of merge.sources) {
      const sourceCat = catMap.get(sourceName);
      if (!sourceCat) continue;

      // Verify no items remain
      const remaining = await prisma.menuItem.count({
        where: { categoryId: sourceCat.id }
      });

      if (remaining > 0) {
        console.error(`  ⛔ Cannot delete "${sourceName}" — still has ${remaining} items!`);
        continue;
      }

      await prisma.category.delete({
        where: { id: sourceCat.id }
      });
      console.log(`  🗑️  Deleted empty category "${sourceName}"`);
      totalCategoriesDeleted++;
    }
  }

  // ─── Step 2: Update sort orders ──────────────────────────────────────────
  console.log("\n📐 Updating sort orders...\n");

  // Build a map of current category names (post-merge) to their IDs
  const updatedCategories = await prisma.category.findMany({
    include: { menu: true }
  });

  // Hrana sort order
  for (let i = 0; i < HRANA_FINAL_ORDER.length; i++) {
    const cat = updatedCategories.find(c => c.name === HRANA_FINAL_ORDER[i] && c.menu.name === "Hrana");
    if (cat) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { sortOrder: i }
      });
      console.log(`  Hrana: "${cat.name}" → sortOrder ${i}`);
    } else {
      console.warn(`  ⚠️  Hrana category "${HRANA_FINAL_ORDER[i]}" not found for sort!`);
    }
  }

  // Pijača sort order
  for (let i = 0; i < PIJACA_FINAL_ORDER.length; i++) {
    const cat = updatedCategories.find(c => c.name === PIJACA_FINAL_ORDER[i] && c.menu.name === "Pijača");
    if (cat) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { sortOrder: i }
      });
      console.log(`  Pijača: "${cat.name}" → sortOrder ${i}`);
    } else {
      console.warn(`  ⚠️  Pijača category "${PIJACA_FINAL_ORDER[i]}" not found for sort!`);
    }
  }

  // ─── Step 3: Verify results ──────────────────────────────────────────────
  console.log("\n✅ Consolidation complete!");
  console.log(`   Items moved: ${totalItemsMoved}`);
  console.log(`   Categories deleted: ${totalCategoriesDeleted}`);

  const finalMenus = await prisma.menu.findMany({
    include: {
      categories: {
        include: {
          _count: { select: { menuItems: true } }
        },
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  for (const menu of finalMenus) {
    console.log(`\n=== ${menu.name} (${menu.categories.length} categories) ===`);
    for (const cat of menu.categories) {
      console.log(`  ${cat.sortOrder} | ${cat.icon} ${cat.name} | ${cat._count.menuItems} items`);
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Script failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
