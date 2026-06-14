import { Thermometer, Sparkles, Truck, Snowflake, GraduationCap, ClipboardList } from 'lucide-react'

// ============================================
// KONSTANTE
// ============================================

export const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  temperature: { label: 'Temperature', icon: Thermometer, color: 'text-orange-600' },
  cleaning: { label: 'Čiščenje & dezinfekcija', icon: Sparkles, color: 'text-teal-600' },
  delivery: { label: 'Sprejem dobave', icon: Truck, color: 'text-blue-600' },
  cooling: { label: 'Hlajenje', icon: Snowflake, color: 'text-cyan-600' },
  training: { label: 'Izobraževanje', icon: GraduationCap, color: 'text-purple-600' },
}

export const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  ok: {
    label: 'V redu',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  warning: {
    label: 'Opozorilo',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  critical: {
    label: 'Kritično',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
}

export const statusBadgeStyles: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// Predloge za hitri vnos (pogosti HACCP kontrolni točki)
export const quickTemplates: Record<string, { title: string; value: string; category: string }[]> = {
  temperature: [
    { title: 'Hladilnik - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Zamrzovalnik - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Vroča hrana - kontrola temperature', value: '°C', category: 'temperature' },
    { title: 'Servisna miza - kontrola temperature', value: '°C', category: 'temperature' },
  ],
  cleaning: [
    { title: 'Dnevno čiščenje kuhinje', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Dezinfekcija delovnih površin', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Pranje posode - kontrola', value: 'Opravljeno', category: 'cleaning' },
    { title: 'Čiščenje sanitarij', value: 'Opravljeno', category: 'cleaning' },
  ],
  delivery: [
    { title: 'Sprejem dobave - kontrola temperature', value: '°C', category: 'delivery' },
    { title: 'Sprejem dobave - organoleptična kontrola', value: 'Ustreza', category: 'delivery' },
    { title: 'Sprejem dobave - rok uporabe', value: 'Ustreza', category: 'delivery' },
  ],
  cooling: [
    { title: 'Hlajenje kuhane hrane', value: '°C', category: 'cooling' },
    { title: 'Hladilna vitrina - kontrola', value: '°C', category: 'cooling' },
  ],
  training: [
    { title: 'Usposabljanje o osebni higieni', value: 'Zaključeno', category: 'training' },
    { title: 'Usposabljanje o HACCP načrtu', value: 'Zaključeno', category: 'training' },
    { title: 'Usposabljanje o alergenih', value: 'Zaključeno', category: 'training' },
  ],
}

export const tabItems = [
  { value: 'all', label: 'Vsi vnosi', icon: ClipboardList },
  { value: 'temperature', label: 'Temperature', icon: Thermometer },
  { value: 'cleaning', label: 'Čiščenje', icon: Sparkles },
  { value: 'delivery', label: 'Dobava', icon: Truck },
  { value: 'cooling', label: 'Hlajenje', icon: Snowflake },
  { value: 'training', label: 'Izobraževanje', icon: GraduationCap },
]
