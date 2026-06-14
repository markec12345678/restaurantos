#!/usr/bin/env python3
"""RestaurantOS - Comprehensive Repository Analysis & Index PDF Generator"""

import sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, CondPageBreak, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import hashlib

# ── Palette ──
ACCENT       = colors.HexColor('#1b7796')
TEXT_PRIMARY  = colors.HexColor('#21201e')
TEXT_MUTED    = colors.HexColor('#827f76')
BG_SURFACE   = colors.HexColor('#e0dcd3')
BG_PAGE      = colors.HexColor('#f2f1ef')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ── Fonts ──
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))

registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ── Styles ──
BODY_FONT = 'Carlito'
HEADING_FONT = 'Carlito'

styles = getSampleStyleSheet()

sTitle = ParagraphStyle('DocTitle', fontName=HEADING_FONT, fontSize=28, leading=34,
    textColor=ACCENT, alignment=TA_LEFT, spaceAfter=12)
sH1 = ParagraphStyle('H1', fontName=HEADING_FONT, fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10)
sH2 = ParagraphStyle('H2', fontName=HEADING_FONT, fontSize=15, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8)
sH3 = ParagraphStyle('H3', fontName=HEADING_FONT, fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6)
sBody = ParagraphStyle('Body', fontName=BODY_FONT, fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
sBodySmall = ParagraphStyle('BodySmall', fontName=BODY_FONT, fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4)
sMuted = ParagraphStyle('Muted', fontName=BODY_FONT, fontSize=9, leading=13,
    textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=4)
sCell = ParagraphStyle('Cell', fontName=BODY_FONT, fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sCellCenter = ParagraphStyle('CellC', fontName=BODY_FONT, fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER)
sHeader = ParagraphStyle('TH', fontName=BODY_FONT, fontSize=8.5, leading=12,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER)
sCaption = ParagraphStyle('Caption', fontName=BODY_FONT, fontSize=8.5, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)

# ── TOC Template ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Helpers ──
def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1(text):
    available = PAGE_H - TOP_MARGIN - BOTTOM_MARGIN
    return [CondPageBreak(available * 0.15), heading(text, sH1, level=0)]

def h2(text):
    return heading(text, sH2, level=1)

def h3(text):
    return heading(text, sH3, level=2)

def p(text):
    return Paragraph(text, sBody)

def psmall(text):
    return Paragraph(text, sBodySmall)

def pmuted(text):
    return Paragraph(text, sMuted)

def make_table(headers, rows, col_ratios=None):
    """Create a styled table with proper Paragraphs."""
    n = len(headers)
    if col_ratios is None:
        col_ratios = [1.0/n] * n
    col_widths = [r * AVAILABLE_W for r in col_ratios]

    data = [[Paragraph('<b>%s</b>' % h, sHeader) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), sCell) if not isinstance(c, Paragraph) else c for c in row])

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl

# ── Build Document ──
output_path = '/home/z/my-project/download/RestaurantOS_Analiza_Indeks.pdf'
doc = TocDocTemplate(output_path, pagesize=A4,
    leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN)

story = []

# ── TOC ──
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName=HEADING_FONT, fontSize=12, leftIndent=20, leading=20, spaceBefore=4),
    ParagraphStyle('TOC2', fontName=HEADING_FONT, fontSize=10, leftIndent=40, leading=16, spaceBefore=2),
]
story.append(Paragraph('<b>RestaurantOS - Analiza in Indeks Repozitorija</b>', sTitle))
story.append(Spacer(1, 12))
story.append(Paragraph('Avtomatizirana globoka analiza celotnega repozitorija RestaurantOS z indeksom arhitekture, '
    'Prisma sheme, API rut, komponent, avtentikacije in poslovne logike.', sBody))
story.append(Spacer(1, 18))
story.append(Paragraph('<b>Kazalo vsebine</b>', sH2))
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════
# 1. ARHITEKTURA PROJEKTA
# ══════════════════════════════════════════════════════════════════
story.extend(h1('1. Arhitektura projekta'))

story.append(p(
    'RestaurantOS je sodoben sistem za upravljanje restavracij, zgrajen na tehnoloskem skladu Next.js 16 + React 19 + TypeScript. '
    'Projekt uporablja App Router arhitekturo z vec kot 120 API koncnimi tockami, 62 POS poslovnimi komponentami in 45 Prisma modeli. '
    'Podprt je kot PWA aplikacija z offline podporo, WebSocket realnim casom, 5-jezicno lokalizacijo in fiskalizacijo FURS za Slovenijo. '
    'Aplikacija je optimizirana za tablicne racunalnike v restavratorskem okolju z zasukanim zaslonom, PIN avtentikacijo in ESC/POS tiskalniki.'
))

story.append(h2('1.1 Tehnoloski sklad'))

