import {
  Star, UtensilsCrossed,
  ThumbsUp, ThumbsDown, Coffee,
} from 'lucide-react'

export const CATEGORIES = [
  { id: 'food', label: 'Hrana', icon: Coffee },
  { id: 'service', label: 'Storitev', icon: ThumbsUp },
  { id: 'ambience', label: 'Ambient', icon: UtensilsCrossed },
  { id: 'cleanliness', label: 'Čistost', icon: Star },
  { id: 'value', label: 'Vrednost', icon: ThumbsDown },
]

export const QUICK_FEEDBACK = [
  'Odlična hrana!',
  'Zelo prijazno osebje',
  'Predolgo čakanje',
  'Hrana je bila hladna',
  'Čista in prijetna',
  'Previsoka cena',
  'Priporočam prijateljem',
  'Vrnem se znova',
]
