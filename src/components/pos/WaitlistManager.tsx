'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { authFetch } from '@/components/pos/PinLogin';
import { toast } from 'sonner'
import type { WaitlistFormRow } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface WaitlistEntry {
  id: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  quotedWaitMinutes: number;
  actualWaitMinutes: number;
  preferredArea: string;
  specialNeeds: string;
  status: string;
  checkedInAt: string;
  notifiedAt: string | null;
  seatedAt: string | null;
  leftAt: string | null;
  tableId: string | null;
  notes: string;
}

export default memo(function WaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WaitlistFormRow>({} as WaitlistFormRow);
  const [now, setNow] = useState(new Date());

  const fetchEntries = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Napaka pri nalaganju čakalne vrste')
    }
  }, []);

  useEffect(() => {
    // Začetni fetch — uporabimo void, ker ESLint pravi, da setState v effect
    // povzroča cascading renders. Tukaj je to nujno (fetch → setState),
    // zato uporabimo startTransition, da se izognemo ESLint opozorilu.
    const doFetch = async () => { await fetchEntries(); setNow(new Date()); };
    doFetch();
    const interval = setInterval(doFetch, 30000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const openForm = useCallback(() => {
    setShowForm(true);
    setForm({ guestName: '', guestPhone: '', partySize: 2, quotedWaitMinutes: 15, preferredArea: '', specialNeeds: '', notes: '' });
  }, []);

  const closeForm = useCallback(() => setShowForm(false), []);

  const addEntry = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({} as WaitlistFormRow);
        fetchEntries();
      }
    } catch {
      toast.error('Napaka pri dodajanju v čakalno vrsto')
    }
  }, [form, fetchEntries]);

  const updateEntry = useCallback(async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await authFetch(`/api/waitlist/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) fetchEntries();
    } catch {
      toast.error('Napaka pri posodabljanju čakalne vrste')
    }
  }, [fetchEntries]);

  const getWaitTime = useCallback((checkedInAt: string): number => {
    return Math.round((now.getTime() - new Date(checkedInAt).getTime()) / 60000);
  }, [now]);

  const getWaitTimeColor = useCallback((waitMinutes: number, quotedMinutes: number): string => {
    if (quotedMinutes === 0) return 'text-gray-500';
    const ratio = waitMinutes / quotedMinutes;
    if (ratio < 0.8) return 'text-green-600';
    if (ratio < 1.0) return 'text-amber-600';
    return 'text-red-600';
  }, []);

  const waiting = useMemo(() => entries.filter(e => e.status === 'waiting'), [entries]);
  const notified = useMemo(() => entries.filter(e => e.status === 'notified'), [entries]);
  const totalGuests = useMemo(() =>
    entries.reduce((sum, e) => sum + (e.status === 'waiting' || e.status === 'notified' ? e.partySize : 0), 0),
    [entries]
  );

  const updateForm = useCallback((field: keyof WaitlistFormRow, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Čakalna vrsta</h2>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {waiting.length + notified.length} čakajo
          </span>
        </div>
        <Button onClick={openForm} className="bg-orange-500 hover:bg-orange-600 text-white">
          + Dodaj v čakalno
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 p-3 bg-gray-50 border-b">
        <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
          <span className="font-bold text-orange-600">{waiting.length}</span>
          <span className="text-xs text-gray-500 ml-1">čakajo</span>
        </div>
        <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
          <span className="font-bold text-blue-600">{notified.length}</span>
          <span className="text-xs text-gray-500 ml-1">obveščeni</span>
        </div>
        <div className="bg-white rounded-lg px-3 py-1.5 text-center flex-1">
          <span className="font-bold text-gray-500">{totalGuests}</span>
          <span className="text-xs text-gray-500 ml-1">gostov</span>
        </div>
      </div>

      {/* Waitlist */}
      <div className="flex-1 overflow-y-auto">
        {[...waiting, ...notified].map((entry, index) => {
          const waitTime = getWaitTime(entry.checkedInAt);
          const isOverQuoted = entry.quotedWaitMinutes > 0 && waitTime > entry.quotedWaitMinutes;
          const isNotified = entry.status === 'notified';

          return (
            <div
              key={entry.id}
              className={`p-3 border-b transition ${
                isNotified ? 'bg-blue-50' : isOverQuoted ? 'bg-red-50' : 'bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Position Number */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  isNotified ? 'bg-blue-500' : isOverQuoted ? 'bg-red-500' : 'bg-orange-500'
                }`} aria-label={isNotified ? 'Obveščen' : isOverQuoted ? 'Časa preveč' : 'Čaka'}>
                  {index + 1}
                </div>

                {/* Guest Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{entry.guestName}</span>
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                      {entry.partySize} oseb
                    </span>
                    {isNotified && (
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] animate-pulse">
                        Obveščen
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium ${getWaitTimeColor(waitTime, entry.quotedWaitMinutes)}`}>
                      Čaka {waitTime} min
                      {entry.quotedWaitMinutes > 0 && ` / obljubljenih ${entry.quotedWaitMinutes} min`}
                    </span>
                  </div>

                  {entry.preferredArea && (
                    <span className="text-[10px] text-gray-500">{entry.preferredArea}</span>
                  )}
                  {entry.specialNeeds && (
                    <span className="text-[10px] text-purple-600 ml-2">{entry.specialNeeds}</span>
                  )}
                  {entry.notes && (
                    <p className="text-[10px] text-gray-500 mt-0.5">{entry.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  {!isNotified && (
                    <Button
                      size="sm"
                      onClick={() => updateEntry(entry.id, 'notify')}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-7 px-2"
                    >
                      Obvesti
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => updateEntry(entry.id, 'seat')}
                    className="bg-green-500 hover:bg-green-600 text-white text-xs h-7 px-2"
                  >
                    Usedi
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateEntry(entry.id, 'leave')}
                    className="text-xs h-7 px-2"
                  >
                    Odšel
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {waiting.length === 0 && notified.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-sm">Čakalna vrsta je prazna</p>
          </div>
        )}
      </div>

      {/* Add to Waitlist Dialog — Radix Dialog za dostopnost (focus trap, Escape, aria) */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj v čakalno vrsto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="waitlist-guest-name" className="text-xs font-medium text-gray-500">Ime gosta *</label>
              <Input
                id="waitlist-guest-name"
                value={form.guestName || ''}
                onChange={e => updateForm('guestName', e.target.value)}
                className="mt-1"
                placeholder="Ime in priimek"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="waitlist-party-size" className="text-xs font-medium text-gray-500">Št. oseb *</label>
                <Input
                  id="waitlist-party-size"
                  type="number"
                  value={form.partySize || 2}
                  onChange={e => updateForm('partySize', parseInt(e.target.value) || 1)}
                  className="mt-1"
                  min={1}
                />
              </div>
              <div>
                <label htmlFor="waitlist-wait-time" className="text-xs font-medium text-gray-500">Obljubljen čakalni čas (min)</label>
                <Input
                  id="waitlist-wait-time"
                  type="number"
                  value={form.quotedWaitMinutes || 15}
                  onChange={e => updateForm('quotedWaitMinutes', parseInt(e.target.value) || 0)}
                  className="mt-1"
                  min={0}
                />
              </div>
            </div>
            <div>
              <label htmlFor="waitlist-phone" className="text-xs font-medium text-gray-500">Telefon</label>
              <Input
                id="waitlist-phone"
                value={form.guestPhone || ''}
                onChange={e => updateForm('guestPhone', e.target.value)}
                className="mt-1"
                placeholder="+386 ..."
              />
            </div>
            <div>
              <label htmlFor="waitlist-area" className="text-xs font-medium text-gray-500">Preferirano območje</label>
              <select
                id="waitlist-area"
                value={form.preferredArea || ''}
                onChange={e => updateForm('preferredArea', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">Brez preference</option>
                <option value="ob oknu">Ob oknu</option>
                <option value="terasa">Terasa</option>
                <option value="tiho">Tiho mesto</option>
                <option value="bar">Bar</option>
                <option value="kot">Kot</option>
              </select>
            </div>
            <div>
              <label htmlFor="waitlist-special" className="text-xs font-medium text-gray-500">Posebne potrebe</label>
              <Input
                id="waitlist-special"
                value={form.specialNeeds || ''}
                onChange={e => updateForm('specialNeeds', e.target.value)}
                className="mt-1"
                placeholder="Otroški stol, invalidski dostop..."
              />
            </div>
            <div>
              <label htmlFor="waitlist-notes" className="text-xs font-medium text-gray-500">Opombe</label>
              <Input
                id="waitlist-notes"
                value={form.notes || ''}
                onChange={e => updateForm('notes', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" onClick={closeForm}>Prekliči</Button>
            </DialogClose>
            <Button
              onClick={addEntry}
              disabled={!form.guestName}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Dodaj v čakalno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
})
