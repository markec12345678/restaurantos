'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Javna stran za rezervacije (/reserve)
// Stranke lahko rezervirajo mize online
// - Izbira datuma, ure in števila oseb
// - Pregled razpoložljivih terminov
// - Potrditev z e-pošto/SMS
// - Večjezična podpora
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { sl } from 'date-fns/locale'
import {
  Calendar, Clock, Users, Phone, Mail, CheckCircle2,
  ChevronLeft, ChevronRight, UtensilsCrossed, Star,
  MapPin, MessageSquare, AlertCircle, Loader2,
} from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────
interface ReservationSlot {
  time: string
  available: boolean
  tablesAvailable: number
}

interface RestaurantInfo {
  name: string
  address: string
  phone: string
  logo: string
  openingHours: Record<string, { open: string; close: string }>
}

// ─── Konstante ─────────────────────────────────────────────────
const DAY_NAMES = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20]
const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
]

// ─── Glavna stran ──────────────────────────────────────────────
export default function ReservePage() {
  const [step, setStep] = useState<'details' | 'confirm' | 'success' | 'error'>('details')
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1))
  const [selectedTime, setSelectedTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [reservationId, setReservationId] = useState('')
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null)
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Pridobi podatke restavracije
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          setRestaurantInfo({
            name: data.settings.restaurantName || 'RestaurantOS',
            address: data.settings.address || '',
            phone: data.settings.phone || '',
            logo: data.settings.logo || '',
            openingHours: data.settings.openingHours || {},
          })
        }
      })
      .catch(() => {})
  }, [])

  // Pridobi razpoložljive termin ob spremembi datuma/velikosti
  useEffect(() => {
    const fetchSlots = async () => {
      setSlotsLoading(true)
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const res = await fetch(`/api/reservations?date=${dateStr}&partySize=${partySize}&checkAvailability=true`)
        const data = await res.json()

        if (data?.availableSlots) {
          setAvailableSlots(data.availableSlots)
        } else {
          // Izračunaj na podlagi odpiralnih časov
          const dayName = DAY_NAMES[selectedDate.getDay()].toLowerCase()
          const hours = restaurantInfo?.openingHours?.[dayName]
          if (hours) {
            const slots = TIME_SLOTS.filter(t => t >= hours.open && t <= hours.close).map(t => ({
              time: t,
              available: true,
              tablesAvailable: 3,
            }))
            setAvailableSlots(slots)
          } else {
            // Privzeto za vsak dan
            setAvailableSlots(
              TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 }))
            )
          }
        }
      } catch {
        // Fallback - vsi termini na voljo
        setAvailableSlots(TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 })))
      }
      setSlotsLoading(false)
    }
    fetchSlots()
  }, [selectedDate, partySize, restaurantInfo])

  // Datum navigacija
  const navigateDate = (dir: number) => {
    const newDate = addDays(selectedDate, dir)
    if (!isBefore(newDate, startOfDay(new Date()))) {
      setSelectedDate(newDate)
      setSelectedTime('')
    }
  }

  // Veljavnost obrazca
  const isValid = selectedDate && selectedTime && partySize && customerName && customerPhone

  // Pošlji rezervacijo
  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const dateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`)
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          dateTime: dateTime.toISOString(),
          partySize,
          duration: 120,
          notes,
          specialRequests,
          source: 'website',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka pri ustvarjanju rezervacije')
      }
      const data = await res.json()
      setReservationId(data.reservation?.id || data.id || '')
      setStep('success')
    } catch (err: unknown) {
      setStep('error')
    }
    setLoading(false)
  }

  // ─── SUCCESS ───────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">Rezervacija potrjena!</h2>
          <p className="text-muted-foreground mb-4">Hvala, {customerName}! Vaša rezervacija je bila uspešno ustvarjena.</p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 mb-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>{selectedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-emerald-600" />
              <span>{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</span>
            </div>
            {customerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-emerald-600" />
                <span>Potrdilo poslano na {customerEmail}</span>
              </div>
            )}
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
            Nova rezervacija
          </button>
        </div>
      </div>
    )
  }

  // ─── ERROR ─────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-400 mb-2">Napaka pri rezervaciji</h2>
          <p className="text-muted-foreground mb-4">Prišlo je do napake. Poskusite znova ali nas kontaktirajte telefon.</p>
          <button onClick={() => setStep('details')} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors">
            Poskusi znova
          </button>
        </div>
      </div>
    )
  }

  // ─── GLAVNI OBRAZEC ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{restaurantInfo?.name || 'RestaurantOS'}</h1>
              {restaurantInfo?.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{restaurantInfo.address}
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Rezervacija mize</div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Koraki */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[
            { num: 1, label: 'Podatki', active: step === 'details' },
            { num: 2, label: 'Potrditev', active: step === 'confirm' },
            { num: 3, label: 'Potrjeno', active: false },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                s.active ? 'bg-primary text-primary-foreground' : i < (step === 'confirm' ? 1 : 0) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {s.num}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${s.active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
              {i < 2 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        {step === 'details' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Levo: Izbira datuma in časa */}
            <div className="space-y-4">
              {/* Datum */}
              <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Izberite datum
                </h2>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => navigateDate(-1)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="font-bold text-lg">{format(selectedDate, 'EEEE', { locale: sl })}</p>
                    <p className="text-muted-foreground">{format(selectedDate, 'd. MMMM yyyy', { locale: sl })}</p>
                  </div>
                  <button onClick={() => navigateDate(1)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {/* Hitri izbiri datuma */}
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
                    const date = addDays(new Date(), offset)
                    if (isBefore(date, startOfDay(new Date())) && offset === 0) return null
                    return (
                      <button
                        key={offset}
                        onClick={() => { setSelectedDate(date); setSelectedTime('') }}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isSameDay(date, selectedDate)
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : isToday(date)
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                              : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div>{format(date, 'EEE', { locale: sl })}</div>
                        <div className="font-bold text-sm">{format(date, 'd')}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Število oseb */}
              <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Število oseb
                </h2>
                <div className="grid grid-cols-6 gap-2">
                  {PARTY_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setPartySize(size)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        partySize === size
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {partySize > 8 && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Za večje skupine vas prosimo, da nas kontaktirate telefon.
                  </p>
                )}
              </div>

              {/* Časovni termini */}
              <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Izberite termin
                </h2>
                {slotsLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Na ta dan smo žal zaprti.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* Kosilo */}
                    {availableSlots.filter(s => s.time < '15:00').length > 0 && (
                      <>
                        <div className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Kosilo</div>
                        {availableSlots.filter(s => s.time < '15:00').map(slot => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                              selectedTime === slot.time
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : slot.available
                                  ? 'bg-muted hover:bg-muted/80'
                                  : 'bg-muted/50 text-muted-foreground line-through cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </>
                    )}
                    {/* Večerja */}
                    {availableSlots.filter(s => s.time >= '15:00').length > 0 && (
                      <>
                        <div className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-3">Večerja</div>
                        {availableSlots.filter(s => s.time >= '15:00').map(slot => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                              selectedTime === slot.time
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : slot.available
                                  ? 'bg-muted hover:bg-muted/80'
                                  : 'bg-muted/50 text-muted-foreground line-through cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Desno: Podatki stranke */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" /> Vaši podatki
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium flex items-center gap-1">
                      Ime in priimek <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Janez Novak"
                      className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium flex items-center gap-1">
                      Telefon <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="+386 40 123 456"
                      className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">E-pošta</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="janez@email.si"
                      className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" /> Posebne želje
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Posebne želje</label>
                    <textarea
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                      placeholder="Otroški stol, ob oknu, rojstnodnevna torta, alergije..."
                      className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm min-h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Opombe</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Dodatne informacije..."
                      className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm min-h-16 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Povzetek */}
              <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-6 border-2 border-primary/20">
                <h3 className="font-bold mb-3">Povzetek rezervacije</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{selectedTime || 'Izberite termin'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</span>
                  </div>
                </div>
                <button
                  onClick={() => { if (isValid) setStep('confirm') }}
                  disabled={!isValid}
                  className="w-full mt-4 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Nadaljuj na potrditev
                </button>
              </div>
            </div>
          </div>
        ) : step === 'confirm' ? (
          /* ═══ POTRDITEV ═══ */
          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl p-8">
              <h2 className="font-bold text-xl mb-6 text-center">Potrditev rezervacije</h2>
              <div className="bg-primary/5 rounded-xl p-5 space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Datum</p>
                    <p className="font-bold">{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ura</p>
                    <p className="font-bold">{selectedTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Število oseb</p>
                    <p className="font-bold">{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ime in telefon</p>
                    <p className="font-bold">{customerName} · {customerPhone}</p>
                  </div>
                </div>
                {customerEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">E-pošta</p>
                      <p className="font-bold">{customerEmail}</p>
                    </div>
                  </div>
                )}
                {specialRequests && (
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Posebne želje</p>
                      <p className="font-bold">{specialRequests}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('details')} className="flex-1 py-3 rounded-xl border-2 font-bold hover:bg-muted transition-colors">
                  Nazaj
                </button>
                <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Pošiljam...' : 'Potrdi rezervacijo'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
