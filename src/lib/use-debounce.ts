'use client'

import { useState, useEffect } from 'react'

/**
 * Hook za odloženo posodabljanje vrednosti (debounce).
 *
 * Uporaben za iskalna polja, kjer želimo počakati, da uporabnik
 * preneha tipkati, preden sprožimo API klic.
 *
 * @param value - Vrednost, ki jo želimo odložiti
 * @param delay - Zakasnitev v milisekundah (privzeto 300ms)
 * @returns Odložena vrednost, ki se posodobi po zakasnitvi
 *
 * @example
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 500)
 *
 * useQuery({
 *   queryKey: ['search', debouncedSearch],
 *   queryFn: () => fetch(`/api/items?q=${debouncedSearch}`),
 *   enabled: debouncedSearch.length >= 2,
 * })
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
