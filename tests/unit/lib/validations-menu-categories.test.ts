import { describe, it, expect } from 'vitest'
import { updateCategorySchema } from '@/lib/validations/menu'

// ============================================
// RUNDA 66: updateCategorySchema — PUT /api/categories/[id] validacija
// ============================================

describe('updateCategorySchema', () => {
  it('sprejme posamezna polja (partial — vsako neodvisno)', () => {
    expect(updateCategorySchema.safeParse({ name: 'Piščančje zadeve' }).success).toBe(true)
    expect(updateCategorySchema.safeParse({ icon: '🍗' }).success).toBe(true)
    expect(updateCategorySchema.safeParse({ color: '#ff5722' }).success).toBe(true)
    expect(updateCategorySchema.safeParse({ sortOrder: 3 }).success).toBe(true)
    expect(updateCategorySchema.safeParse({ menuId: 'cuid-abc' }).success).toBe(true)
  })

  it('sprejme kombinacijo in prazen objekt (brez sprememb je veljaven PUT)', () => {
    const full = updateCategorySchema.safeParse({
      name: 'Nova', icon: '🍕', color: '#123abc', sortOrder: 0, menuId: 'm1',
    })
    expect(full.success).toBe(true)
    expect(updateCategorySchema.safeParse({}).success).toBe(true)
  })

  it('zavrne napačen hex format barve (konsistentno z createMenuSchema)', () => {
    expect(updateCategorySchema.safeParse({ color: 'orange' }).success).toBe(false)
    expect(updateCategorySchema.safeParse({ color: '#12345' }).success).toBe(false)
    expect(updateCategorySchema.safeParse({ color: '#12345g' }).success).toBe(false)
  })

  it('zavrne prazno ime in prazen menuId', () => {
    expect(updateCategorySchema.safeParse({ name: '' }).success).toBe(false)
    expect(updateCategorySchema.safeParse({ menuId: '' }).success).toBe(false)
  })

  it('zavrne negativno / ne-celo sortOrder (meje 0–9999)', () => {
    expect(updateCategorySchema.safeParse({ sortOrder: -1 }).success).toBe(false)
    expect(updateCategorySchema.safeParse({ sortOrder: 1.5 }).success).toBe(false)
    expect(updateCategorySchema.safeParse({ sortOrder: 10000 }).success).toBe(false)
  })

  it('ne dovoli dodatnih / napadalnih polj (implicit strip ali fail — brez crasha)', () => {
    const parsed = updateCategorySchema.safeParse({ name: 'OK', hacker: 'x' })
    // zod privzeto odstrani neznana ključa — podatki ne pridejo v DB updateData
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('hacker')
    }
  })
})
