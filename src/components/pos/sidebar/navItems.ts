// ============================================
// NAVIGACIJSKI ELEMENTI ZA SIDEBAR — IA runda (P0 korak 4, R174)
// ============================================
//
// DERIVIRAN adapter iz centralnega registra (src/lib/modules/registry.ts):
//   - navItems = MODULE_REGISTRY.map(...) — id/labelKey/access/highlight
//     prihajajo iz registerja; register je VIR RESNICE (§6, epic #144).
//   - navGroups = MODULE_GROUPS.map(...) — label/labelKey iz registerja,
//     itemIds = registry člani sortirani po groupOrder (navGroups sodba
//     intra-group reda, PINANO z drift-gate element-wise).
//   - NAV_ICONS = edini adapter string→lucide komponenta (register ostane
//     pure lib brez lucide importov). Ključi ≡ registry.icon (drift-gate).
//
// Nov modul = ENA vrstica v registerju (+ ikona v NAV_ICONS če nova,
// + nav.* ključ ×5 jezikov, + moduleComponents lazy map). Sidebar in
// CommandPalette ostajata klicatelja tega adapterja — brez ročnih seznamov.
// Zgodovinski komentarji sodbe (R129/R137/R141-c ...) živijo v worklogu
// in git zgodovini; semantične sodbe so prenesene v registry polja.
// ============================================

import type { ComponentType } from 'react'
import {
  LayoutDashboard, ShoppingCart, ChefHat, BarChartBig, UtensilsCrossed, Package, Users,
  BarChart3, Wallet, Settings, SlidersHorizontal, Truck, CreditCard,
  Award, Printer, Webhook, CalendarDays, Bike,
  Brain, LayoutGrid, Calendar, UserCircle, Sparkles,
  Calculator, ClipboardList, Factory, Plug, MapPin, CalendarClock, Layers,
  MessageSquare, Target, FileText, HandCoins, Navigation, Timer, Trophy, Bell,
  ShieldAlert, Receipt, ClipboardCheck, BellRing, PieChart, Activity, Table2, CloudOff,
  CookingPot, Scale, Star, Trash2, Scale3d, Store, ShieldCheck, BookOpen, GitBranch, Nfc,
  Sunrise,
  // R175 (epic #144 P0-01): Danes kokpit
  Home,
  // R142-c (epic #115 #29): Center naprav
  MonitorSmartphone,
  // R147-c (epic #115 #34): Prenos podatkov
  DatabaseBackup,
  // R149-c (epic #115 #36): Napredna analitika
  TrendingUp,
} from 'lucide-react'

import {
  MODULE_REGISTRY,
  MODULE_GROUPS,
  MODULE_IDS,
} from '@/lib/modules/registry'

export interface NavItem {
  id: string
  labelKey: string
  icon: ComponentType<{ className?: string }>
  highlight?: boolean
  permission?: string
  adminOnly?: boolean
}

/* QA runda 5 (styling): 69 navigacijskih elementov v ENEM seznamu je bilo
   vizualna preobremenitev (tablet UX). Elementi so zdaj grupirani v 7
   logičnih sekcij z zložljivimi glavami (glej SidebarNav.tsx). */
export interface NavGroup {
  id: string
  label: string
  /** i18n ključ skupinske glave (≡ MODULE_GROUPS.labelKey, R174) */
  labelKey: string
  itemIds: string[]
}

/**
 * Ikone: registry.icon IME → lucide komponenta (client adapter).
 * 60 unikatnih ikon za 75 modulov; drift-gate uveljavlja pokritost
 * (vsak registry.icon ima vnos) + unikatni nabor ≡ registry.icon nabor.
 */
export const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  ShoppingCart,
  ChefHat,
  LayoutGrid,
  BarChartBig,
  ClipboardList,
  Wallet,
  CalendarDays,
  CalendarClock,
  Layers,
  LayoutDashboard,
  UserCircle,
  UtensilsCrossed,
  Calculator,
  Package,
  Factory,
  Brain,
  BookOpen,
  Calendar,
  Trophy,
  Bell,
  ShieldAlert,
  Receipt,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Users,
  Target,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Sunrise,
  Home,
  MonitorSmartphone,
  DatabaseBackup,
  SlidersHorizontal,
  Truck,
  Navigation,
  Bike,
  HandCoins,
  Timer,
  Store,
  Award,
  Printer,
  Webhook,
  Plug,
  MapPin,
  CreditCard,
  BellRing,
  Activity,
  PieChart,
  Table2,
  CookingPot,
  Scale,
  Star,
  Sparkles,
  Trash2,
  Scale3d,
  GitBranch,
  CloudOff,
  Nfc,
  Settings,
}

/** Register index (default intra-group red = register red ≡ navItems flat red) */
const REG_INDEX: ReadonlyMap<string, number> = new Map(
  MODULE_IDS.map((id, i) => [id, i] as const),
)

/** Deriviran iz registerja — ročni seznam NE SME obstajati (§6 IA, R174) */
export const navItems: NavItem[] = MODULE_REGISTRY.map((meta) => ({
  id: meta.id,
  labelKey: meta.labelKey,
  icon: NAV_ICONS[meta.icon],
  highlight: meta.highlight,
  permission: meta.permission,
  adminOnly: meta.adminOnly,
}))

/** Deriviran iz registerja — itemIds = člani po groupOrder (drift-gate pin) */
export const navGroups: NavGroup[] = MODULE_GROUPS.map((g) => ({
  id: g.id,
  label: g.label,
  labelKey: g.labelKey,
  itemIds: MODULE_REGISTRY
    .filter((m) => m.group === g.id)
    .sort((a, b) => (a.groupOrder ?? REG_INDEX.get(a.id) ?? 0) - (b.groupOrder ?? REG_INDEX.get(b.id) ?? 0))
    .map((m) => m.id),
}))
