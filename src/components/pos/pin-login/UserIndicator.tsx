'use client'

import { memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { User, LogOut } from 'lucide-react'
import { getCurrentUser, getAuthToken, setCurrentUser, setAuthToken } from '../PinLogin'
import { clearOfflineSession } from './offline-auth'

// ============================================
// UPORABNISKI INDICATOR — Prikaz prijavljenega uporabnika (za Sidebar)
// ============================================

export const UserIndicator = memo(function UserIndicator() {
  const user = getCurrentUser()
  const queryClient = useQueryClient()
  if (!user) return null
  const handleLogout = async () => {
    // Poklici DELETE /api/auth za unicevanje seje
    try {
      const token = getAuthToken()
      await fetch('/api/auth', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
    } catch {
      // Ignoriraj napake pri odjavi
    }
    setCurrentUser(null)
    setAuthToken(null)
    // Offline device session poteče ob odjavi — brez tega bi bil PIN
    // napadalcu ostal uporaben še 12 h po odjavi.
    clearOfflineSession()
    queryClient.invalidateQueries()
    toast.success('Uspešno odjavljen')
  }
  return (
    <div className="px-3 py-2 border-t border-border">
      <div className="flex items-center gap-2 text-xs">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user.name}</p>
          {user.primaryJob && (
            <p className="text-[10px] text-muted-foreground truncate">{user.primaryJob.name}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Odjava" className="h-6 w-6 flex-shrink-0" onClick={handleLogout} title="Odjava">
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})
