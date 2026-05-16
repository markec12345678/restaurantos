'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/components/pos/PinLogin';

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

export default function WaitlistManager() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [now, setNow] = useState(new Date());

  const fetchEntries = useCallback(async () => {
    try {
      const res = await authFetch('/api/waitlist');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching waitlist:', e);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(() => {
      fetchEntries();
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  async function addEntry() {
    try {
      const res = await authFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({});
        fetchEntries();
      }
    } catch (e) {
      console.error('Error adding entry:', e);
    }
  }

  async function updateEntry(id: string, action: string, extra?: any) {
    try {
      const res = await authFetch(`/api/waitlist/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) fetchEntries();
    } catch (e) {
      console.error('Error updating entry:', e);
    }
  }

  function getWaitTime(checkedInAt: string): number {
    return Math.round((now.getTime() - new Date(checkedInAt).getTime()) / 60000);
  }

  function getWaitTimeColor(waitMinutes: number, quotedMinutes: number): string {
    if (quotedMinutes === 0) return 'text-gray-500';
    const ratio = waitMinutes / quotedMinutes;
    if (ratio < 0.8) return 'text-green-600';
    if (ratio < 1.0) return 'text-amber-600';
    return 'text-red-600';
  }

  const waiting = entries.filter(e => e.status === 'waiting');
  const notified = entries.filter(e => e.status === 'notified');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">📋 Čakalna vrsta</h2>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {waiting.length + notified.length} čakajo
          </span>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setForm({ guestName: '', guestPhone: '', partySize: 2, quotedWaitMinutes: 15, preferredArea: '', specialNeeds: '', notes: '' });
          }}
          className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          + Dodaj v čakalno
        </button>
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
          <span className="font-bold text-gray-400">
            {entries.reduce((sum, e) => sum + (e.status === 'waiting' || e.status === 'notified' ? e.partySize : 0), 0)}
          </span>
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
                }`}>
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
                        📱 Obveščen
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
                    <span className="text-[10px] text-gray-500">📍 {entry.preferredArea}</span>
                  )}
                  {entry.specialNeeds && (
                    <span className="text-[10px] text-purple-600 ml-2">♿ {entry.specialNeeds}</span>
                  )}
                  {entry.notes && (
                    <p className="text-[10px] text-gray-400 mt-0.5">📝 {entry.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  {!isNotified && (
                    <button
                      onClick={() => updateEntry(entry.id, 'notify')}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600"
                    >
                      📱 Obvesti
                    </button>
                  )}
                  <button
                    onClick={() => updateEntry(entry.id, 'seat')}
                    className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-600"
                  >
                    🪑 Usedi
                  </button>
                  <button
                    onClick={() => updateEntry(entry.id, 'leave')}
                    className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-medium hover:bg-gray-400"
                  >
                    Odšel
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {waiting.length === 0 && notified.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-sm">Čakalna vrsta je prazna</p>
          </div>
        )}
      </div>

      {/* Add to Waitlist Form */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">Dodaj v čakalno vrsto</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Ime gosta *</label>
                <input
                  value={form.guestName || ''}
                  onChange={e => setForm({ ...form, guestName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="Ime in priimek"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Št. oseb *</label>
                  <input
                    type="number"
                    value={form.partySize || 2}
                    onChange={e => setForm({ ...form, partySize: parseInt(e.target.value) || 1 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Obljubljen čakalni čas (min)</label>
                  <input
                    type="number"
                    value={form.quotedWaitMinutes || 15}
                    onChange={e => setForm({ ...form, quotedWaitMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Telefon</label>
                <input
                  value={form.guestPhone || ''}
                  onChange={e => setForm({ ...form, guestPhone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="+386 ..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Preferirano območje</label>
                <select
                  value={form.preferredArea || ''}
                  onChange={e => setForm({ ...form, preferredArea: e.target.value })}
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
                <label className="text-xs font-medium text-gray-500">Posebne potrebe</label>
                <input
                  value={form.specialNeeds || ''}
                  onChange={e => setForm({ ...form, specialNeeds: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="Otroški stol, invalidski dostop..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Opombe</label>
                <input
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">
                Prekliči
              </button>
              <button
                onClick={addEntry}
                disabled={!form.guestName}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                Dodaj v čakalno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