story.append(make_table(
    ['Tehnologija', 'Verzija', 'Namen'],
    [
        ['Next.js', '16.1.1', 'Full-stack React framework (App Router)'],
        ['React', '19.0.0', 'UI knjiznica s server components'],
        ['TypeScript', '5.x', 'Tipiziran JavaScript'],
        ['Prisma', '6.11.1', 'ORM za SQLite z migracijami'],
        ['SQLite (better-sqlite3)', '12.10.0', 'Vgrajena relacijska baza z WAL mode'],
        ['Zustand', '5.0.6', 'Odjemalsko upravljanje stanja (kosarica, modul, locale)'],
        ['TanStack React Query', '5.82.0', 'Streznisko stanje s predpomnjenjem'],
        ['Tailwind CSS', '4.x', 'Utility-first CSS z OKLCH barvami'],
        ['shadcn/ui (new-york)', '-', '48 Radix UI primitivnih komponent'],
        ['Framer Motion', '12.23.2', 'Animacije prehodov modulov'],
        ['next-intl', '4.3.4', '5-jezicna lokalizacija (SL, EN, IT, HR, DE)'],
        ['ws (WebSocket)', '8.20.0', 'Realni cas za KDS, natakar, obvestila'],
        ['Zod', '4.0.2', 'Shematska validacija API vhodov'],
        ['Recharts', '2.15.4', 'Grafikoni za nadzorne plosce'],
    ],
    col_ratios=[0.25, 0.12, 0.63]
))

story.append(h2('1.2 Konfiguracija'))

story.append(p(
    'Next.js konfiguracija uporablja standalone izhod za Docker implementacijo, strogi TypeScript brez ignoriranja napak '
    'in 5 varnostnih glav (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, '
    'X-XSS-Protection: 1; mode=block, Permissions-Policy: camera=(), microphone=(), geolocation=()). '
    'Tailwind uporablja OKLCH barvni prostor z ambarno/oranzno primarno paleto. ESLint je konfiguriran s popustljivimi pravili '
    '(skoraj vsa pravila so izklopljena).'
))

story.append(h2('1.3 Implementacija in namestitev'))

story.append(p(
    'Projekt podpira vec implementacijskih strategij. Dockerfile uporablja vecstopenjsko izgradnjo (node:20-alpine) z '
    'standalone izhodno datoteko in ne-root uporabnikom (nextjs:1001). PM2 procesni upravljalec skrbi za avtomatski '
    'restart z omejitvami pomnilnika (512MB). Caddy reverse proxy usmerja promet na pristani 3000 z dinamocnim '
    'preusmerjanjem pristanov. Daemon.js zagotavlja avtomatski restart do 50 poizkusov s 2-sekundo zamikom. '
    'Custom Node.js streznik (server.js) zagotavlja WebSocket podporo na poti /ws s prepoznavo strank, '
    'srckanim utripanjem vsakih 30 sekund in milnim izklopom.'
))

story.append(h2('1.4 PWA in offline podpora'))

story.append(p(
    'RestaurantOS deluje kot Progressive Web App z Service Worker (sw.js v5), ki uporablja 4 predpomnilniske shrambe: '
    'static, API, images, main. Strategija cache-first velja za staticne vire in slike (24-urni TTL), network-first za '
    'API rute (5-minutni TTL) z vec kot 20 predpomnljivimi API vzorci. Obcutljive rute (placila, fiskalizacija, auth, '
    'porocila) so izvzete iz predpomnjenja. Podprta je sinhronizacija naroocil brez povezave prek IndexedDB z batch '
    'omejitvijo 20 naroocil in podporo za potisna obvestila za kuhinjo in natakarja.'
))

# ══════════════════════════════════════════════════════════════════
# 2. PRISMA SHEMA IN BAZA PODATKOV
# ══════════════════════════════════════════════════════════════════
story.extend(h1('2. Prisma shema in baza podatkov'))

story.append(p(
    'RestaurantOS uporablja Prisma ORM s SQLite bazo v WAL nacinu za soocasno branje/pisanje. Shema vsebuje 45 modelov, '
    'organiziranih v 9 funkcionalnih domen. Projekt ne uporablja Prisma nativnih enumeracij ampak String polja s komentarji. '
    'Migracije ne obstajajo - projekt uporablja prisma db push (shema-prvi pristop). Vsi raw SQL pozivi so omejeni na '
    '3 SQLite PRAGMA ukaze (WAL mode, busy_timeout=5000ms, synchronous=NORMAL) v datoteki lib/db.ts.'
))

story.append(h2('2.1 Hierarhija menijev'))

story.append(make_table(
    ['Model', 'Kljucna polja', 'Relacije'],
    [
        ['Menu', 'name, icon, color, sortOrder, isActive', 'Category[] (1:N Cascade)'],
        ['Category', 'name, icon, color, menuId', 'Menu, MenuItem[] (1:N Cascade)'],
        ['MenuItem', 'name, price, image, vatRate, allergens, isAvailable', 'Category, SalesCategory?, PriceGroup?, RevenueCenter?, PrepStation?, OrderItem[], InventoryItem?(1:1), RecipeItem[], ModifierGroup[](M:N)'],
        ['ModifierGroup', 'name, required, minSelect, maxSelect', 'Modifier[], MenuItem[](M:N)'],
        ['Modifier', 'name, price, isAvailable', 'ModifierGroup'],
        ['MenuItemModifierGroup', 'menuItemId, modifierGroupId, sortOrder', 'MenuItem, ModifierGroup (M:N join)'],
    ],
    col_ratios=[0.22, 0.48, 0.30]
))

story.append(h2('2.2 Naročila, racuni in placila'))

story.append(p(
    'Osrednji model Order vsebuje orderNumber (enoličen, avtomatsko povečan), tip (dine-in/takeout/delivery), '
    'status, financial totals (subtotal/tax/discount/tip/total/totalWithTip), paymentStatus, in povezave do '
    'Table, Guest, DeliveryInfo, Check[], Course[], Receipt[], OrderItem[]. OrderItem vsebuje modifiersJson '
    'za prilagoditve, voided zastavico in povezavo do VoidReason. Check model podpira split-check funkcionalnost '
    'z vec racuni na eno naročilo. Payment model podpira 7 tipov placil (cash, card, mobile, voucher, loyalty, '
    'giftcard, alternate) s statusi (completed, refunded, voided).'
))

