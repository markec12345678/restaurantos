'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/components/pos/PinLogin';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isVip: boolean;
  vipSince: string | null;
  allergens: string;
  dietaryPrefs: string;
  dislikes: string;
  favoriteItems: string;
  birthday: string | null;
  anniversary: string | null;
  company: string;
  notes: string;
  totalVisits: number;
  totalSpent: number;
  avgCheckAmount: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
  loyaltyAccount: any;
  visits: any[];
  orders: any[];
}

const DIETARY_OPTIONS = [
  'Vegetarijansko', 'Vegansko', 'Brez glutena', 'Brez laktoze', 'Halal', 'Košer', 'Peskarijansko'
];

const ALLERGEN_LIST = [
  '1-Žita', '2-Raki', '3-Jajca', '4-Ribe', '5-Arašidi', '6-Soja', '7-Mleko',
  '8-Oreški', '9-Zeler', '10-Gorčica', '11-Sesam', '12-Žveplov dioksid', '13-Volčji bob', '14-Mehkužci'
];

export default function GuestManager() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [tab, setTab] = useState<'list' | 'detail'>('list');

  const fetchGuests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (vipOnly) params.set('vip', 'true');
      const res = await authFetch(`/api/guests?${params}`);
      const data = await res.json();
      setGuests(Array.isArray(data?.guests) ? data.guests : []);
      setTotal(data?.total || 0);
    } catch (e) {
      console.error('Error fetching guests:', e);
    }
  }, [search, vipOnly]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  async function createGuest() {
    try {
      const res = await authFetch('/api/guests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({});
        fetchGuests();
      }
    } catch (e) {
      console.error('Error creating guest:', e);
    }
  }

  async function updateGuest(id: string, data: any) {
    try {
      const res = await authFetch(`/api/guests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedGuest?.id === id) setSelectedGuest(updated);
        fetchGuests();
      }
    } catch (e) {
      console.error('Error updating guest:', e);
    }
  }

  async function selectGuest(id: string) {
    try {
      const res = await authFetch(`/api/guests/${id}`);
      const data = await res.json();
      setSelectedGuest(data);
      setTab('detail');
    } catch (e) {
      console.error('Error fetching guest:', e);
    }
  }

  function parseJsonField(field: string): string[] {
    try { return JSON.parse(field || '[]'); } catch { return []; }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">👥 Gost CRM</h2>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{total} gostov</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVipOnly(!vipOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              vipOnly ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👑 VIP
          </button>
          <button
            onClick={() => { setShowForm(true); setForm({ firstName: '', lastName: '', phone: '', email: '', allergens: [], dietaryPrefs: [], dislikes: [], favoriteItems: [] }); }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Nov gost
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Išči po imenu, telefonu, emailu..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Guest List */}
        <div className={`${tab === 'detail' ? 'w-1/3 border-r' : 'w-full'} overflow-y-auto`}>
          {guests.map(guest => (
            <div
              key={guest.id}
              onClick={() => selectGuest(guest.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition ${
                selectedGuest?.id === guest.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  guest.isVip ? 'bg-amber-500' : 'bg-gray-400'
                }`}>
                  {guest.isVip ? '👑' : (guest.firstName?.[0] || '') + (guest.lastName?.[0] || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm truncate">
                      {guest.firstName} {guest.lastName}
                    </span>
                    {guest.isVip && <span className="text-amber-500 text-xs">VIP</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {guest.totalVisits} obiskov • €{guest.totalSpent.toFixed(0)} skupaj
                  </div>
                </div>
                {guest.lastVisitAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(guest.lastVisitAt).toLocaleDateString('sl-SI')}
                  </span>
                )}
              </div>
              {/* Quick tags */}
              <div className="flex flex-wrap gap-1 mt-1 ml-11">
                {parseJsonField(guest.allergens).length > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠️ Alergeni</span>
                )}
                {parseJsonField(guest.dietaryPrefs).map((p: string) => (
                  <span key={p} className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{p}</span>
                ))}
              </div>
            </div>
          ))}
          {guests.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">👥</p>
              <p>Ni gostov. Dodajte prvega!</p>
            </div>
          )}
        </div>

        {/* Guest Detail */}
        {tab === 'detail' && selectedGuest && (
          <div className="w-2/3 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setTab('list')} className="text-gray-400 hover:text-gray-600">← Nazaj</button>
                <h3 className="text-lg font-bold">{selectedGuest.firstName} {selectedGuest.lastName}</h3>
                <button
                  onClick={() => updateGuest(selectedGuest.id, { isVip: !selectedGuest.isVip })}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedGuest.isVip ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {selectedGuest.isVip ? '👑 VIP' : 'Označi VIP'}
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{selectedGuest.totalVisits}</p>
                <p className="text-xs text-blue-500">Obiski</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">€{selectedGuest.totalSpent.toFixed(0)}</p>
                <p className="text-xs text-green-500">Skupaj</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">€{selectedGuest.avgCheckAmount.toFixed(2)}</p>
                <p className="text-xs text-purple-500">Povpr. ček</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {selectedGuest.loyaltyAccount?.pointsBalance || 0}
                </p>
                <p className="text-xs text-amber-500">Točke</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">KONTAKT</h4>
                <p className="text-sm">📧 {selectedGuest.email || '-'}</p>
                <p className="text-sm">📱 {selectedGuest.phone || '-'}</p>
                <p className="text-sm">🏢 {selectedGuest.company || '-'}</p>
              </div>
              <div className="bg-white border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">DATUMI</h4>
                <p className="text-sm">🎂 {selectedGuest.birthday ? new Date(selectedGuest.birthday).toLocaleDateString('sl-SI') : '-'}</p>
                <p className="text-sm">💍 {selectedGuest.anniversary ? new Date(selectedGuest.anniversary).toLocaleDateString('sl-SI') : '-'}</p>
                <p className="text-sm">📅 Prvi obisk: {selectedGuest.firstVisitAt ? new Date(selectedGuest.firstVisitAt).toLocaleDateString('sl-SI') : '-'}</p>
              </div>
            </div>

            {/* Allergens & Preferences */}
            <div className="bg-white border rounded-lg p-3 mb-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">ALERGENI & PREFERENCE</h4>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {parseJsonField(selectedGuest.allergens).map((a: string) => (
                  <span key={a} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">⚠️ {a}</span>
                ))}
                {parseJsonField(selectedGuest.allergens).length === 0 && (
                  <span className="text-xs text-gray-400">Bez alergenov</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {parseJsonField(selectedGuest.dietaryPrefs).map((p: string) => (
                  <span key={p} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">🥬 {p}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parseJsonField(selectedGuest.dislikes).map((d: string) => (
                  <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">👎 {d}</span>
                ))}
              </div>
            </div>

            {/* Favorite Items */}
            <div className="bg-white border rounded-lg p-3 mb-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">NAJLJUBŠE JEDI</h4>
              <div className="flex flex-wrap gap-1.5">
                {parseJsonField(selectedGuest.favoriteItems).map((item: string) => (
                  <span key={item} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">❤️ {item}</span>
                ))}
                {parseJsonField(selectedGuest.favoriteItems).length === 0 && (
                  <span className="text-xs text-gray-400">Ni zaznanih preferenc</span>
                )}
              </div>
            </div>

            {/* Recent Visits */}
            <div className="bg-white border rounded-lg p-3 mb-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">ZADNJI OBISKI</h4>
              {selectedGuest.visits?.slice(0, 5).map((visit: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <span className="text-sm">{new Date(visit.arrivedAt).toLocaleDateString('sl-SI')}</span>
                    {visit.employeeName && <span className="text-xs text-gray-400 ml-2"> Strežil: {visit.employeeName}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">€{visit.totalSpent.toFixed(2)}</span>
                    {visit.feedbackScore && <span className="text-xs text-amber-500 ml-2">{'⭐'.repeat(visit.feedbackScore)}</span>}
                  </div>
                </div>
              ))}
              {(!selectedGuest.visits || selectedGuest.visits.length === 0) && (
                <p className="text-xs text-gray-400">Ni zabeleženih obiskov</p>
              )}
            </div>

            {/* Notes */}
            {selectedGuest.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-yellow-700 mb-1">📝 Opombe</h4>
                <p className="text-sm text-yellow-800">{selectedGuest.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Guest Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">Nov gost</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Ime</label>
                  <input
                    value={form.firstName || ''}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="Ime"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Priimek *</label>
                  <input
                    value={form.lastName || ''}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="Priimek"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Telefon</label>
                  <input
                    value={form.phone || ''}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="+386 ..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Email</label>
                  <input
                    value={form.email || ''}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="email@primer.si"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Podjetje</label>
                <input
                  value={form.company || ''}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Rojstni dan</label>
                  <input
                    type="date"
                    value={form.birthday || ''}
                    onChange={e => setForm({ ...form, birthday: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Obletnica</label>
                  <input
                    type="date"
                    value={form.anniversary || ''}
                    onChange={e => setForm({ ...form, anniversary: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Alergeni</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ALLERGEN_LIST.map(a => {
                    const code = a.split('-')[0];
                    const selected = (form.allergens || []).includes(code);
                    return (
                      <button
                        key={code}
                        onClick={() => setForm({
                          ...form,
                          allergens: selected
                            ? form.allergens.filter((x: string) => x !== code)
                            : [...(form.allergens || []), code],
                        })}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                          selected ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Prehranske preference</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DIETARY_OPTIONS.map(pref => {
                    const selected = (form.dietaryPrefs || []).includes(pref);
                    return (
                      <button
                        key={pref}
                        onClick={() => setForm({
                          ...form,
                          dietaryPrefs: selected
                            ? form.dietaryPrefs.filter((x: string) => x !== pref)
                            : [...(form.dietaryPrefs || []), pref],
                        })}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                          selected ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {pref}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Opombe</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  rows={2}
                  placeholder="Posebne želje, preference sedeža..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isVip || false}
                  onChange={e => setForm({ ...form, isVip: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm font-medium">👑 VIP gost</label>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Prekliči
              </button>
              <button
                onClick={createGuest}
                disabled={!form.lastName}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Shrani gosta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
