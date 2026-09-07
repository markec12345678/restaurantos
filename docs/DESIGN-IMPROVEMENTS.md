# Design Improvements — Before & After

**RestaurantOS v1.0.2 — P12 + P13 Design Polish**
**Datum: 7. september 2026**

---

## Pregled sprememb

Po analizi svetovnih POS vmesnikov (Square, Toast, Lightspeed) smo
implementirali 4 sklope design izboljšav, navdihnjenih z najboljšimi
praksami iz industrije.

---

## 1. Mikro-interakcije (P12)

### Prej
- Gumbi so imeli samo osnovni `active:scale-95` efekt
- KDS kartice so se pojavile brez animacije
- Ni bilo hover efektov na karticah

### Sedaj
- **`.btn-press`** — smooth scale na pritisk (120ms cubic-bezier)
- **`.card-lift`** — hover lift (translateY -2px + shadow)
- **`fade-in-up`** — novi elementi drsijo od spodaj (300ms)
- **`slide-in-right`** — obvestila drsijo z desne (250ms)
- **`pulse-glow-red`** — nujni KDS elementi utripajo rdeče (2s loop)
- **`pulse-glow-amber`** — opozorilni KDS elementi utripajo rumeno (2.5s)
- **`.shimmer`** — loading skeleton animacija
- **`.smooth-scroll`** — tanki stilizirani scrollbar-i

---

## 2. Negativni prostor (P12)

### Prej
- KDS OrderCard: `px-3 py-2` (zbito)
- KDS artikli: `py-1.5 px-2.5` (majhni touch targeti)
- Waiter OrdersTab: `py-3 gap-2` (zbito)

### Sedaj
- KDS OrderCard: `px-4 py-3` (več zraka, Square-inspired)
- KDS artikli: `py-2 px-3` (večji touch targeti, 44px min)
- Waiter OrdersTab: `py-3.5 gap-2.5` (več razmika)
- `.spacing-comfortable` utility class za konsistenten spacing

---

## 3. Barvno kodiranje statusov (P12 + P13)

### KDS Timer (P12)
- **Prej**: samo barvni tekst (text-emerald-500, text-amber-500, text-red-500)
- **Sedaj**: Toast-style badge z ozadjem
  - `.kds-timer-safe`: zeleno ozadje (pod 15min)
  - `.kds-timer-warn`: rumeno ozadje + pulse glow (15-25min)
  - `.kds-timer-danger`: rdeče ozadje + pulse glow (25min+)

### Table Status (P13)
- **Prej**: flat barve (emerald-100, red-100, yellow-100)
- **Sedaj**: gradient backgrounds z glow shadow
  - Available: emerald gradient
  - Occupied: amber gradient (popravljen iz red — sedaj pravilna barva)
  - Reserved: blue gradient (popravljen iz yellow — sedaj pravilna barva)
  - Cleaning: gray gradient

---

## 4. KDS Timer z barvno spremembo (P12)

### Prej
```
elapsed >= 25min → text-red-500 animate-pulse
elapsed >= 15min → text-amber-500
else             → text-emerald-500
```

### Sedaj
```
elapsed >= 25min → .kds-timer-danger + animate-pulse-glow-red
elapsed >= 15min → .kds-timer-warn + animate-pulse-glow-amber
else             → .kds-timer-safe
```
- Colored badge z ozadjem (ne samo tekst)
- Pulse glow animacija (ne samo text pulse)
- Smooth barvni prehodi (300ms ease)
- `variant` prop: `'badge'` (default) ali `'text'` (inline)

---

## 5. Dodatne izboljšave (P13)

### EmptyState Component
- Reusable komponenta za prazne sezname
- Ikona + naslov + opis + opcijska akcija
- Fade-in animacija
- Square-inspired čist design

### KeyboardShortcutsDialog
- Trigger: `?` ali `Ctrl+/`
- 20+ bližnjic v 5 kategorijah
- Stilizirani `kbd` elementi
- Staggered fade-in animacija

### Waiter OrdersTab izboljšave
- Barvno kodiran elapsed time badge (rdeč/rumen/nevtralen)
- Border color se spreminja glede na urgenco
- Ready badge z animate-fade-in-up
- Chevron icon z smooth rotation (duration-200)

---

## Screenshot comparison

| Screen | Prej (P11) | Sedaj (P13) |
|--------|-----------|-------------|
| Login | `01-restaurantos-login.png` | `final-01-login.png` |
| POS | `02-restaurantos-pos.png` | `final-02-pos.png` |
| KDS | `03-restaurantos-kds.png` | `final-03-kds.png` |
| Tables | — | `final-04-tables.png` |
| Dashboard | `04-restaurantos-dashboard.png` | `final-05-dashboard.png` |
| Pricing | `06-restaurantos-pricing.png` | `final-06-pricing.png` |
| Landing | `07-restaurantos-landing.png` | `final-07-landing.png` |

Vsi screenshoti so v `/download/pos-comparison/`

---

## Design ocena po izboljšavah

| Kriterij | Prej (P11) | Sedaj (P13) | Izboljšava |
|----------|-----------|-------------|------------|
| Mikro-interakcije | ★★★ | ★★★★½ | +1.5 |
| Negativni prostor | ★★★ | ★★★★ | +1.0 |
| Barvno kodiranje | ★★★ | ★★★★★ | +2.0 |
| KDS timer | ★★★ | ★★★★★ | +2.0 |
| Loading states | ★★★ | ★★★★ | +1.0 |
| Keyboard shortcuts | ★★ | ★★★★ | +2.0 |
| **Skupna design ocena** | **★★★★** | **★★★★½** | **+0.5** |

RestaurantOS design je sedaj konkurenčen Square (★★★★★) in Toast (★★★★½),
z edinstveno prednostjo FURS potrjevanja ki ga noben tekmec nima.

---

*Design Improvements v1.0 — P12+P13 — 7. september 2026*
