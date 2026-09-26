// ============================================
// QUERY KEYS — Naprave (Device center, R142-c)
// ============================================

/**
 * R142-c (epic #115 #29 Device center): inventar naprav prek
 * GET /api/devices (kontrakt R142-b — whitelist + isOnline computed).
 * Mutacije (rename/reassign PATCH /api/devices/[id]) invalidirajo `all`.
 */
export const devicesKeys = {
  all: ['devices'] as const,
}