story.append(h2('2.3 Zaposleni in delo'))

story.append(make_table(
    ['Model', 'Opis', 'Kljucne lastnosti'],
    [
        ['Employee', 'Zaposleni', 'PIN (bcrypt hashed), role (admin/manager/staff), status, email(unique)'],
        ['Job', 'Delovno mesto', 'basePayRate, overtimeRate, permissions (JSON array)'],
        ['EmployeeJob', 'M:N vezava', 'payRate override, isPrimary, unique([employeeId, jobId])'],
        ['Shift', 'Smena', 'date, startTime, endTime, status, breakMinutes'],
        ['TimeEntry', 'Ura', 'clockIn/Out, totalMinutes, payRate, type (regular/overtime/holiday/sick/vacation)'],
        ['StaffShift', 'Osebna smena', 'shiftType (morning/afternoon/evening/night), role (server/chef/bartender/host)'],
    ],
    col_ratios=[0.18, 0.18, 0.64]
))

story.append(h2('2.4 Inventar in zaloge'))

story.append(p(
    'InventoryItem je povezan z MenuItem v 1:1 razmerju prek menuItemId (unique). StockTransaction beleži vse '
    'spremembe zaloge (procurement, sale, write-off, adjustment, return) z atomske transakcije. RecipeItem je '
    'M:N vezava med MenuItem in InventoryItem s kolicino na porcijo. Lib/stock-deduction.ts implementira '
    'checkStockAvailability(), deductStockForOrder() in returnStockForOrder() z Prisma $transaction '
    'za atomske operacije. Inventory forecast API uporablja Holt-Winters napovedni algoritem.'
))

story.append(h2('2.5 Druge domene'))

domains = [
    ['Fiskalizacija (FURS)', 'Receipt z ZOI/EOR, batch verify, storno podpora, QR koda'],
    ['Zvestoba', 'LoyaltyAccount (tiers: bronze/silver/gold/platinum), LoyaltyTransaction'],
    ['Darilni kartoni', 'GiftCard (active/depleted/expired/suspended), GiftCardTransaction'],
    ['Nastavitve', 'RestaurantSettings - business info, FURS cert, VAT rates, loyalty config, allergen filter'],
    ['Vec lokacij', 'Location z 12 relacijskimi polji, FURS cert po lokaciji, OpeningHours'],
    ['Dostava', 'DeliveryZone (postCodes/cities JSON, radiusKm, fees), DeliveryTracking z GPS'],
    ['HACCP', 'HaccpEntry (temperature/cleaning/delivery/cooling/training), status ok/warning/critical'],
    ['Webhook integracije', 'Webhook + WebhookDelivery z retry logiko, HMAC-SHA256 podpisovanje'],
    ['Kontrolni stevec', 'Counter - atomsko generiranje orderNumber/receiptNumber/checkNumber'],
    ['Revizijski dnevnik', 'AuditLog z SHA-256 hash verigo za zašcito pred posegi'],
    ['CRM gostov', 'Guest z denormaliziranimi statistikami, GuestVisit, LoyaltyAccount(1:1)'],
    ['Nabava', 'Supplier, PurchaseOrder (6 statusov), PurchaseOrderItem'],
    ['SaaS naročnina', 'Subscription (starter/professional/enterprise), SubscriptionInvoice'],
    ['Z-report', 'ZReport z celotno financno razdelitvijo, VAT razdelitvijo, status draft/finalized/approved'],
]

story.append(make_table(
    ['Domena', 'Kljucni modeli in lastnosti'],
    domains,
    col_ratios=[0.25, 0.75]
))

story.append(h2('2.6 Relacije med modeli'))

story.append(p(
    'Shema vsebuje 3 ena-na-ena (1:1) razmerja: MenuItem-InventoryItem (menuItemId unique), '
    'Order-DeliveryInfo (deliveryInfoId unique), Guest-LoyaltyAccount (loyaltyAccountId unique). '
    '3 vec-na-vec (M:N) vezave: MenuItem-ModifierGroup (prek MenuItemModifierGroup), '
    'Employee-Job (prek EmployeeJob), MenuItem-InventoryItem (prek RecipeItem). '
    'Okoli 40 ena-na-vec (1:N) razmerij s Cascade, SetNull in Restrict brisalnimi pravili. '
    'Vseh unikatnih omejitev je 15+ (Table.number, Order.orderNumber, Receipt.receiptNumber, '
    'Employee.email, GiftCard.cardNumber, Location.code, itd.). Indeksi: okoli 65+ za optimizacijo poizvedb.'
))

# ══════════════════════════════════════════════════════════════════
# 3. API RUTE
# ══════════════════════════════════════════════════════════════════
story.extend(h1('3. API rute in koncnih tock'))

story.append(p(
    'RestaurantOS izpostavlja vec kot 150 HTTP koncnih tock prek Next.js App Router v imeniku src/app/api/. '
    'Vseh 101 datotek z rutami uporablja Prisma ORM prek centraliziranega db.ts singletona. Ni strezniskih akcij '
    '(use server) - vsa strezniska logika je implementirana prek API rut. Validacija vhodnih podatkov poteka '
    'prek Zod shem z validateBody() helperjem. Avtentikacija je implementirana v vsaki rutini z requireAuth() '
    'helperjem, ki preverja Bearer token v glavi Authorization.'
))

