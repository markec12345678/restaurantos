'use client'

import { memo, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { ReservationDialogProps } from './constants'
import { CustomerInfoFields } from './CustomerInfoFields'
import { DateTimeTableFields } from './DateTimeTableFields'
import { NotesFields } from './NotesFields'

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
      setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setTableId('')
      setDate(format(selectedDate, 'yyyy-MM-dd')); setTime('19:00')
      setPartySize(2); setDuration(120); setNotes(''); setSpecialRequests(''); setSource('walk_in')
    }
  }, [reservation, selectedDate])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }, [resetForm, onClose])

  const handleSave = useCallback(() => {
    if (!customerName || !partySize) { toast.error('Ime in število oseb sta obvezna'); return }
    const dateTime = new Date(`${date}T${time}:00`)
    onSave({
      customerName, customerPhone, customerEmail, tableId: tableId || null,
      dateTime: dateTime.toISOString(), partySize, duration, notes, specialRequests, source,
    })
  }, [customerName, partySize, date, time, customerPhone, customerEmail, tableId, duration, notes, specialRequests, source, onSave])

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
          <CustomerInfoFields
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
            customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
            source={source} setSource={setSource}
          />
          <DateTimeTableFields
            date={date} setDate={setDate}
            time={time} setTime={setTime}
            partySize={partySize} setPartySize={setPartySize}
            duration={duration} setDuration={setDuration}
            tableId={tableId} setTableId={setTableId}
            suitableTables={suitableTables}
          />
          <NotesFields
            specialRequests={specialRequests} setSpecialRequests={setSpecialRequests}
            notes={notes} setNotes={setNotes}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>{isEditing ? 'Shrani spremembe' : 'Ustvari rezervacijo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
