// =====================================================================
// QR Menu - Konstante in pomožne funkcije
// =====================================================================

import type { TimeOfDay } from './types';

// =====================================================================
// EU 1169/2011 - 14 ALERGENOV z barvnimi kodi in ikonami
// Vizualno poudarjeni skladno z EAA 2026 zahtevami
// =====================================================================
export const ALLERGEN_DATA: Record<string, { label: string; labelEn: string; icon: string; color: string; highContrastColor: string }> = {
  '1':  { label: 'Žita (gluten)', labelEn: 'Cereals (gluten)', icon: '🌾', color: 'bg-amber-100 text-amber-800 border-amber-300', highContrastColor: 'bg-yellow-300 text-black border-yellow-500' },
  '2':  { label: 'Raki', labelEn: 'Crustaceans', icon: '🦐', color: 'bg-red-100 text-red-800 border-red-300', highContrastColor: 'bg-red-400 text-white border-red-600' },
  '3':  { label: 'Jajca', labelEn: 'Eggs', icon: '🥚', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', highContrastColor: 'bg-yellow-300 text-black border-yellow-500' },
  '4':  { label: 'Ribe', labelEn: 'Fish', icon: '🐟', color: 'bg-blue-100 text-blue-800 border-blue-300', highContrastColor: 'bg-blue-400 text-white border-blue-600' },
  '5':  { label: 'Arašidi', labelEn: 'Peanuts', icon: '🥜', color: 'bg-orange-100 text-orange-800 border-orange-300', highContrastColor: 'bg-orange-400 text-white border-orange-600' },
  '6':  { label: 'Soja', labelEn: 'Soybeans', icon: '🫘', color: 'bg-green-100 text-green-800 border-green-300', highContrastColor: 'bg-green-400 text-white border-green-600' },
  '7':  { label: 'Mleko', labelEn: 'Milk', icon: '🥛', color: 'bg-sky-100 text-sky-800 border-sky-300', highContrastColor: 'bg-sky-300 text-black border-sky-500' },
  '8':  { label: 'Oreški', labelEn: 'Tree nuts', icon: '🌰', color: 'bg-amber-100 text-amber-800 border-amber-300', highContrastColor: 'bg-amber-400 text-black border-amber-600' },
  '9':  { label: 'Zeler', labelEn: 'Celery', icon: '🥬', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', highContrastColor: 'bg-emerald-400 text-white border-emerald-600' },
  '10': { label: 'Gorčica', labelEn: 'Mustard', icon: '🟡', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', highContrastColor: 'bg-yellow-400 text-black border-yellow-600' },
  '11': { label: 'Sezam', labelEn: 'Sesame', icon: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-300', highContrastColor: 'bg-gray-300 text-black border-gray-500' },
  '12': { label: 'SO₂ / Sulfiti', labelEn: 'Sulphites', icon: '💨', color: 'bg-purple-100 text-purple-800 border-purple-300', highContrastColor: 'bg-purple-400 text-white border-purple-600' },
  '13': { label: 'Volčji bob', labelEn: 'Lupin', icon: '🫘', color: 'bg-lime-100 text-lime-800 border-lime-300', highContrastColor: 'bg-lime-400 text-black border-lime-600' },
  '14': { label: 'Mehkužci', labelEn: 'Molluscs', icon: '🐚', color: 'bg-teal-100 text-teal-800 border-teal-300', highContrastColor: 'bg-teal-400 text-white border-teal-600' },
};

export const VAT_LABELS: Record<number, string> = {
  22: 'DDV 22%',
  9.5: 'DDV 9,5%',
  0: 'brez DDV',
};

// =====================================================================
// TIME-OF-DAY logika
// =====================================================================
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 11) return { key: 'morning', label: 'Zajtrk', icon: '🌅', promotedPrefix: ['Zajtrk', 'Kava', 'Vroče', 'Sadni'] };
  if (hour >= 11 && hour < 14) return { key: 'lunch', label: 'Kosilo', icon: '☀️', promotedPrefix: ['Juhe', 'Testenine', 'Dnevna', 'Rižote'] };
  if (hour >= 14 && hour < 17) return { key: 'afternoon', label: 'Popoldne', icon: '☕', promotedPrefix: ['Kava', 'Sladice', 'Koktajli', 'Deserti'] };
  if (hour >= 17 && hour < 22) return { key: 'evening', label: 'Večerja', icon: '🌙', promotedPrefix: ['Predjedi', 'Glavne', 'Jedi z žara', 'Steak', 'Vino'] };
  return { key: 'night', label: 'Pozna večerja', icon: '🌃', promotedPrefix: ['Burgerji', 'Koktajli', 'Pivo', 'Prigrizki'] };
}
