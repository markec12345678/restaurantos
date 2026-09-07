# Video Tutorial Series — RestaurantOS

**Target:** 5 videos, 3-5 minutes each
**Platform:** YouTube (RestaurantOS channel)
**Language:** Slovenian (with English subtitles)
**Status:** Scripts ready, awaiting recording

---

## Video 1: Getting Started (3 min)

### Title: "RestaurantOS — Namestitev v 3 minutah"

**Script:**

```
[0:00] Intro
"Pozdravljeni! V tem videu bomo RestaurantOS POS sistem namestili
v manj kot 3 minute."

[0:15] Prerequisites
"Potrebujete: Node.js 18+, Neon PostgreSQL račun (brezplačen),
in Vercel račun (brezplačen)."

[0:30] Step 1: Clone & Install
git clone https://github.com/markec12345678/restaurantos
cd restaurantos
npm install

[1:00] Step 2: Environment setup
cp .env.example .env
# Nastavi DATABASE_URL iz Neon dashboard
# Nastavi NEXTAUTH_SECRET (openssl rand -hex 32)

[1:30] Step 3: Database migration
npx prisma migrate deploy
npx prisma db seed

[2:00] Step 4: Run
npm run dev
# Odpri http://localhost:3000
# PIN: 1234 (admin)

[2:30] Step 5: Deploy to Vercel
"Klikni 'Deploy' na Vercel dashboard, poveži GitHub repo,
nastavi environment variables, in si živ."

[3:00] Outro
"RestaurantOS je zdaj pripravljen! V naslednjem videu bomo
pogledali, kako dodati artikle in zaposlene."
```

---

## Video 2: Menu & Employees (4 min)

### Title: "RestaurantOS — Artikli, kategorije in zaposleni"

**Script outline:**
- [0:00] Intro: "Kako nastaviti meni in ekipo"
- [0:30] Categories: Create categories (Predjedi, Glavne jedi, Pijače)
- [1:00] Menu items: Add items with price, VAT rate, category
- [1:30] Modifiers: Add modifier groups (Size, Extras)
- [2:00] Employees: Create employees with PINs and roles
- [2:30] Roles & permissions: Admin, Manager, Waiter, Cook
- [3:00] Jobs: Assign pay rates and primary job
- [3:30] Demo: Login as different roles, see different permissions
- [4:00] Outro: "Naslednji video: orders & payments"

---

## Video 3: Orders & Payments (5 min)

### Title: "RestaurantOS — Naročila in plačila"

**Script outline:**
- [0:00] Intro: "Od naročila do plačila"
- [0:30] Create order: Select table, add items, modifiers
- [1:00] Fire to kitchen: KDS receives order in real-time
- [1:30] KDS workflow: Mark items as preparing, ready, served
- [2:00] Payment: Split check, cash/card, tip
- [2:30] Idempotency: Double-click protection demo
- [3:00] FURS: Automatic ZOI/EOR generation
- [3:30] Receipt: Print receipt with QR code
- [4:00] Refund: Partial refund process
- [4:30] Outro: "Naslednji video: inventory & reports"

---

## Video 4: Inventory & Reports (4 min)

### Title: "RestaurantOS — Zaloga in poročila"

**Script outline:**
- [0:00] Intro: "Upravljanje zaloge in poročila"
- [0:30] Inventory items: Add items with units, cost, min quantity
- [1:00] Recipes: Link menu items to inventory (recipe-based deduction)
- [1:30] Stock transactions: Sale, write-off, adjustment, return
- [2:00] Low stock alerts: Automatic notification
- [2:30] EOD report: Daily close, Z-report, VAT breakdown
- [3:00] Financial reports: Revenue, tax, tips by employee
- [3:30] Export: PDF, XML, CSV
- [4:00] Outro: "Naslednji video: FURS & integrations"

---

## Video 5: FURS & Integrations (5 min)

### Title: "RestaurantOS — FURS potrjevanje in integracije"

**Script outline:**
- [0:00] Intro: "FURS compliance in integracije"
- [0:30] FURS certificate: How to obtain from eDavki
- [1:00] FURS setup: Configure test/production environment
- [1:30] ZOI/EOR: How they're generated automatically
- [2:00] Daily close: FURS daily verification
- [2:30] Glovo/Wolt: Configure webhooks for delivery platforms
- [3:00] Stripe: Set up card payments
- [3:30] Online ordering: Public menu + QR ordering
- [4:00] Webhooks: Outbound event delivery
- [4:30] Outro: "Hvala za ogled! Kontakt: info@restaurantos.app"

---

## Production Notes

### Equipment needed:
- Screen recording software (OBS Studio — free)
- Microphone (Blue Yeti or similar)
- Video editor (DaVinci Resolve — free)

### Recording tips:
- Record in 1080p, 60fps
- Use browser zoom 110% for readability
- Dark theme for IDE, light theme for app
- Speak clearly, 150-160 words per minute
- Add Slovenian + English subtitles

### Thumbnail design:
- 1280×720 pixels
- RestaurantOS logo top-right
- Large text overlay with video title
- Background: App screenshot (blurred)

### Upload schedule:
- Video 1: Week 1 Monday
- Video 2: Week 1 Thursday
- Video 3: Week 2 Monday
- Video 4: Week 2 Thursday
- Video 5: Week 3 Monday

### SEO:
- Tags: restaurant pos, slovenia pos, furs, restaurantos, pos system
- Description: Full script + links to docs
- End screen: Link to next video + subscribe button

---

## Status

| Video | Script | Recording | Editing | Published |
|-------|--------|-----------|---------|-----------|
| 1. Getting Started | ✅ Ready | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| 2. Menu & Employees | ✅ Ready | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| 3. Orders & Payments | ✅ Ready | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| 4. Inventory & Reports | ✅ Ready | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| 5. FURS & Integrations | ✅ Ready | ⏳ Pending | ⏳ Pending | ⏳ Pending |

---

*RestaurantOS Video Tutorial Plan v1.0 — Created: 2026-09-06*
