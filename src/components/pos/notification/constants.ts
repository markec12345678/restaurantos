// ============================================
// DELJENI TIPI IN KONSTANTE ZA UPRAVITELJA OBVESTIL
// ============================================

import { Bell, Mail, Phone } from 'lucide-react'

// Tip obvestila
export interface NotificationItem {
  id: string
  action: string
  entityType: string
  details: Record<string, unknown>
  timestamp: string | Date
}

// Tip statistike obvestil
export interface NotificationStats {
  totalSent: number
  totalFailed: number
  byType: { sms: number; email: number; push: number }
}

// Tip obrazca za pošiljanje
export interface SendFormState {
  channel: string
  recipient: string
  subject: string
  message: string
}

// Privzeto stanje obrazca
export const defaultSendForm: SendFormState = {
  channel: 'sms',
  recipient: '',
  subject: '',
  message: '',
}

// Ikone kanalov
export const channelIcons: Record<string, typeof Phone> = { sms: Phone, email: Mail, push: Bell }

// Oznake kanalov
export const channelLabels: Record<string, string> = { sms: 'SMS', email: 'E-pošta', push: 'Push' }

// Predloge obvestil
export const templates = [
  {
    name: 'Potrditev rezervacije',
    channel: 'sms',
    subject: '',
    message: 'Pozdravljeni! Vaša rezervacija je potrjena za {datum} ob {ura}. Lepo vabljeni! - {restavracija}',
  },
  {
    name: 'Naročilo v pripravi',
    channel: 'sms',
    subject: '',
    message: 'Vaše naročilo #{stevilka} je v pripravi. Predviden čas: {cas} min. - {restavracija}',
  },
  {
    name: 'Dostava na poti',
    channel: 'sms',
    subject: '',
    message: 'Vaše naročilo je na poti! Pričakujte dostavo v {cas} minutah. - {restavracija}',
  },
  {
    name: 'Opomnik rezervacije',
    channel: 'email',
    subject: 'Opomnik: Vaša rezervacija {datum}',
    message: 'Pozdravljeni! Opominjamo vas na rezervacijo za {datum} ob {ura} za {osebe} oseb. Lepo vabljeni!',
  },
  {
    name: 'Hvala za obisk',
    channel: 'email',
    subject: 'Hvala za vaš obisk!',
    message: 'Zahvaljujemo se vam za obisk! Upamo, da ste uživali. Vaše mnenje je pomembno: {povezava}',
  },
  {
    name: 'Promocija / Ponudba',
    channel: 'sms',
    subject: '',
    message: 'Samo danes! {ponudba}. Uporabite kodo {koda} za popust. - {restavracija}',
  },
]

// ============================================
// VMESNIKI ZA PROPS PODKOMPONENT
// ============================================

export interface NotificationStatsCardsProps {
  stats: NotificationStats | undefined
}

export interface NotificationTemplatesProps {
  onUseTemplate: (_form: SendFormState) => void
}

export interface NotificationHistoryProps {
  notifications: NotificationItem[]
}

export interface NotificationSendDialogProps {
  open: boolean
  sendForm: SendFormState
  isPending: boolean
  onOpenChange: (_open: boolean) => void
  onFormChange: (_form: SendFormState) => void
  onSend: () => void
}
