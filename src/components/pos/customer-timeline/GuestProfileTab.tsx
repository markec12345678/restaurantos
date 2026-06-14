'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Phone, Mail, Calendar, Clock, MessageSquare, Award } from 'lucide-react'
import type { GuestProfile } from './constants'
import { tierColors, formatDate, formatCurrency } from './constants'

// --- Props ---

interface GuestProfileTabProps {
  guest: GuestProfile
}

// --- Komponenta: Profil gosta ---

export const GuestProfileTab = memo(function GuestProfileTab({
  guest,
}: GuestProfileTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarFallback>
              {guest.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{guest.name}</CardTitle>
            {guest.loyaltyTier && (
              <Badge className={tierColors[guest.loyaltyTier] || ''}>
                <Award className="h-3 w-3 mr-1" /> {guest.loyaltyTier} — {guest.loyaltyPoints} točk
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {guest.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {guest.phone}
            </div>
          )}
          {guest.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {guest.email}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Prvi obisk: {formatDate(guest.firstVisit)}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Zadnji obisk: {formatDate(guest.lastVisit)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{guest.totalVisits}</p>
            <p className="text-xs text-muted-foreground">Obiski</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{formatCurrency(guest.totalSpent)}</p>
            <p className="text-xs text-muted-foreground">Skupaj porabljeno</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{formatCurrency(guest.avgSpend)}</p>
            <p className="text-xs text-muted-foreground">Povprečno na obisk</p>
          </div>
        </div>

        {guest.notes && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Opombe</span>
            </div>
            <p className="text-sm text-muted-foreground">{guest.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