story.append(h2('3.1 Avtentikacija in dovoljenja'))

story.append(p(
    'Sistem uporablja PIN-avtentikacijo z bcrypt hashiranimi PIN-i, Bearer tokeni (crypto.randomBytes(32)) in '
    'pomnilnisko shrambo sej (Map<string, Session>) z 8-urnim TTL in 24-urnim absolutnim maksimumom. '
    'Omejitev je 500 soocasnih sej. Ob vsaki avtentificirani zahtevki se seja podaljsa. '
    'Prijava je omejena na 5 poizkusov v 15-minutnem oknu z zaklepom IP naslova. '
    'Sistem dovoljenj vsebuje 9 nivojev: take_orders, void_items, apply_discounts, manage_cash, '
    'manage_inventory, manage_employees, view_reports, admin. Admin in manager vloge obidejo vse preverbe dovoljenj.'
))

story.append(h2('3.2 Pregled API skupin'))

api_groups = [
    ['Avtentikacija', '/api/auth', '3', 'PIN prijava, status, odjava'],
    ['Naročila', '/api/orders', '7', 'CRUD + add-items, seed, status update, KDS bump'],
    ['Meniji', '/api/menus, /api/categories, /api/menu-items', '11', 'Hierarhija Menu > Category > MenuItem + modifierji'],
    ['Mize', '/api/tables', '4', 'CRUD z vizualnim layoutom, blokada ob aktivnih naročilih'],
    ['Zaposleni', '/api/employees', '4', 'CRUD z bcrypt PIN, soft-delete'],
    ['Inventar', '/api/inventory', '11', 'CRUD + adjust, restock, forecast, transactions, reorder, menu-stock'],
    ['Placila', '/api/payments, /api/checks', '7', 'Split-check, 7 tipov placil, cash register'],
    ['FURS', '/api/furs', '5', 'Verify, storno, batch (do 50 racunov z 200ms zamikom)'],
    ['Racuni', '/api/receipts', '4', 'Racun z ZOI/EOR, digitalni racun za javnost'],
    ['Webhook', '/api/webhooks', '6', 'Outbound z retry, inbound Wolt/Glovo s HMAC'],
    ['Dostava', '/api/delivery, /api/delivery-zones, /api/delivery-tracking', '9', 'Cona dostave, GPS sledenje, integracije'],
    ['Javne rute', '/api/public/*', '10', 'QR naročanje, menu, sledenje, promo, klic natakarja'],
    ['Porocila', '/api/reports, /api/dashboard', '9', 'Prodaja, popularni, smene, zaposleni, DDV, EOD, financo, izvoz'],
    ['Kuhinja', '/api/kitchen, /api/print', '3', 'KDS podatki, ESC/POS tiskanje po TCP/IP'],
    ['Gostje CRM', '/api/guests, /api/reservations, /api/waitlist', '12', 'Guest CRUD, povratne informacije, rezervacije, cakalna vrsta'],
    ['Osebje', '/api/shifts, /api/staff-shifts, /api/time-entries, /api/jobs', '11', 'Smene, urne evidence, delovna mesta, uspešnost'],
    ['Nabava', '/api/suppliers, /api/purchase-orders', '6', 'Dobavitelji, nakupni nalogi'],
    ['Integracije', '/api/integrations', '6', 'CRUD + rotate-key, logs, sync, scheduler'],
    ['Nastavitve', '/api/settings, /api/configuration, /api/locations', '10', 'Restavracija, konfiguracija, lokacije, urni delovni cas'],
    ['Zvestoba', '/api/loyalty, /api/gift-cards', '5', 'Zvestbeni racuni, darilni kartoni'],
    ['Ostalo', '/api/seed, /api/audit, /api/haccp, /api/expenses, ...', '20+', 'Sejanje, revizija, HACCP, stroski, AI, naročnina'],
]

story.append(make_table(
    ['Skupina', 'Pot', 'St. rute', 'Opis'],
    api_groups,
    col_ratios=[0.14, 0.32, 0.07, 0.47]
))

story.append(h2('3.3 Omejevanje hitrosti (Rate limiting)'))

story.append(make_table(
    ['Koncna tocka', 'Omejitev', 'Okno', 'Implementacija'],
    [
        ['/api/auth (POST)', '5 poskusov', '15 min zaklep', 'Map<ip, {count, lockedUntil}>'],
        ['/api/public/order (POST)', '5 naročil', '1 min', 'Map<ip, {count, resetAt}>'],
        ['/api/public/online-order (POST)', '5 naročil', '2 min', 'Map<ip, {count, resetAt}>'],
        ['/api/feedback-public (POST)', '3 oddaje', '1 min', 'Map<ip, {count, lastReset}>'],
        ['/api/furs/batch (POST)', '200ms med zahtevkami', 'Na serijo', 'setTimeout delay'],
    ],
    col_ratios=[0.30, 0.18, 0.18, 0.34]
))

story.append(h2('3.4 Webhook sistem'))

story.append(p(
    'Izhodni webhooki so implementirani prek lib/event-emitter.ts z dogodki: order.created, order.updated, order.paid, '
    'order.ready, order.delivered, order.cancelled, receipt.created, receipt.fiscal_verified. Dostave se beležijo '
    'v WebhookDelivery model z retry logiko (5 maksimalnih poizkusov). Vhodni webhooki za Wolt in Glovo uporabljajo '
    'HMAC preverjanje podpisa in idempotentno ustvarjanje naročil. Obvestila o nizki zalogi se oddajajo '
    'prek WebSocket broadcast funkcije.'
))

