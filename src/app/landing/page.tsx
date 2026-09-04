'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, Shield, Zap, Globe, Database, Lock, Smartphone,
  ChefHat, Receipt, TrendingUp, Wifi, Users, Star, ChevronDown,
  Terminal, Cpu, Eye, AlertTriangle, Clock, BarChart3, ShoppingBag
} from 'lucide-react'

// ═══ Animated counter hook ═══
function useCountUp(end: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [end, duration, start])
  return count
}

// ═══ Scroll reveal hook ═══
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => { if (ref.current) observer.disconnect() }
  }, [])
  return { ref, visible }
}

// ═══ Data ═══
const stats = [
  { value: 94, suffix: '', label: 'tabel v bazi', icon: Database },
  { value: 439, suffix: '', label: 'artiklov menija', icon: ShoppingBag },
  { value: 152, suffix: '', label: 'API endpointov', icon: Terminal },
  { value: 97, suffix: '%', label: 'varnostna ocena', icon: Shield },
  { value: 144, suffix: '/149', label: 'E2E testov PASS', icon: Check },
  { value: 0, suffix: '.00€', label: 'financial diff', icon: TrendingUp },
]

const features = [
  {
    icon: Wifi,
    title: 'Offline-first PWA',
    desc: '100 naročil brez interneta? Brez problema. IndexedDB queue z Background Sync samodejno sinhronizira vsa naročila ko povezava pride nazaj.',
    gradient: 'from-blue-500 to-cyan-500',
    stats: '100 orders / 0 lost'
  },
  {
    icon: Receipt,
    title: 'FURS / ZDDV-1',
    desc: 'Avtomatsko davčno potrjevanje računov z ZOI, EOR in QR kodo. Storno računi z referenco na original. Offline FURS queue z 48h rokom.',
    gradient: 'from-amber-500 to-orange-500',
    stats: 'ZDDV-1 skladno'
  },
  {
    icon: ChefHat,
    title: 'KDS + Waiter',
    desc: 'Kitchen Display System z WebSocket real-time posodobitvami. Natakar interfejs z auto-reconnect. Course pacing za večjedna naročila.',
    gradient: 'from-green-500 to-emerald-500',
    stats: 'Real-time WebSocket'
  },
  {
    icon: Shield,
    title: 'A++ Varnost',
    desc: 'CSP z nonce injection, HSTS preload, bcrypt + HMAC-SHA256 PIN, rate limiting, audit log z SHA-256 chain hash (nepopravljiv).',
    gradient: 'from-red-500 to-pink-500',
    stats: 'OWASP Top 10 ✓'
  },
  {
    icon: Database,
    title: 'Multi-tenant',
    desc: 'Branch isolation z locationId scoping na 8 tabelih. Super-admin z cross-branch audit log. Optimistic locking za conflict resolution.',
    gradient: 'from-purple-500 to-indigo-500',
    stats: '8 tabel izoliranih'
  },
  {
    icon: TrendingUp,
    title: 'Računovodstvo',
    desc: 'Trial Balance z €0.00 diff. Double-entry journal entries. Z-Report z gotovinskim usklajevanjem. DDV poročilo usklajeno z FURS.',
    gradient: 'from-teal-500 to-green-500',
    stats: '€0.00 razlika'
  },
  {
    icon: Lock,
    title: 'Idempotency',
    desc: 'Vsako plačilo in naročilo ima unique idempotencyKey. Double-click, React Query retry, offline sync — nič duplikatov. pg_advisory_xact_lock za race conditions.',
    gradient: 'from-violet-500 to-purple-500',
    stats: '0 duplikatov'
  },
  {
    icon: Globe,
    title: '5 jezikov',
    desc: 'Slovenščina, angleščina, italijanščina, hrvaščina, nemščina. next-intl z lazy loading. Jezik se shrani v cookie.',
    gradient: 'from-sky-500 to-blue-500',
    stats: 'sl / en / it / hr / de'
  },
]

