'use client'

// ============================================
// DIALOG ZA NOVO/UREDI REZERVACIJO
// ============================================

import { memo, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { timeSlots, sourceLabels } from './constants'
import type { ReservationDialogProps } from './constants'

export const ReservationDialog = memo(function ReservationDialog({
  open,
  onClose,
  reservation,
  tables,
  selectedDate,
  onSave,
}: ReservationDialogProps) {
  const isEditing = !!reservation

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [tableId, setTableId] = useState('')
  const [date, setDate] = useState(format(selectedDate, 'yyyy-MM-dd'))
  const [time, setTime] = useState('19:00')
  const [partySize, setPartySize] = useState(2)
  const [duration, setDuration] = useState(120)
  const [notes, setNotes] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [source, setSource] = useState('walk_in')

  // Napolni ob urejanju
  const resetForm = useCallback(() => {
    if (reservation) {
      setCustomerName(reservation.customerName)
      setCustomerPhone(reservation.customerPhone)
      setCustomerEmail(reservation.customerEmail)
      setTableId(reservation.tableId || '')
      const dt = new Date(reservation.dateTime)
      setDate(format(dt, 'yyyy-MM-dd'))
      setTime(format(dt, 'HH:mm'))
      setPartySize(reservation.partySize)
      setDuration(reservation.duration)
      setNotes(reservation.notes)
      setSpecialRequests(reservation.specialRequests)
      setSource(reservation.source)
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setTableId('')
      setDate(format(selectedDate, 'yyyy-MM-dd'))
      setTime('19:00')
      setPartySize(2)
      setDuration(120)
      setNotes('')
      setSpecialRequests('')
      setSource('walk_in')
    }
  }, [reservation, selectedDate])

  // Ko se dialog odpre
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }, [resetForm, onClose])

  const handleSave = useCallback(() => {
    if (!customerName || !partySize) {
      toast.error('Ime in število oseb sta obvezna')
      return
    }

    const dateTime = new Date(`${date}T${time}:00`)

    onSave({
      customerName,
      customerPhone,
      customerEmail,
      tableId: tableId || null,
      dateTime: dateTime.toISOString(),
      partySize,
      duration,
      notes,
      specialRequests,
      source,
    })
  }, [customerName, partySize, date, time, customerPhone, customerEmail, tableId, duration, notes, specialRequests, source, onSave])

  // Primerno mize glede na kapaciteto
  const suitableTables = useMemo(() => tables
    .filter(t => t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity), [tables, partySize])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi rezervacijo' : 'Nova rezervacija'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stranka */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Podatki stranke</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="res-customer-name" className="text-xs font-medium">Ime in priimek *</label>
                <Input id="res-customer-name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm" aria-label="Janez Novak" autoFocus/>
              </div>
              <div>
                <label htmlFor="res-customer-phone" className="text-xs font-medium">Telefon</label>
                <Input id="res-customer-phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+386 40 123 456" className="h-9 text-sm" aria-label="+386 40 123 456"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="res-customer-email" className="text-xs font-medium">E-pošta</label>
                <Input id="res-customer-email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="janez@email.si" className="h-9 text-sm" aria-label="janez@email.si"/>
              </div>
              <div>
                <label htmlFor="res-source" className="text-xs font-medium">Vir</label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger id="res-source" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Čas in miza */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Čas in miza</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label htmlFor="res-date" className="text-xs font-medium">Datum</label>
                <Input id="res-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label htmlFor="res-time" className="text-xs font-medium">Ura</label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger id="res-time" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="res-party-size" className="text-xs font-medium">Oseb *</label>
                <Input id="res-party-size" type="number" min={1} max={20} value={partySize} onChange={e => setPartySize(parseInt(e.target.value) || 1)} className="h-9 text-sm" />
              </div>
              <div>
                <label htmlFor="res-duration" className="text-xs font-medium">Trajanje (min)</label>
                <Select value={String(duration)} onValueChange={v => setDuration(parseInt(v))}>
                  <SelectTrigger id="res-duration" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 ura</SelectItem>
                    <SelectItem value="90">1.5 ure</SelectItem>
                    <SelectItem value="120">2 uri</SelectItem>
                    <SelectItem value="150">2.5 ure</SelectItem>
                    <SelectItem value="180">3 ure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label htmlFor="res-table" className="text-xs font-medium">Miza (primernih: {suitableTables.length})</label>
              <Select value={tableId || 'none'} onValueChange={(v) => setTableId(v === 'none' ? '' : v)}>
                <SelectTrigger id="res-table" className="h-9 text-sm">
                  <SelectValue placeholder="Izberi mizo ali pusti prazno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brez mize</SelectItem>
                  {suitableTables.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      Miza {t.number} ({t.capacity} mest) — {t.area}
                    </SelectItem>
                  ))}
                  {suitableTables.length === 0 && partySize > 0 && (
                    <SelectItem value="no-tables" disabled>Ni primernih miz za {partySize} oseb</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Opombe */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opombe</p>
            <div>
              <label htmlFor="res-special-requests" className="text-xs font-medium">Posebne želje</label>
              <Textarea id="res-special-requests" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Otroški stol, ob oknu, rojstnodnevna torta..." className="text-sm min-h-16" aria-label="Otroški stol, ob oknu, rojstnodnevna torta"/>
            </div>
            <div>
              <label htmlFor="res-notes" className="text-xs font-medium">Interne opombe</label>
              <Textarea id="res-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergije, VIP gost, pogosto naroča..." className="text-sm min-h-16" aria-label="Alergije, VIP gost, pogosto naroča"/>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari rezervacijo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
