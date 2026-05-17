import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// Calculate food cost for all menu items or a specific one
export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za food cost analizo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const menuItemId = searchParams.get('menuItemId')
    const category = searchParams.get('category')

    // Get all menu items with their recipes and inventory
    const where: Record<string, unknown> = { isAvailable: true }
    if (menuItemId) where.id = menuItemId
    if (category) {
      where.category = { name: { contains: category } }
    }

    const menuItems = await db.menuItem.findMany({
      where,
      include: {
        category: true,
        recipeItems: {
          include: {
            inventoryItem: true,
          },
        },
        salesCategory: true,
      },
      orderBy: { name: 'asc' },
    })

    const foodCostAnalysis = menuItems.map(item => {
      // Calculate total ingredient cost
      let totalIngredientCost = 0
      const ingredientDetails = item.recipeItems.map(ri => {
        const cost = ri.quantityPerServing * (ri.inventoryItem?.costPerServing || 0)
        totalIngredientCost += cost
        return {
          name: ri.inventoryItem?.name || 'Neznano',
          quantity: ri.quantityPerServing,
          unit: ri.unit,
          costPerUnit: ri.inventoryItem?.costPerServing || 0,
          totalCost: cost,
          stockLevel: ri.inventoryItem?.quantity || 0,
          stockUnit: ri.inventoryItem?.unit || '',
        }
      })

      // Calculate margins
      const sellingPrice = item.price
      const sellingPriceWithVat = item.price * (1 + item.vatRate / 100)
      const foodCostPercent = sellingPriceWithVat > 0 ? (totalIngredientCost / sellingPriceWithVat) * 100 : 0
      const grossProfit = sellingPriceWithVat - totalIngredientCost
      const grossMarginPercent = sellingPriceWithVat > 0 ? (grossProfit / sellingPriceWithVat) * 100 : 0

      // Menu engineering classification
      let classification = 'Dog'
      if (foodCostPercent <= 30 && grossProfit >= 5) {
        classification = 'Star'
      } else if (foodCostPercent <= 35) {
        classification = 'Plowhorse'
      } else if (foodCostPercent > 35 && grossProfit >= 3) {
        classification = 'Puzzle'
      }

      // Suggest optimal price based on target food cost %
      const targetFoodCostPercent = 28
      const suggestedPrice = totalIngredientCost > 0
        ? (totalIngredientCost / (targetFoodCostPercent / 100)) / (1 + item.vatRate / 100)
        : item.price

      return {
        id: item.id,
        name: item.name,
        category: item.category?.name || '',
        salesCategory: item.salesCategory?.name || '',
        sellingPriceExVat: item.price,
        vatRate: item.vatRate,
        sellingPriceInclVat: sellingPriceWithVat,
        totalIngredientCost: Math.round(totalIngredientCost * 100) / 100,
        foodCostPercent: Math.round(foodCostPercent * 10) / 10,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
        classification,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        priceDifference: Math.round((suggestedPrice - item.price) * 100) / 100,
        ingredients: ingredientDetails,
        hasRecipe: item.recipeItems.length > 0,
        allergens: item.allergens,
      }
    })

    // Summary statistics
    const withRecipes = foodCostAnalysis.filter(i => i.hasRecipe)
    const avgFoodCost = withRecipes.length > 0
      ? withRecipes.reduce((sum, i) => sum + i.foodCostPercent, 0) / withRecipes.length
      : 0
    const avgGrossMargin = withRecipes.length > 0
      ? withRecipes.reduce((sum, i) => sum + i.grossMarginPercent, 0) / withRecipes.length
      : 0

    const stars = foodCostAnalysis.filter(i => i.classification === 'Star')
    const plowhorses = foodCostAnalysis.filter(i => i.classification === 'Plowhorse')
    const puzzles = foodCostAnalysis.filter(i => i.classification === 'Puzzle')
    const dogs = foodCostAnalysis.filter(i => i.classification === 'Dog')

    return NextResponse.json({
      items: foodCostAnalysis,
      summary: {
        totalItems: foodCostAnalysis.length,
        itemsWithRecipes: withRecipes.length,
        itemsWithoutRecipes: foodCostAnalysis.length - withRecipes.length,
        avgFoodCost: Math.round(avgFoodCost * 10) / 10,
        avgGrossMargin: Math.round(avgGrossMargin * 10) / 10,
        stars: stars.length,
        plowhorses: plowhorses.length,
        puzzles: puzzles.length,
        dogs: dogs.length,
        itemsOverTarget: withRecipes.filter(i => i.foodCostPercent > 30).length,
      },
    })
  } catch (error) {
    console.error('Napaka pri food cost analizi:', error)
    return NextResponse.json({ error: 'Napaka pri food cost analizi' }, { status: 500 })
  }
}
