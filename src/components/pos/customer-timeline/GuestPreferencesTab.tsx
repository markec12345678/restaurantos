'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UtensilsCrossed, Star, AlertCircle, Heart, ShieldAlert } from 'lucide-react'
import type { GuestProfile } from './constants'

// --- Props ---

interface GuestPreferencesTabProps {
  guest: GuestProfile
}

// --- Komponenta: Preference, alergeni, priljubljene jedi, oznake ---

export const GuestPreferencesTab = memo(function GuestPreferencesTab({
  guest,
}: GuestPreferencesTabProps) {
  return (
    <>
      {/* Priljubljene jedi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" /> Priljubljene jedi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guest.favoriteItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {guest.favoriteItems.map((item, i) => (
                <Badge key={item || i} variant="secondary" className="text-sm">
                  <UtensilsCrossed className="h-3 w-3 mr-1" /> {item}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ni zabeleženih priljubljenih jedi</p>
          )}
        </CardContent>
      </Card>

      {/* Alergeni */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" /> Alergeni
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guest.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {guest.allergens.map((allergen, i) => (
                <Badge key={allergen || i} variant="destructive" className="text-sm">
                  <AlertCircle className="h-3 w-3 mr-1" /> {allergen}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ni zabeleženih alergenov</p>
          )}
        </CardContent>
      </Card>

      {/* Preference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Preference
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guest.preferences.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {guest.preferences.map((pref, i) => (
                <Badge key={pref || i} variant="outline" className="text-sm">{pref}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ni zabeleženih preferenc</p>
          )}
        </CardContent>
      </Card>

      {/* Oznake */}
      {guest.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Oznake
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {guest.tags.map((tag, i) => (
                <Badge key={tag || i} variant="secondary" className="text-sm">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
})
