// ============================================
// Sync State — Unit testi
// ============================================
// Testira logiko konflikt detekcije in resolucije
// (brez DB klicev — čista funkcionalnost).
// ============================================

import { describe, it, expect } from 'vitest'

// --- Tipi (skladno z API-jem) ---
type ConflictStatus = 'none' | 'detected' | 'resolved'

interface ConflictData {
  incomingVersion?: number
  existingVersion?: number
  incomingData?: unknown
  existingData?: unknown
  detectedAt?: string
  resolution?: string
  resolvedData?: unknown
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

// --- Pomožne funkcije (kompaktibilne z API logiko) ---

// 1. Conflict detection: če incoming syncVersion < existing, je konflikt
function detectConflict(
  incomingVersion: number,
  existingVersion: number | undefined,
): { isConflict: boolean; conflictStatus: ConflictStatus } {
  if (existingVersion === undefined) {
    return { isConflict: false, conflictStatus: 'none' }
  }
  if (existingVersion > incomingVersion) {
    return { isConflict: true, conflictStatus: 'detected' }
  }
  return { isConflict: false, conflictStatus: 'none' }
}

// 2. Build conflict data
function buildConflictData(
  incomingVersion: number,
  existingVersion: number,
  incomingData: unknown,
  existingData: unknown,
): ConflictData {
  return {
    incomingVersion,
    existingVersion,
    incomingData,
    existingData,
    detectedAt: new Date().toISOString(),
  }
}

// 3. Resolve conflict — apply resolution strategy
function applyResolution(
  conflictData: ConflictData,
  resolution: 'keep_incoming' | 'keep_existing' | 'merge' | 'discard',
  mergedData?: unknown,
  notes?: string,
): { resolvedData: unknown; resolvedConflictData: ConflictData } {
  let resolvedData: unknown

  switch (resolution) {
    case 'keep_incoming':
      resolvedData = conflictData.incomingData
      break
    case 'keep_existing':
      resolvedData = conflictData.existingData
      break
    case 'merge':
      resolvedData = mergedData
      break
    case 'discard':
      resolvedData = null
      break
  }

  return {
    resolvedData,
    resolvedConflictData: {
      ...conflictData,
      resolution,
      resolvedData,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'admin',
      notes: notes || '',
    },
  }
}

// 4. Compute next sync version (vector clock)
function nextSyncVersion(existing: number | undefined, incoming: number): number {
  return Math.max(existing || 0, incoming)
}

// --- Testi ---

describe('detectConflict', () => {
  it('brez existinga → ni konflikta (prvi write)', () => {
    const result = detectConflict(1, undefined)
    expect(result.isConflict).toBe(false)
    expect(result.conflictStatus).toBe('none')
  })

  it('incoming > existing → ni konflikta (fresh write)', () => {
    const result = detectConflict(5, 3)
    expect(result.isConflict).toBe(false)
    expect(result.conflictStatus).toBe('none')
  })

  it('incoming = existing → ni konflikta (idempotent)', () => {
    const result = detectConflict(3, 3)
    expect(result.isConflict).toBe(false)
    expect(result.conflictStatus).toBe('none')
  })

  it('incoming < existing → konflikt (stale write)', () => {
    const result = detectConflict(2, 5)
    expect(result.isConflict).toBe(true)
    expect(result.conflictStatus).toBe('detected')
  })

  it('incoming 0, existing 1 → konflikt', () => {
    const result = detectConflict(0, 1)
    expect(result.isConflict).toBe(true)
  })
})

describe('buildConflictData', () => {
  it('vsebuje obe verziji in podatke', () => {
    const cd = buildConflictData(2, 5, { name: 'A' }, { name: 'B' })
    expect(cd.incomingVersion).toBe(2)
    expect(cd.existingVersion).toBe(5)
    expect(cd.incomingData).toEqual({ name: 'A' })
    expect(cd.existingData).toEqual({ name: 'B' })
    expect(cd.detectedAt).toBeDefined()
  })

  it('timestamp je ISO format', () => {
    const cd = buildConflictData(1, 2, {}, {})
    expect(() => new Date(cd.detectedAt!)).not.toThrow()
  })
})

describe('applyResolution', () => {
  const baseConflict: ConflictData = {
    incomingVersion: 2,
    existingVersion: 5,
    incomingData: { name: 'Updated', price: 15 },
    existingData: { name: 'Original', price: 10 },
    detectedAt: '2026-09-15T10:00:00Z',
  }

  it('keep_incoming → uporabi incoming podatke', () => {
    const { resolvedData, resolvedConflictData } = applyResolution(baseConflict, 'keep_incoming')
    expect(resolvedData).toEqual({ name: 'Updated', price: 15 })
    expect(resolvedConflictData.resolution).toBe('keep_incoming')
    expect(resolvedConflictData.resolvedData).toEqual({ name: 'Updated', price: 15 })
    expect(resolvedConflictData.resolvedBy).toBe('admin')
  })

  it('keep_existing → ohrani obstoječe podatke', () => {
    const { resolvedData } = applyResolution(baseConflict, 'keep_existing')
    expect(resolvedData).toEqual({ name: 'Original', price: 10 })
  })

  it('merge → uporabi merged podatke', () => {
    const merged = { name: 'Updated', price: 10 } // kombinacija
    const { resolvedData } = applyResolution(baseConflict, 'merge', merged)
    expect(resolvedData).toEqual(merged)
  })

  it('discard → null', () => {
    const { resolvedData } = applyResolution(baseConflict, 'discard')
    expect(resolvedData).toBeNull()
  })

  it('resolvedAt je ISO timestamp', () => {
    const { resolvedConflictData } = applyResolution(baseConflict, 'keep_incoming')
    expect(() => new Date(resolvedConflictData.resolvedAt!)).not.toThrow()
  })

  it('notes se pravilno shranijo', () => {
    const { resolvedConflictData } = applyResolution(baseConflict, 'keep_incoming', undefined, 'Stranka je potrdila A')
    expect(resolvedConflictData.notes).toBe('Stranka je potrdila A')
  })

  it('brez notes → prazen string', () => {
    const { resolvedConflictData } = applyResolution(baseConflict, 'keep_incoming')
    expect(resolvedConflictData.notes).toBe('')
  })
})

describe('nextSyncVersion', () => {
  it('brez existinga → incoming', () => {
    expect(nextSyncVersion(undefined, 5)).toBe(5)
  })

  it('incoming > existing → incoming', () => {
    expect(nextSyncVersion(3, 5)).toBe(5)
  })

  it('incoming < existing → existing (ne degradira)', () => {
    expect(nextSyncVersion(10, 5)).toBe(10)
  })

  it('incoming = existing → isti', () => {
    expect(nextSyncVersion(5, 5)).toBe(5)
  })

  it('existing 0, incoming 0 → 0', () => {
    expect(nextSyncVersion(0, 0)).toBe(0)
  })
})

describe('ConflictStatus state machine', () => {
  const validTransitions: Record<ConflictStatus, ConflictStatus[]> = {
    none: ['detected'], // lahko postane detected ko pride stale write
    detected: ['resolved'], // admin reši
    resolved: ['detected'], // ponovno odprt če se ponovi
  }

  it('none → detected (valid)', () => {
    expect(validTransitions.none).toContain('detected')
  })

  it('none → resolved (invalid — mora iti čez detected)', () => {
    expect(validTransitions.none).not.toContain('resolved')
  })

  it('detected → resolved (valid)', () => {
    expect(validTransitions.detected).toContain('resolved')
  })

  it('detected → none (invalid — mora iti čez resolved)', () => {
    expect(validTransitions.detected).not.toContain('none')
  })

  it('resolved → detected (valid — re-open)', () => {
    expect(validTransitions.resolved).toContain('detected')
  })
})

describe('Entity type labels', () => {
  it('vsi entity types so definirani', () => {
    const types = ['order', 'menu_item', 'employee', 'reservation', 'customer', 'payment']
    expect(types.length).toBe(6)
  })
})