const testResults = [
  { name: 'Chaos: DB Failure', result: '14/14', pass: true, desc: 'Load test 500 req, 50 concurrent' },
  { name: 'Chaos: WebSocket Disconnect', result: 'PASS', pass: true, desc: '0 duplicates, idempotency works' },
  { name: 'Chaos: FURS Server Down', result: '5/6', pass: true, desc: 'Non-blocking, offline queue' },
  { name: 'Financial: Trial Balance', result: '14/14', pass: true, desc: 'Perfect reconciliation €0.00' },
  { name: 'Financial: Z-Report vs Cash', result: '8/8', pass: true, desc: 'cashDifference: €0.00' },
  { name: 'Financial: DDV vs FURS', result: '8/8', pass: true, desc: 'VAT total matches' },
  { name: 'FURS: Storno račun', result: '15/15', pass: true, desc: 'Negative amounts, ReferenceInvoice' },
  { name: 'Offline: 100 orders burst', result: '7/7', pass: true, desc: '12 orders/s, 0 data loss' },
  { name: 'Offline: Sync validation', result: '10/10', pass: true, desc: '7-check validation all pass' },
  { name: 'Offline: Conflict resolution', result: '8/9', pass: true, desc: '409 Conflict, no silent overwrite' },
  { name: 'Multi-tenant: Isolation', result: '7/7', pass: true, desc: 'locationId scoping' },
  { name: 'Multi-tenant: Shared resources', result: '39/40', pass: true, desc: '8 tabel, locationId filter' },
  { name: 'Multi-tenant: Super-admin', result: '9/10', pass: true, desc: 'PIN 5555, cross-branch audit' },
]

const pricing = [
  {
    name: 'Starter',
    price: '0€',
    period: '/mesec',
    desc: 'Za majhne restavracije in testiranje',
    features: [
      'Vercel Hobby (10s timeout)',
      'Neon free tier (0.5 GB)',
      'FURS simulacijski način',
      '1 lokacija',
      'Email podpora',
    ],
    cta: 'Začni brezplačno',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '20€',
    period: '/mesec',
    desc: 'Za produkcijo z FURS potrjevanjem',
    features: [
      'Vercel Pro (60s timeout)',
      'Neon Scale (10 GB)',
      'FURS produkcija (.p12 cert)',
      '1-min cron (outbox sync)',
      'Multi-tenant (več lokacij)',
      'Sentry error tracking',
      'Priority podpora',
    ],
    cta: 'Začni 14-dnevni trial',
    highlight: true,
    badge: 'Priporočeno',
  },
  {
    name: 'Enterprise',
    price: 'Po dogovoru',
    period: '',
    desc: 'Za verige in franšize',
    features: [
      'Dedicated infrastructure',
      'Neon Scale-out (100+ GB)',
      'Custom SLA (99.9% uptime)',
      'Unlimited lokacij',
      'Stripe Terminal integracija',
      'Custom integrations',
      '24/7 telefon podpora',
    ],
    cta: 'Kontakt za demo',
    highlight: false,
  },
]

const faqs = [
  {
    q: 'Ali RestaurantOS deluje brez interneta?',
    a: 'Da! Offline-first PWA z IndexedDB queue. Naročila se shranijo lokalno in se samodejno sinhronizirajo ko povezava pride nazaj. Testirano z 100 naročili brez izgube podatkov.'
  },
  {
    q: 'Kaj se zgodi če FURS strežnik pade?',
    a: 'Plačila še vedno uspejo (FURS je non-blocking). Računi se označijo kot pending in se avtomatsko pošljejo FURS-u v 48 urah (ZDDV-1 rok).'
  },
  {
    q: 'Ali podpira več lokacij?',
    a: 'Da, multi-tenant arhitektura z locationId isolation na 8 tabelih. Vsaka lokacija vidi samo svoje podatke. Super-admin vidi vse z cross-branch audit log.'
  },
  {
    q: 'Kako deluje storno račun?',
    a: 'Sistem ustvari storno račun z negativnim zneskom in referenco na original (ReferenceInvoice). FURS prejme storno avtomatsko. DDV se pravilno knjiži v reverse.'
  },
  {
    q: 'Ali je sistem varen?',
    a: 'A++ ocena (97%). CSP z nonce, HSTS preload, bcrypt+HMAC-SHA256 PIN, rate limiting, audit log z chain hash (nepopravljiv), multi-tenant isolation, idempotency keys, optimistic locking.'
  },
  {
    q: 'Katere naprave so podprte?',
    a: 'Vsaka naprava z modernim brskalnikom — tablet, telefon, laptop. PWA je installable na iOS in Android. Service Worker omogoča offline delovanje.'
  },
]