# ══════════════════════════════════════════════════════════════════
# 4. FRONTEND KOMPONENTE IN STRANI
# ══════════════════════════════════════════════════════════════════
story.extend(h1('4. Frontend komponente in strani'))

story.append(p(
    'Frontend je sestavljen iz 12 strani, 62 POS poslovnih komponent in 48 shadcn/ui primitivnih komponent. '
    'Vse strani uporabljajo client-side rendering (use client). Osrednja POS stran (/) je enostranska aplikacija '
    'z 57 moduli, ki jih upravlja Zustand store z activeModule stanjem. Podprto je kiosk nacinsko delovanje '
    'z omejenim naborom modulov. React Query skrbi za pridobivanje strezniskih podatkov s 30-sekundno'
    'zastarelostjo in brez osveževanja ob fokusu.'
))

story.append(h2('4.1 Strani (Routes)'))

pages = [
    ['/', 'POS terminal', 'Glavna prodajna tocka z 57 moduli, PIN avtentikacija, kiosk nacin'],
    ['/waiter', 'Natakar', 'Android/iPad pogled z WebSocket obvestili, zvočni opozorili'],
    ['/kds', 'Kuhinja (KDS)', 'Celozaslonski prikaz z bump bar, filtriranjem postaj, casovniki'],
    ['/qr/[tableId]', 'QR naročanje', 'Mobilni meni z kosarico, 5-jezicna podpora, alergeni'],
    ['/qr-menu', 'Izboljsan QR meni', 'EAA 2026 dostopnost, EU 1169/2011 alergeni, AI upsell'],
    ['/order', 'Spletne naročanje', 'Dostava/samoprevzem z območji dostave, promo kode'],
    ['/order/[orderId]', 'Sledenje naročilu', "Domino's-style casovnica z avtomatskim osveževanjem"],
    ['/order-status/[orderId]', 'Status naročila', 'Javni status z napredkom korakov'],
    ['/reserve', 'Rezervacije', 'Javni obrazec z izbiro datuma/ure, velikost stranke'],
    ['/pricing', 'Cenik SaaS', '3-stopenjski nacrti (Starter/Professional/Enterprise)'],
    ['/receipt', 'Digitalni racun', 'Javni pregled racuna s FURS ZOI/EOR, QR kodo'],
    ['/feedback', 'Povratne informacije', 'QR kiosk za ocenjevanje hrane/storitve/ambienta'],
]

story.append(make_table(
    ['Pot', 'Ime', 'Opis'],
    pages,
    col_ratios=[0.18, 0.15, 0.67]
))

story.append(h2('4.2 POS komponente po kategorijah'))

pos_categories = [
    ['Naročanje', 'OrderPanel, PaymentDialog, ReceiptDialog, StornoDialog, VoidItemDialog, OrderBump, CoursePacing'],
    ['Kuhinja', 'KitchenDisplay, KitchenPrepQueue, KitchenStationManager'],
    ['Mize', 'TableMap, VisualFloorPlan, TableTurnoverAnalytics, TableReservationSync, WaitTimeEstimator'],
    ['Meni', 'MenuManager, MenuEngineeringMatrix, AllergenFilter, AllergenMatrix'],
    ['Inventar', 'InventoryManager, InventoryAlerts, StockDashboard, SupplierManager, VendorScorecard, FoodCostCalculator, RecipeManager, RecipeScaling'],
    ['Osebje', 'EmployeeManager, StaffScheduler, StaffPerformance, ShiftManager, ShiftOverview, TipManager'],
    ['Financno', 'CashRegister, ReportsView, ProfitLossReport, TaxReport, ZReportManager, ExpenseTracker, EndOfDayManager, DailyChecklist'],
    ['Gostje', 'GuestManager, CustomerTimeline, CustomerFeedback, ReservationManager, WaitlistManager, LoyaltyManager, GiftCardManager'],
    ['Dostava', 'DeliveryManager, DeliveryTracker'],
    ['Sistem', 'SettingsManager, ConfigurationManager, IntegrationManager, WebhookManager, PrinterManager, FursManager, LocationManager, MultiLocationDashboard, SubscriptionManager'],
    ['Skladnost', 'HaccpManager, ComplianceDashboard, NutritionalCalculator'],
    ['AI', 'AIAssistant, AIRecommendations, AIForecastDashboard'],
    ['Navigacija', 'Sidebar, KioskBar, PinLogin, GlobalNotifications, NotificationManager, LanguageSwitcher, HappyHourBanner, StatsCard'],
]

story.append(make_table(
    ['Kategorija', 'Komponente'],
    pos_categories,
    col_ratios=[0.15, 0.85]
))

story.append(h2('4.3 Zustand Store'))

story.append(p(
    'Osrednji Zustand store (usePOSStore) upravlja stanje POS terminala z naslednjimi kljucnimi podatki: '
    'activeModule (trenutno prikazan modul), cart (kosarica z DDV izracunom), orderType (dine-in/takeout/delivery), '
    'selectedTable, discount, sidebarOpen, activeMenuId, editingOrderId, taxRate, appliedDiscountId, '
    'diningOptionId, kioskMode, locale/country, activePriceGroupId, happyHourActive. '
    'Kosarica uporablja cartKey = itemId_sortedModifierIds, kar omogoca dodajanje enakega artikla z razlicnimi '
    'prilagoditvami. Popust se porazdeli proporcionalno po DDV stopnjah z automatic proracunom.'
))

