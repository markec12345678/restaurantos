'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  UserCircle,
  Calendar,
  UtensilsCrossed,
  Star,
  AlertCircle,
  Heart,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  Award,
  ShieldAlert,
  ChevronRight,
  Search,
} from 'lucide-react'

interface GuestVisit {
  id: string
  date: string
  table: string | null
  server: string | null
  total: number
  items: string[]
  rating: number | null
  feedback: string | null
}

interface GuestProfile {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyaltyPoints: number
  loyaltyTier: string
  totalVisits: number
  totalSpent: number
  avgSpend: number
  lastVisit: string | null
  firstVisit: string | null
  favoriteItems: string[]
  allergens: string[]
  preferences: string[]
  notes: string
  visits: GuestVisit[]
  tags: string[]
}

export function CustomerTimeline() {
  const [guests, setGuests] = useState<GuestProfile[]>([])
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadGuests()
  }, [])

  const loadGuests = async () => {
    try {
      const res = await fetch('/api/guests')
      const data = await res.json()

      const profiles: GuestProfile[] = (data || []).map((g: any) => {
        const visits: GuestVisit[] = (g.visits || []).map((v: any) => ({
          id: v.id,
          date: v.createdAt || v.visitDate,
          table: v.table?.number?.toString() || null,
          server: v.server?.name || null,
          total: v.total || v.spent || 0,
          items: v.items || [],
          rating: v.rating || null,
          feedback: v.feedback || null,
        }))

        const totalSpent = visits.reduce((sum, v) => sum + v.total, 0)
        const totalVisits = visits.length || g.visitCount || 0
        const avgSpend = totalVisits > 0 ? totalSpent / totalVisits : 0

        // Pridobi priljubljene jedi iz obiskov
        const itemCounts: Record<string, number> = {}
        visits.forEach(v => {
          (v.items || []).forEach(item => {
            itemCounts[item] = (itemCounts[item] || 0) + 1
          })
        })
        const favoriteItems = Object.entries(itemCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name]) => name)

        return {
          id: g.id,
          name: g.name || 'Neznan gost',
          phone: g.phone || null,
          email: g.email || null,
          loyaltyPoints: g.loyaltyPoints || 0,
          loyaltyTier: g.loyaltyTier || 'Bronza',
          totalVisits,
          totalSpent,
          avgSpend,
          lastVisit: visits.length > 0 ? visits[0].date : g.lastVisit || null,
          firstVisit: visits.length > 0 ? visits[visits.length - 1].date : g.createdAt || null,
          favoriteItems,
          allergens: g.allergens || [],
          preferences: g.preferences || [],
          notes: g.notes || '',
          visits: visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          tags: g.tags || [],
        }
      })

      // Sortiraj po zadnjem obisku
      profiles.sort((a, b) => {
        const aDate = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
        const bDate = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
        return bDate - aDate
      })

      setGuests(profiles)
    } catch (err) {
      console.error('Error loading guests:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredGuests = guests.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.phone && g.phone.includes(searchQuery)) ||
    (g.email && g.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const tierColors: Record<string, string> = {
    'Bronza': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'Srebro': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    'Zlato': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Platina': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  // Statistike
  const totalGuests = guests.length
  const returningGuests = guests.filter(g => g.totalVisits > 1).length
  const avgSpendAll = totalGuests > 0 ? guests.reduce((s, g) => s + g.avgSpend, 0) / totalGuests : 0
  const vipGuests = guests.filter(g => g.loyaltyTier === 'Zlato' || g.loyaltyTier === 'Platina').length

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <UserCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">CRM časovnica gostov</h2>
            <p className="text-sm text-muted-foreground">Obiski, preference, alergeni in zvestoba</p>
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <UserCircle className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalGuests}</p>
            <p className="text-xs text-muted-foreground">Skupaj gostov</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{totalGuests > 0 ? Math.round(returningGuests / totalGuests * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Povratni gostje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{formatCurrency(avgSpendAll)}</p>
            <p className="text-xs text-muted-foreground">Povprečna poraba</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Award className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{vipGuests}</p>
            <p className="text-xs text-muted-foreground">VIP gostje</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 h-[calc(100%-200px)]">
        {/* Seznam gostov */}
        <div className="w-1/3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Išči po imenu, telefonu, emailu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>

          <div className="space-y-1 overflow-auto max-h-[calc(100%-50px)]">
            {filteredGuests.map(guest => (
              <button
                key={guest.id}
                onClick={() => setSelectedGuest(guest)}
                className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent ${
                  selectedGuest?.id === guest.id ? 'bg-accent border-primary' : ''
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

        {/* Podrobnosti gosta */}
        <div className="flex-1">
          {selectedGuest ? (
            <Tabs defaultValue="timeline" className="h-full">
              <TabsList>
                <TabsTrigger value="timeline">Časovnica</TabsTrigger>
                <TabsTrigger value="profile">Profil</TabsTrigger>
                <TabsTrigger value="preferences">Preference</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
                {selectedGuest.visits.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Ni zabeleženih obiskov</p>
                    </CardContent>
                  </Card>
                ) : (
                  selectedGuest.visits.map((visit, idx) => (
                    <Card key={visit.id} className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border -z-0" />
                      <CardContent className="p-4 pl-10 relative">
                        <div className="absolute left-2.5 top-5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{formatDate(visit.date)}</span>
                              {visit.table && (
                                <Badge variant="outline" className="text-xs">Miza {visit.table}</Badge>
                              )}
                              {visit.server && (
                                <span className="text-xs text-muted-foreground">Natakar: {visit.server}</span>
                              )}
                            </div>
                            {visit.items.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {visit.items.slice(0, 5).map((item, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                                ))}
                                {visit.items.length > 5 && (
                                  <Badge variant="secondary" className="text-xs">+{visit.items.length - 5}</Badge>
                                )}
                              </div>
                            )}
                            {visit.rating && (
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < visit.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                  />
                                ))}
                                {visit.feedback && (
                                  <span className="text-xs text-muted-foreground ml-2">"{visit.feedback}"</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="font-semibold text-sm">{formatCurrency(visit.total)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="profile" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback>
                          {selectedGuest.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{selectedGuest.name}</CardTitle>
                        {selectedGuest.loyaltyTier && (
                          <Badge className={tierColors[selectedGuest.loyaltyTier] || ''}>
                            <Award className="h-3 w-3 mr-1" /> {selectedGuest.loyaltyTier} — {selectedGuest.loyaltyPoints} točk
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedGuest.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {selectedGuest.phone}
                        </div>
                      )}
                      {selectedGuest.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {selectedGuest.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Prvi obisk: {formatDate(selectedGuest.firstVisit)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Zadnji obisk: {formatDate(selectedGuest.lastVisit)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedGuest.totalVisits}</p>
                        <p className="text-xs text-muted-foreground">Obiski</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{formatCurrency(selectedGuest.totalSpent)}</p>
                        <p className="text-xs text-muted-foreground">Skupaj porabljeno</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{formatCurrency(selectedGuest.avgSpend)}</p>
                        <p className="text-xs text-muted-foreground">Povprečno na obisk</p>
                      </div>
                    </div>

                    {selectedGuest.notes && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Opombe</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedGuest.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preferences" className="mt-3 space-y-3 overflow-auto max-h-[calc(100%-50px)]">
                {/* Priljubljene jedi */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" /> Priljubljene jedi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedGuest.favoriteItems.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedGuest.favoriteItems.map((item, i) => (
                          <Badge key={i} variant="secondary" className="text-sm">
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
                    {selectedGuest.allergens.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedGuest.allergens.map((allergen, i) => (
                          <Badge key={i} variant="destructive" className="text-sm">
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
                    {selectedGuest.preferences.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedGuest.preferences.map((pref, i) => (
                          <Badge key={i} variant="outline" className="text-sm">{pref}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Ni zabeleženih preferenc</p>
                    )}
                  </CardContent>
                </Card>

                {/* Oznake */}
                {selectedGuest.tags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Oznake
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedGuest.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-sm">{tag}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="p-8 text-center">
                <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">Izberite gosta</p>
                <p className="text-sm text-muted-foreground">Kliknite na gosta na levi za pregled časovnice</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
