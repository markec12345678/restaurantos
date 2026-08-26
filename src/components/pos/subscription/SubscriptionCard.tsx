'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Clock, ArrowUpRight } from 'lucide-react'
import { planIcons, planColors, statusLabels, statusColors } from './constants'
import type { SubscriptionCardProps } from './constants'

// ============================================
// KARTICA NAROČNINE — Prikaz trenutne naročnine
// ============================================

export const SubscriptionCard = memo(function SubscriptionCard({ subscription, planName, onActivate, onUpgrade }: SubscriptionCardProps) {
  return (
    <Card className={`border-2 ${subscription.status === 'active' ? 'border-green-500/30' : subscription.status === 'trial' ? 'border-blue-500/30' : 'border-red-500/30'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${planColors[subscription.plan] || 'from-gray-400 to-gray-500'} text-white flex items-center justify-center`}>
                {planIcons[subscription.plan]}
              </div>
              <div>
                <h3 className="text-xl font-bold">{planName}</h3>
                <p className="text-muted-foreground">{subscription.companyName}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Badge className={statusColors[subscription.status] || ''}>
                {statusLabels[subscription.status] || subscription.status}
              </Badge>
              <span className="text-2xl font-bold">€{subscription.monthlyPrice}<span className="text-sm text-muted-foreground font-normal">/mesec</span></span>
              <span className="text-sm text-muted-foreground">{subscription.locationCount} lokacij</span>
            </div>
            {subscription.status === 'trial' && subscription.trialEndsAt && (
              <p className="text-sm text-blue-600 mt-2">
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                Preizkusno obdobje do {new Date(subscription.trialEndsAt).toLocaleDateString('sl-SI')}
              </p>
            )}
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground mt-1">
                Veljavno do {new Date(subscription.currentPeriodEnd).toLocaleDateString('sl-SI')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {subscription.status === 'trial' && (
              <Button onClick={() => onActivate(subscription.id)} className="gap-1">
                <Check className="h-4 w-4" /> Aktiviraj
              </Button>
            )}
            {subscription.plan !== 'enterprise' && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => onUpgrade(subscription.id, subscription.plan === 'starter' ? 'professional' : 'enterprise')}>
                <ArrowUpRight className="h-3.5 w-3.5" /> Nadgradi
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