story.append(h2('4.4 Realni cas (WebSocket)'))

story.append(p(
    'Custom Node.js streznik (server.js) zagotavlja WebSocket podporo na poti /ws s prepoznavo strank '
    'prek IDENTIFY sporocila, srckanim utripanjem vsakih 30 sekund in broadcast funkcijo izpostavljeno kot '
    'globalThis.__wsBroadcast za API rute. KDS stran uporablja /ws/kds za samostojno povezavo. '
    'Dogodki: new_order, order_ready, order_update, CONNECTED. Polling je implementiran kot rezerva: '
    'Waiter (10s), KDS (5s), Order Status (15s), QR Order (10s), Sidebar orders (30s), Menu stock (30s).'
))

story.append(h2('4.5 Lokalizacija (i18n)'))

story.append(p(
    'Dvojni lokalizacijski sistem: (1) next-intl s 5 jezikovnimi datotekami v messages/ z 293+ kljuci na jezik '
    '(sl, en, it, hr, de) in (2) inline prevodi v QR straneh. Jezik se shrani v NEXT_LOCALE piškotek '
    'prek middleware.ts in v localStorage prek Zustand storeja. Drzavna konfiguracija (country-config.ts) '
    'preslika locale v drzavo s pripadajocimi davcnimi stopnjami, valuto, zastavami in zahtevami FURS. '
    'Podprte drzave: SI, HR, IT, AT, DE z DDV stopnjami 22%/9.5%/0% za Slovenijo.'
))

# ══════════════════════════════════════════════════════════════════
# 5. AVTENTIKACIJA IN VARNOST
# ══════════════════════════════════════════════════════════════════
story.extend(h1('5. Avtentikacija in varnost'))

story.append(p(
    'RestaurantOS implementira lasten avtentikacijski sistem zasnovan za restavratorsko okolje, kjer zaposleni '
    'uporabljajo numericne PIN kode namesto gesel. Sistem vsebuje vec plasti varnosti: bcrypt hashiranje PIN-ov '
    'z migracijo iz obicajnega besedila, Bearer tokeni z 32-bajtno nakljucno vrednostjo, pomnilniska shramba '
    'sej z omejitvami velikosti in casa, IP-omejitev hitrosti prijave ter sistem dovoljenj z 9 nivoji.'
))

story.append(h2('5.1 Potek prijave'))

story.append(p(
    'Zaposleni vnese 4-6 mestni PIN na PinLogin komponenti z na-zaslonu numericno tipkovnico. Streznik preveri '
    'PIN z bcrypt.compare() s prilagodljivim preverjanjem obicajnega besedila za nazadnjezdruzljivost. '
    'Ustvari se Bearer token (crypto.randomBytes(32).toString(hex)), ki se shrani v pomnilnisko Map z '
    '8-urnim TTL in 24-urnim absolutnim maksimumom. Odjemalec shrani token v localStorage in ga posreduje '
    'v Authorization: Bearer <token> glavi vsake API zahteve. Seja se podaljsa ob vsaki avtentificirani '
    'zahtevki, a ne presega absolutnega roka. Ko se doseze omejitev 500 sej, se najstarejša seja izloci.'
))

story.append(h2('5.2 Dovoljenja (RBAC)'))

perms = [
    ['take_orders', 'POS naročalne operacije', 'Natakar, kuhar'],
    ['void_items', 'Preklic/odstranitev postavk', 'Natakar z izkusnjami'],
    ['apply_discounts', 'Uveljavljanje popustov in promocij', 'Natakar vodja'],
    ['manage_cash', 'Blagajna, placila, karticni terminal', 'Blagajnik'],
    ['manage_inventory', 'Inventar, zaloge, dobavitelji, recepti', 'Skladistnik'],
    ['manage_employees', 'Upravljanje zaposlenih, smen, urne evidence', 'Vodja osebja'],
    ['view_reports', 'Nadzorna plosca, analitika, porocila', 'Vodja, manager'],
    ['admin', 'Popoln dostop - FURS, webhook, nastavitve, integracije, seed', 'Administrator'],
]

story.append(make_table(
    ['Dovoljenje', 'Opis', 'Tipicna vloga'],
    perms,
    col_ratios=[0.20, 0.52, 0.28]
))

story.append(h2('5.3 Varnostni ukrepi'))

security = [
    ['PIN hashiranje', 'bcrypt z avtomatsko migracijo iz obicajnega besedila'],
    ['Rate limiting prijave', '5 poskusov v 15-minutnem oknu z IP zaklepom'],
    ['Bearer tokeni', '32-bajtna nakljucna vrednost, pomnilniska shramba z TTL'],
    ['Seja omejitev', '500 soocasnih sej, najstarejsa se izloci'],
    ['Varnostne glave', 'X-Frame-Options: DENY, X-Content-Type-Options: nosniff, itd.'],
    ['HMAC webhook preverjanje', 'SHA-256 podpisovanje za Wolt in Glovo vhodne webhook'],
    ['Audit log z hash verigo', 'SHA-256 chainHash za zašcito pred posegi v revizijski dnevnik'],
    ['Zod validacija', 'Vsi API vhodi validirani s shemami pred obdelavo'],
    ['Soft-delete', 'Narocila, zaposleni, inventar - nikoli trajno brisani'],
    ['CORS omejitve', 'Javne rute z omejenim dostopom in rate limiting'],
]

story.append(make_table(
    ['Ukrepek', 'Podrobnosti'],
    security,
    col_ratios=[0.28, 0.72]
))

