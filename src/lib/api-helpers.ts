// ============================================
// API Response Normalization Utilities
// ============================================
// Shared helpers for safely extracting arrays from API responses.
// Every query hook should use these instead of returning raw res.json().
//
// Problem: API endpoints return different shapes:
//   /api/inventory    → { items: [...] }
//   /api/suppliers    → { suppliers: [...] }
//   /api/orders       → { orders: [...] }
//   /api/menu-items   → { menuItems: [...] }
//   /api/recipes      → [...] (array)
//
// Solution: fetchArray() always returns an array.
// ============================================

/**
 * Safely extracts an array from an API response object.
 * Tries the primary key, then fallback keys, then common keys, then returns [].
 */
export function extractArray<T = unknown>(
  data: unknown,
  primaryKey?: string,
  ...fallbackKeys: string[]
): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data === null || data === undefined) return []
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (primaryKey && Array.isArray(obj[primaryKey])) return obj[primaryKey] as T[]
    for (const key of fallbackKeys) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
    for (const key of ['items', 'data', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

/**
 * Safely fetches JSON from a Response.
 * Returns null on failure (non-OK status or parse error).
 */
export async function safeJson(res: Response): Promise<unknown | null> {
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * All-in-one: check ok → parse JSON → extract array.
 * Use this in every queryFn to guarantee an array is returned.
 *
 * @example
 * queryFn: async () => {
 *   const res = await authFetch('/api/orders')
 *   return await fetchArray(res, 'orders')
 * }
 */
export async function fetchArray<T = unknown>(
  res: Response,
  primaryKey?: string,
  ...fallbackKeys: string[]
): Promise<T[]> {
  const json = await safeJson(res)
  if (json === null) return []
  return extractArray<T>(json, primaryKey, ...fallbackKeys)
}
