'use client'
// ============================================
// AUTH UTILITIES — Prijava, tokeni, pooblastila
// Izvlečeno iz PinLogin.tsx za manjše datoteke
// ============================================

import type { AuthUser } from './constants'

// Globalno stanje za prijavljenega uporabnika in token
let currentUser: AuthUser | null = null
let authToken: string | null = null

export function getCurrentUser() {
  if (typeof window === 'undefined') return null
  try {
    const stored = sessionStorage.getItem('pos_auth_user')
    if (stored) {
      currentUser = JSON.parse(stored)
      return currentUser
    }
    // FIX: Preveri tudi localStorage (persistence across tabs)
    const localStored = localStorage.getItem('pos_auth_user')
    if (localStored) {
      currentUser = JSON.parse(localStored)
      // Migriraj v sessionStorage
      sessionStorage.setItem('pos_auth_user', localStored)
      return currentUser
    }
  } catch {
    // sessionStorage ni na voljo
  }
  return currentUser
}

export function setCurrentUser(user: AuthUser | null) {
  currentUser = user
  if (typeof window !== 'undefined') {
    if (user) {
      const json = JSON.stringify(user)
      sessionStorage.setItem('pos_auth_user', json)
      // FIX: Shrani tudi v localStorage za persistence across tabs/sessions
      localStorage.setItem('pos_auth_user', json)
    } else {
      sessionStorage.removeItem('pos_auth_user')
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_user')
      localStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  // FIX: Preveri sessionStorage, nato localStorage, nato global
  try {
    const stored = sessionStorage.getItem('pos_auth_token')
    if (stored) {
      authToken = stored
      return authToken
    }
  } catch {
    // sessionStorage ni na voljo
  }
  // FIX: Preveri localStorage (persistence across page reloads)
  try {
    const localStorageToken = localStorage.getItem('pos_auth_token')
    if (localStorageToken) {
      authToken = localStorageToken
      // Migriraj v sessionStorage
      sessionStorage.setItem('pos_auth_token', localStorageToken)
      return authToken
    }
  } catch {
    // localStorage ni na voljo
  }
  // FIX: Preveri tudi 'pos_token' key (kompatibilnost)
  try {
    const altToken = localStorage.getItem('pos_token')
    if (altToken) {
      authToken = altToken
      sessionStorage.setItem('pos_auth_token', altToken)
      localStorage.setItem('pos_auth_token', altToken)
      return authToken
    }
  } catch {
    // ignore
  }
  return authToken
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      // FIX: Shrani v OBE storage (sessionStorage + localStorage)
      sessionStorage.setItem('pos_auth_token', token)
      localStorage.setItem('pos_auth_token', token)
      // FIX: Shrani tudi pod 'pos_token' za backward compat
      localStorage.setItem('pos_token', token)
    } else {
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_token')
    }
  }
}

// FIX: Flag da preprečimo clear token med prefetch (pred login)
let isPrefetchPhase = false

export function setPrefetchPhase(active: boolean) {
  isPrefetchPhase = active
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const method = (options.method || 'GET').toUpperCase()
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('restaurantos-csrf='))
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1]
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      }
    }
  }
  const response = await fetch(url, { ...options, headers })
  
  // FIX: Ne clear token na 401 med prefetch fazo (pred login)
  // Samo clear če imamo že token in dobimo 401 (expired session)
  if (response.status === 401 && token && !isPrefetchPhase) {
    setAuthToken(null)
    setCurrentUser(null)
    window.dispatchEvent(new CustomEvent('pos:auth-expired'))
  }
  
  if (!response.ok) {
    let errorMessage = `Napaka ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // JSON parsanje neuspešno
    }
    throw new Error(errorMessage)
  }
  return response
}

export function hasPermission(permission: string): boolean {
  const user = getCurrentUser()
  if (!user) return false
  if (user.role === 'admin' || user.role === 'manager') return true
  return user.permissions.includes(permission) || user.permissions.includes('admin')
}
