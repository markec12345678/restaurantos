// ============================================
// GET /api/images/lookup — Samodejno iskanje slik artiklov
// ============================================
// Query params:
//   ?name=beefsteak     → iskanje po imenu (TheMealDB + Pexels)
//   ?barcode=5449000... → iskanje po EAN kodi (Open Food Facts)
//
// Returns: { imageUrl, source, name }
// Sources: openfoodfacts, themealdb, thecocktaildb
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')?.trim()
    const barcode = searchParams.get('barcode')?.trim()

    if (!name && !barcode) {
      return NextResponse.json(
        { error: 'Podaj "name" ali "barcode" parameter' },
        { status: 400 }
      )
    }

    // ═══ 1. Open Food Facts (po EAN kodi) ═══
    if (barcode) {
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
          { signal: AbortSignal.timeout(8000) }
        )
        const data = await res.json()

        if (data.status === 1 && data.product?.image_url) {
          logger.info('IMAGE_LOOKUP', `Found image via OpenFoodFacts barcode: ${barcode}`)
          return NextResponse.json({
            imageUrl: data.product.image_url,
            source: 'openfoodfacts',
            name: data.product.product_name || name || '',
            barcode,
          })
        }
      } catch (err) {
        logger.warn('IMAGE_LOOKUP', `OpenFoodFacts barcode lookup failed:`, err)
      }
    }

    // ═══ 2. Open Food Facts (po imenu) ═══
    if (name) {
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&fields=product_name,image_url,brands&page_size=5`,
          { signal: AbortSignal.timeout(8000) }
        )
        const data = await res.json()
        const products = data.products || []

        for (const product of products) {
          if (product.image_url && product.product_name) {
            logger.info('IMAGE_LOOKUP', `Found image via OpenFoodFacts name: ${name}`)
            return NextResponse.json({
              imageUrl: product.image_url,
              source: 'openfoodfacts',
              name: product.product_name,
              brands: product.brands || '',
            })
          }
        }
      } catch (err) {
        logger.warn('IMAGE_LOOKUP', `OpenFoodFacts name lookup failed:`, err)
      }

      // ═══ 3. TheMealDB (za jedi) ═══
      try {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(8000) }
        )
        const data = await res.json()
        const meals = data.meals || []

        if (meals.length > 0 && meals[0].strMealThumb) {
          logger.info('IMAGE_LOOKUP', `Found image via TheMealDB: ${name}`)
          return NextResponse.json({
            imageUrl: meals[0].strMealThumb,
            source: 'themealdb',
            name: meals[0].strMeal,
          })
        }
      } catch (err) {
        logger.warn('IMAGE_LOOKUP', `TheMealDB lookup failed:`, err)
      }

      // ═══ 4. TheCocktailDB (za pijače) ═══
      try {
        const res = await fetch(
          `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`,
          { signal: AbortSignal.timeout(8000) }
        )
        const data = await res.json()
        const drinks = data.drinks || []

        if (drinks.length > 0 && drinks[0].strDrinkThumb) {
          logger.info('IMAGE_LOOKUP', `Found image via TheCocktailDB: ${name}`)
          return NextResponse.json({
            imageUrl: drinks[0].strDrinkThumb,
            source: 'thecocktaildb',
            name: drinks[0].strDrink,
          })
        }
      } catch (err) {
        logger.warn('IMAGE_LOOKUP', `TheCocktailDB lookup failed:`, err)
      }
    }

    // ═══ Ni najdeno ═══
    return NextResponse.json({
      imageUrl: null,
      source: null,
      name: name || '',
      message: 'Slika ni najdena. Poskusi z drugačnim imenom ali EAN kodo.',
    }, { status: 404 })

  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Napaka pri iskanju slike' },
      { status: 500 }
    )
  }
}