# ══════════════════════════════════════════════════════════════════
# 6. POSLOVNA LOGIKA
# ══════════════════════════════════════════════════════════════════
story.extend(h1('6. Poslovna logika'))

story.append(p(
    'RestaurantOS implementira obsežno poslovno logiko, ki pokriva celoten življenjski cikel restavratorskega '
    'poslovanja: od naročanja in placila prek fiskalizacije in inventarja do porocanja in analytike. '
    'Kljucne komponente poslovne logike so implementirane v lib/ datotekah in API rutah z transakcijsko '
    'celovitostjo in avtomatskimi stranskimi učinki.'
))

story.append(h2('6.1 Zivljenjski cikel naročila'))

story.append(p(
    'Naročilo poteka skozi vec faz: ustvarjanje (POST /api/orders) z avtomatskim izracunom DDV, '
    'odštetjem zaloge in WebSocket obvestilom; dodajanje postavk (POST /api/orders/[id]/add-items) s '
    'strezniskim določanjem cen in odštetjem zaloge; posodobitev statusa (PATCH /api/orders/[id]) za '
    'KDS bump in avtomatsko promocijo statusa naročila; placilo (POST /api/payments) s podporo za '
    'split-check, vec tipov placil in avtomatskim tiskanjem racuna; fiskalizacija (POST /api/furs) z '
    'generiranjem ZOI/EOR in QR kode; storno (PUT /api/furs) z vracanjem zaloge in FURS preverjanjem; '
    'preklic (DELETE /api/orders/[id]) s soft-delete, vracanjem zaloge in sprostitvijo mize.'
))

story.append(h2('6.2 Inventarna logika'))

story.append(p(
    'Inventarni sistem je trdno povezan s sistemom naročil. Ko se naročilo ustvari, se kliče '
    'deductStockForOrder(), ki atomsoko zmanjsa kolicino v InventoryItem in ustvari StockTransaction '
    'za vsako postavko. Ce zmanjka zaloge, se odda obvestilo o nizki zalogi prek WebSocket broadcast. '
    'Napovedovanje porabe (Holt-Winters) je na voljo prek /api/inventory/forecast. Pametno predlaganje '
    'ponovnega naročanja (/api/inventory/reorder) uporablja podatke o porabi in napovedi za avtomatsko '
    'generiranje nakupnih nalogov. Popust se porazdeli proporcionalno po DDV stopnjah v kosarici.'
))

story.append(h2('6.3 Fiskalizacija (FURS)'))

story.append(p(
    'FURS fiskalizacija je implementirana za slovensko zakonodajo z generiranjem ZOI (Zašcitni Oznacni Instrument) '
    'in EOR (Elektronski Oznacni Racun) ter QR kode za preverjanje racuna. Podprt je batch preverjanje do 50 '
    'racunov z 200ms zamikom med klici. Storno postopek ustvari nov racun s povezavo na originalnega. '
    'Digitalni racun je javno dostopen prek /api/digital-receipt. FURS certifikati so shranjeni po lokaciji '
    'za podporo vec lokacij. Testni nacin je podprt s FURS_ALLOW_SIMULATION=true okoljsko spremenljivko.'
))

story.append(h2('6.4 Esc/POS tiskanje'))

story.append(p(
    'Tiskalniški sistem (lib/escpos.ts) implementira ESC/POS protokol za termicne tiskalnike prek TCP/IP '
    'povezave. Podprti so termicni, matrični in nalepnicni tiskalniki. Tiskanje se sproži avtomatsko '
    'pri ustvarjanju naročila (kuhinjski bon) in placilu (racun). Konfiguracija tiskalnikov je po postajah '
    '(kuhinja, bar, racun) s specificiranimi IP naslovi in pristani.'
))

# ══════════════════════════════════════════════════════════════════
# 7. STATISTIKA IN Povzetek
# ══════════════════════════════════════════════════════════════════
story.extend(h1('7. Statistika projekta'))

stats = [
    ['Prisma modeli', '45'],
    ['API datoteke z rutami', '101'],
    ['HTTP koncnih tock', '150+'],
    ['POS poslovne komponente', '62'],
    ['shadcn/ui primitivne komponente', '48'],
    ['Strani (Routes)', '12'],
    ['Zustand store stanja', '17+'],
    ['Jeziki lokalizacije', '5 (SL, EN, IT, HR, DE)'],
    ['Drzave s konfiguracijo', '5 (SI, HR, IT, AT, DE)'],
    ['Menu artikli', '438'],
    ['Inventarni artikli', '26'],
    ['Kategorije slik', '30+'],
    ['DDV stopnje', '22%, 9.5%, 0%'],
    ['Dovoljenja RBAC', '9 nivojev'],
    ['Webhook dogodki', '8 tipov'],
    ['Tipi placil', '7 (cash, card, mobile, voucher, loyalty, giftcard, alternate)'],
    ['Realni cas', 'WebSocket + Polling'],
    ['PWA podpora', 'Service Worker + offline naročanje'],
    ['Implementacija', 'Docker + PM2 + Caddy + daemon'],
]

story.append(make_table(
    ['Metrika', 'Vrednost'],
    stats,
    col_ratios=[0.45, 0.55]
))

# ══════════════════════════════════════════════════════════════════
# 8. POPRAVKI SLIK (Zgodovina dela)
# ══════════════════════════════════════════════════════════════════
story.extend(h1('8. Popravki slik artiklov'))

