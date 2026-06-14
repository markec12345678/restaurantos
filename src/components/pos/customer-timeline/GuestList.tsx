'use client'

import { memo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Search } from 'lucide-react'
import type { GuestProfile } from './constants'
import { tierColors, formatCurrency } from './constants'

// --- Props ---

interface GuestListProps {
  guests: GuestProfile[]
  searchQuery: string
  selectedGuestId: string | null
  onSearchChange: (_e: React.ChangeEvent<HTMLInputElement>) => void
  onSelectGuest: (_guest: GuestProfile) => void
}

// --- Komponenta: Seznam gostov z iskanjem ---

export const GuestList = memo(function GuestList({
  guests,
  searchQuery,
  selectedGuestId,
  onSearchChange,
  onSelectGuest,
}: GuestListProps) {
  return (
    <div className="w-1/3 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          id="guest-search"
          placeholder="Išči po imenu, telefonu, emailu..."
          value={searchQuery}
          onChange={onSearchChange}
          aria-label="Išči po gostih"
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
        />
      </div>

      <div className="space-y-1 overflow-auto max-h-[calc(100%-50px)]">
        {guests.map(guest => (
          <button
            key={guest.id}
            onClick={() => onSelectGuest(guest)}
            className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent ${
              selectedGuestId === guest.id ? 'bg-accent border-primary' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{guest.name}</span>
                  {guest.loyaltyTier && (
                    <Badge className={`text-[10px] px-1 py-0 ${tierColors[guest.loyaltyTier] || ''}`}>
                      {guest.loyaltyTier}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{guest.totalVisits} obiskov</span>
                  <span>·</span>
                  <span>{formatCurrency(guest.totalSpent)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})
