// ============================================
// NESTED VALIDATION TESTS — modifiersJson Zod validacija
// ============================================
// Preverja da OrderItem.modifiersJson vsebina je pravilno validirana:
//   - Preprečuje neveljavne tipe (string name, number price)
//   - Preprečuje DoS (ogromen modifiersJson)
//   - Preprečuje injection (nepoznana polja z .strict())
//   - Dovoljuje valid modifiers (backward compat)
// ============================================
import { describe, it, expect } from 'vitest'
import { createOrderItemSchema, createOrderSchema } from '@/lib/validations/orders'

describe('P3 fix: Nested validacija modifiersJson', () => {
  describe('createOrderItemSchema — valid inputi', () => {
    it('sprejme prazen modifiersJson (default)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 2,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modifiersJson).toBe('[]')
      }
    })

    it('sprejme veljaven modifier z name + price', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Sir', price: 1.50 }]),
      })
      expect(result.success).toBe(true)
    })

    it('sprejne modifier z quantity in modifierGroupId', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{
          name: 'Ekstra sir',
          price: 2.00,
          quantity: 2,
          modifierGroupId: 'group-1',
        }]),
      })
      expect(result.success).toBe(true)
    })

    it('sprejme več modifierjev v array-u', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([
          { name: 'Sir', price: 1.50 },
          { name: 'Slanina', price: 2.00, quantity: 2 },
          { name: 'Gobe', price: 1.00, modifierGroupId: 'g-1' },
        ]),
      })
      expect(result.success).toBe(true)
    })

    it('sprejme negativno ceno (popust na modifierju)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Popust', price: -1.50 }]),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('createOrderItemSchema — invalid inputi', () => {
    it('zavrne neveljaven JSON', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: 'not-json{',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('veljaven JSON')
      }
    })

    it('zavrne modifier brez name', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ price: 1.50 }]),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        // Sporočilo je "Neveljaven modifier: Required" ali "Ime modifierja je obvezno"
        // odvisno od Zod verzije — preverimo da issue obstaja
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('zavrne modifier brez price', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Sir' }]),
      })
      expect(result.success).toBe(false)
    })

    it('zavrne price preko 10.000 (DoS preprečitev)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Drago', price: 99999 }]),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('10.000'))).toBe(true)
      }
    })

    it('zavrne price pod -1000 (finančna anomalija)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Popust', price: -5000 }]),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('-1000'))).toBe(true)
      }
    })

    it('zavrne nepoznano polje (strict mode — prepreči injection)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{
          name: 'Sir',
          price: 1.50,
          maliciousField: '<script>alert("xss")</script>',
        }]),
      })
      expect(result.success).toBe(false)
    })

    it('zavrne name daljši od 100 znakov (DoS)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{
          name: 'A'.repeat(101),
          price: 1.50,
        }]),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('100 znakov'))).toBe(true)
      }
    })

    it('zavrne modifiersJson daljši od 10.000 znakov (DoS)', () => {
      const hugeModifiers = JSON.stringify(
        Array.from({ length: 1000 }, (_, i) => ({ name: `Modifier ${i}`, price: 1 }))
      )
      // Padding da preseže 10.000 znakov
      const huge = hugeModifiers + ' '.repeat(10000)
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: huge,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('10.000 znakov'))).toBe(true)
      }
    })

    it('zavrne non-array modifiersJson (objekt namesto array)', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify({ name: 'Sir', price: 1.50 }),
      })
      expect(result.success).toBe(false)
    })

    it('zavrne quantity = 0 ali negativno', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Sir', price: 1.50, quantity: 0 }]),
      })
      expect(result.success).toBe(false)
    })

    it('zavrne quantity nad 99', () => {
      const result = createOrderItemSchema.safeParse({
        menuItemId: 'menu-1',
        quantity: 1,
        modifiersJson: JSON.stringify([{ name: 'Sir', price: 1.50, quantity: 100 }]),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createOrderSchema — full order z modifiers', () => {
    it('sprejme celotno naročilo z valid modifiers', () => {
      const result = createOrderSchema.safeParse({
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [
          {
            menuItemId: 'menu-1',
            quantity: 2,
            modifiersJson: JSON.stringify([
              { name: 'Sir', price: 1.50 },
              { name: 'Slanina', price: 2.00, quantity: 2 },
            ]),
          },
          {
            menuItemId: 'menu-2',
            quantity: 1,
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('zavrne celotno naročilo če en item ima neveljaven modifier', () => {
      const result = createOrderSchema.safeParse({
        type: 'dine-in',
        orderItems: [
          {
            menuItemId: 'menu-1',
            quantity: 1,
            modifiersJson: JSON.stringify([{ name: 'Sir', price: 'not-a-number' }]),
          },
        ],
      })
      expect(result.success).toBe(false)
    })
  })
})