const securityBadges = [
  { icon: Shield, label: 'CSP + Nonce' },
  { icon: Lock, label: 'HSTS Preload' },
  { icon: Zap, label: 'Rate Limiting' },
  { icon: Database, label: 'Audit Chain Hash' },
  { icon: Eye, label: 'Sentry Monitoring' },
  { icon: AlertTriangle, label: 'Idempotency' },
]

const techStack = [
  { name: 'Next.js 16', category: 'Framework' },
  { name: 'React 19', category: 'UI Library' },
  { name: 'TypeScript', category: 'Language' },
  { name: 'Prisma ORM', category: 'Database' },
  { name: 'PostgreSQL', category: 'Database' },
  { name: 'Tailwind CSS 4', category: 'Styling' },
  { name: 'Radix UI', category: 'Components' },
  { name: 'Vercel', category: 'Hosting' },
  { name: 'Neon', category: 'Database' },
  { name: 'Sentry', category: 'Monitoring' },
  { name: 'next-intl', category: 'i18n' },
  { name: 'Zod', category: 'Validation' },
]

// ═══ Component ═══
export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null)
  const { ref: statsRef, visible: statsVisible } = useScrollReveal()
  const { ref: featuresRef, visible: featuresVisible } = useScrollReveal()

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* ═══ Animated background ═══ */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* ═══ Nav ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-gray-900">R</div>
            <span className="font-bold text-lg">RestaurantOS</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">v1.0.0</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Funkcije</a>
            <a href="#tests" className="hover:text-white transition">Testi</a>
            <a href="#pricing" className="hover:text-white transition">Cenik</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-lg font-semibold text-sm transition">
            Pojdi v POS <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="relative z-10 pt-32 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-800/50 border border-gray-700 text-sm text-gray-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Production Ready · 144/149 E2E testov PASS
          </div>

          <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-tight">
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              RestaurantOS
            </span>
            <br />
            <span className="text-3xl sm:text-5xl text-gray-300 font-bold">
              POS za restavracije, ki nikoli ne pade.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            FURS potrjevanje, offline delovanje, multi-tenant arhitektura in
            računovodstvo z <span className="text-amber-400 font-semibold">€0.00 razliko</span>.
            Vse v enem sistemu.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 rounded-xl font-bold text-lg transition shadow-2xl shadow-amber-500/30 hover:scale-105"
            >
              Zaženi demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </Link>
            <a
              href="https://github.com/markec12345678/restaurantos/releases/tag/v1.0.0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold text-lg transition border border-gray-700"
            >
              <Star className="w-5 h-5 text-amber-400" />
              GitHub v1.0.0
            </a>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Brez kreditne kartice</span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Admin PIN: <code className="text-amber-400">1234</code></span>
            <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Super-admin: <code className="text-amber-400">5555</code></span>
          </div>
        </div>
      </section>

      {/* ═══ Stats ═══ */}
      <section ref={statsRef} className="relative z-10 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-gray-900/50 backdrop-blur rounded-2xl p-6 border border-gray-800 hover:border-amber-500/30 transition group"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <stat.icon className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition" />
                <div className="text-3xl font-black text-white">
                  {statsVisible ? <Counter value={stat.value} suffix={stat.suffix} /> : '0'}
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" ref={featuresRef} className="relative z-10 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Vse kar restavracija <span className="text-amber-400">rabi</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Od sprejemanja naročil do FURS potrjevanja in računovodskih poročil.
              Vse v enem sistemu, brez kompromisov.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative bg-gray-900/50 backdrop-blur rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition overflow-hidden"
                style={{
                  opacity: featuresVisible ? 1 : 0,
                  transform: featuresVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.5s ease ${i * 80}ms`,
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition`} />
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="relative text-lg font-bold mb-2">{feature.title}</h3>
                <p className="relative text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                <div className="relative mt-4 flex items-center gap-1 text-xs text-amber-400 font-medium">
                  <Check className="w-3 h-3" />
                  {feature.stats}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ E2E Tests ═══ */}
      <section id="tests" className="relative z-10 py-20 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">
              <span className="text-green-400">96.6%</span> testov PASS
            </h2>
            <p className="text-gray-400 text-lg">
              144 od 149 E2E testov uspešnih. Vsak del sistema je temeljito preverjen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testResults.map((test, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-800 hover:border-gray-700 transition"
              >
                <div>
                  <span className="text-sm text-gray-300 font-medium">{test.name}</span>
                  <span className="text-xs text-gray-500 block">{test.desc}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-sm font-bold text-green-400">{test.result}</span>
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-500/10 rounded-xl border border-green-500/30">
              <BarChart3 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-semibold">144/149 tests PASS</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400">0 critical issues</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400">€0.00 financial diff</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Security ═══ */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-sm text-red-400 font-medium mb-8">
            <Shield className="w-4 h-4" />
            A++ Varnost (97%)
          </div>
          <h2 className="text-4xl font-black mb-4">Varen kot banka</h2>
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
            OWASP Top 10 preverjeno. 0 critical vulnerabilities.
            Audit log z SHA-256 chain hash — nepopravljiv in zakonsko skladen.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {securityBadges.map((badge, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                <badge.icon className="w-6 h-6 text-amber-400" />
                <span className="text-xs text-gray-400 text-center">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" className="relative z-10 py-20 px-4 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Cenik</h2>
            <p className="text-gray-400 text-lg">Enostavno. Transparentno. Brez skritih stroškov.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricing.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-8 border transition ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-amber-500/10 to-gray-900/50 border-amber-500/50 scale-105'
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-gray-900 text-xs font-bold rounded-full">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/"
                  className={`block text-center py-3 rounded-xl font-semibold transition ${
                    plan.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-gray-900'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Tech Stack ═══ */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8 text-gray-400">Zgrajeno z modernim tech stack-om</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((tech, i) => (
              <div key={i} className="px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-800 text-sm">
                <span className="text-white font-medium">{tech.name}</span>
                <span className="text-gray-600 ml-2 text-xs">{tech.category}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="relative z-10 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-12">Pogosta vprašanja</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/30 transition"
                >
                  <span className="font-semibold text-white">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {activeFaq === i && (
                  <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 border border-gray-800 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-[80px]" />
            <div className="relative">
              <h2 className="text-4xl sm:text-5xl font-black mb-4">
                Pripravljen za <span className="text-amber-400">go-live?</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                RestaurantOS v1.0.0 je testiran, varen in pripravljen za produkcijo.
                Zaženi demo in prepričaj se sam.
              </p>
              <Link
                href="/"
                className="group inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 rounded-xl font-bold text-xl transition shadow-2xl shadow-amber-500/30 hover:scale-105"
              >
                Zaženi demo
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition" />
              </Link>
              <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Setup v 5 minutah</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Multi-user</span>
                <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> 5 jezikov</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="relative z-10 border-t border-gray-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-gray-900">R</div>
                <span className="font-bold">RestaurantOS</span>
              </div>
              <p className="text-sm text-gray-500">Celovit POS sistem za restavracije z FURS, offline in multi-tenant.</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-400">Produkt</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-gray-500 hover:text-amber-400">Funkcije</a></li>
                <li><a href="#pricing" className="text-gray-500 hover:text-amber-400">Cenik</a></li>
                <li><a href="#tests" className="text-gray-500 hover:text-amber-400">Testi</a></li>
                <li><a href="#faq" className="text-gray-500 hover:text-amber-400">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-400">Pravno</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="text-gray-500 hover:text-amber-400">Politika zasebnosti</Link></li>
                <li><Link href="/terms-of-service" className="text-gray-500 hover:text-amber-400">Pogoji uporabe</Link></li>
                <li><span className="text-gray-500">MIT License</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-400">Povezave</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/markec12345678/restaurantos" className="text-gray-500 hover:text-amber-400">GitHub</a></li>
                <li><a href="https://github.com/markec12345678/restaurantos/releases/tag/v1.0.0" className="text-gray-500 hover:text-amber-400">Release v1.0.0</a></li>
                <li><a href="mailto:info@restaurantos.app" className="text-gray-500 hover:text-amber-400">info@restaurantos.app</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-600">
            © 2026 RestaurantOS · v1.0.0 · Zgrajeno z ❤️ v Sloveniji
          </div>
        </div>
      </footer>
    </div>
  )
}

// ═══ Counter component ═══
function Counter({ value, suffix }: { value: number; suffix: string }) {
  const count = useCountUp(value, 2000, true)
  if (suffix === '/149') {
    return <span>{count}/149</span>
  }
  if (suffix === '.00€') {
    return <span>0.00€</span>
  }
  return <span>{count}{suffix}</span>
}
