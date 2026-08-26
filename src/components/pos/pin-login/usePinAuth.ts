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
  } catch {
    // sessionStorage ni na voljo
  }
  return currentUser
}

export function setCurrentUser(user: AuthUser | null) {
  currentUser = user
  if (typeof window !== 'undefined') {
    if (user) {
      sessionStorage.setItem('pos_auth_user', JSON.stringify(user))
    } else {
      sessionStorage.removeItem('pos_auth_user')
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_user')
      localStorage.removeItem('pos_auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  // FIX: Preveri tudi localStorage 'pos_token' (uporablja se v POS prijavi)
  try {
    const stored = sessionStorage.getItem('pos_auth_token')
    if (stored) {
      authToken = stored
      return authToken
    }
  } catch {
    // sessionStorage ni na voljo
  }
  // FIX: Preveri localStorage 'pos_token' (glavni POS login shrani tu)
  try {
    const localStorageToken = localStorage.getItem('pos_token')
    if (localStorageToken) {
      authToken = localStorageToken
      return authToken
    }
  } catch {
    // localStorage ni na voljo
  }
  return authToken
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('pos_auth_token', token)
    } else {
      sessionStorage.removeItem('pos_auth_token')
      localStorage.removeItem('pos_auth_token')
    }
  }
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
  if (response.status === 401) {
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