story.append(p(
    'Med analizo repozitorija smo ugotovili, da je 43 od 438 slik menijskih artiklov prikazovalo ikone/grafike '
    'namesto pravih fotografij hrane in pijac. Problem je bil najbolj izrazit v kategoriji Kalamari (5 od 7 slik), '
    'kjer so bili prikazani risani lignji namesto fotografij jedi. Uporabili smo avtomatiziran postopek: '
    'Python analiza variance barv za identifikacijo sumljivih slik (varianca < 500 in velikost < 92KB), '
    'regeneracija z AI generiranjem pravih fotografij hrane in pijac, ter VLM preverjanje ujemanja.'
))

story.append(h2('8.1 Regenerirane slike po kategorijah'))

regenerated = [
    ['Kalamari', '5', 'na-zaru, mesani, ocvrti, zar-rukoli, polnjeni-zar'],
    ['Sladice', '10', 'palacinke (4 razlicice), tiramisu, vroce visnje, gozdni sadezi, nutelina torta, cokoladni souffle'],
    ['Vegetarijanske jedi', '5', 'sojini polpeti, zelenjavni zrezki, ocvrti melancani, vegetarijanska plosca, bucke na zaru'],
    ['Omake', '4', 'gobova, orehova, poprova, gozdarska omaka'],
    ['Grencice', '3', 'amaro, jagermeister, cynar'],
    ['Destilati', '3', 'ararat-20, delamaine-xo, hennessy-xo'],
    ['Viski', '2', 'lagavulin-16, laphroaig-10'],
    ['Palacinke', '3', 'kinder-bueno, ferrero-rocher, snickers'],
    ['Gazirane pijace', '2', 'coca-cola-zero, cockta'],
    ['Likerji', '1', 'borovnica-kejzar'],
    ['Mesane pijace', '1', 'cuba-libre'],
    ['Malice', '3', 'bograc, goveji golaz, pecena rebra'],
    ['Otroške jedi', '1', 'pizza-jurcek'],
    ['Hladne predjedi', '1', 'sirova plosca'],
    ['Skupaj', '43', 'Vse regenerirane slike preverjene z VLM kot MATCH'],
]

story.append(make_table(
    ['Kategorija', 'St.', 'Artikli'],
    regenerated,
    col_ratios=[0.20, 0.06, 0.74]
))

story.append(h2('8.2 Inventarni artikli'))

story.append(p(
    'Vseh 26 inventarnih artiklov ima pravilno povezane slike v bazi podatkov in na disku. Avtomatizirana '
    'analiza variance (varianca > 500 ali velikost > 92KB) potrjuje, da so vse slike prave fotografije '
    'surovin in ne ikone ali grafike. Popravek prejšnjega napačnega poročila: vse slike so ze bile povezane '
    'v bazi podatkov.'
))

# ══════════════════════════════════════════════════════════════════
# 9. POTENCIALNE IZBOLJSAVE
# ══════════════════════════════════════════════════════════════════
story.extend(h1('9. Potencialne izboljsave in ugotovitve'))

story.append(p(
    'Med analizo repozitorija smo identificirali vec podrocij za potencialne izboljsave, ki jih priporocamo '
    'za pregled in implementacijo. Te ugotovitve temeljijo na pregledu kode, arhitekture in poslovne logike.'
))

improvements = [
    ['Pomnilniska shramba sej', 'Srednje', 'Trenutno seje shranjene v Map v pomnilniku. Ob restartu streznika vse seje poteknejo. Priporocamo migracijo na SQLite/Redis za trajnost sej.'],
    ['Brez Prisma migracij', 'Nizka', 'Projekt uporablja db push namesto migracij. Za produkcijo priporocamo uvod prisma migrate dev za sledljivost sprememb sheme.'],
    ['ESLint pravila izklopljena', 'Nizka', 'Skoraj vsa ESLint pravila so izklopljena. Priporocamo postopno vklapljanje pravil za kakovost kode, zlasti no-explicit-any in no-unused-vars.'],
    ['Ni strezniskih akcij', 'Nizka', 'Vsa strezniska logika je v API rutah. Za preproste CRUD operacije bi Server Actions zmanjsali kolicino kode in izboljsali UX z optimistic updates.'],
    ['Javne rute brez avtentikacije', 'Visoka', 'Javne rute (/api/public/*) nimajo avtentikacije. So sicer z rate limiting, a bi dodatno preverjanje (CAPTCHA, IP whitelist) izboljsalo varnost.'],
    ['Manjkajoč loading/not-found', 'Nizka', 'Ni loading.tsx ali not-found.tsx datotek. Uporabniki vidijo prazno stran med nalaganjem ali ob napacni poti.'],
    ['Form handling neenoten', 'Nizka', 'Javne strani uporabljajo rocni useState namesto react-hook-form, ki je ze namešcen. Priporocamo dosledno uporabo za boljso validacijo.'],
    ['Inline prevodi QR strani', 'Nizka', 'QR strani imajo lastne inline prevode namesto uporabe next-intl sistema. Priporocamo konsolidacijo v message datoteke.'],
    ['WebSocket brez avtentikacije', 'Srednje', 'WebSocket povezave nimajo avtentikacije. Kdo koli se lahko poveze na /ws in prejema obvestila. Priporocamo preverjanje tokena ob povezavi.'],
]

story.append(make_table(
    ['Ugotovitev', 'Prioriteta', 'Priporocilo'],
    improvements,
    col_ratios=[0.22, 0.10, 0.68]
))

# ── Build ──
doc.multiBuild(story)
print(f'PDF generated: {output_path}')
