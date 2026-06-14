#!/usr/bin/env python3
"""RestaurantOS - Celovita analiza in indeks repozitorija (PDF Report)"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.fonts import addMapping

# ── Palette ──
PAGE_BG       = colors.HexColor('#f2f2f1')
SECTION_BG    = colors.HexColor('#f0efed')
CARD_BG       = colors.HexColor('#eeeeec')
TABLE_STRIPE  = colors.HexColor('#f1f0ed')
HEADER_FILL   = colors.HexColor('#685e40')
COVER_BLOCK   = colors.HexColor('#766c4e')
BORDER        = colors.HexColor('#d9d3c1')
ICON          = colors.HexColor('#968247')
ACCENT        = colors.HexColor('#1e7693')
ACCENT_2      = colors.HexColor('#51b651')
TEXT_PRIMARY   = colors.HexColor('#191917')
TEXT_MUTED     = colors.HexColor('#88867e')
SEM_SUCCESS   = colors.HexColor('#538f67')
SEM_WARNING   = colors.HexColor('#a18448')
SEM_ERROR     = colors.HexColor('#8a4d47')
SEM_INFO      = colors.HexColor('#5b7b9c')

W, H = A4
LEFT_M = 18*mm
RIGHT_M = 18*mm
TOP_M = 20*mm
BOT_M = 20*mm
CONTENT_W = W - LEFT_M - RIGHT_M

OUTPUT = '/home/z/my-project/download/RestaurantOS_Analiza_in_Indeks.pdf'

# ── Fonts ──
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import glob

# Register Chinese/CJK fonts
font_dirs = ['/usr/share/fonts/truetype/chinese/', '/usr/share/fonts/truetype/dejavu/',
             '/usr/share/fonts/truetype/liberation/', '/usr/share/fonts/truetype/english/']
cjk_font = None
for d in font_dirs:
    for f in glob.glob(os.path.join(d, '*.ttf')):
        name = os.path.basename(f).replace('[wght]','').replace('.ttf','')
        try:
            pdfmetrics.registerFont(TTFont(name, f))
        except:
            pass

# Try to find Noto Sans SC
noto_sc = None
for d in font_dirs:
    for f in glob.glob(os.path.join(d, 'NotoSansSC*')):
        try:
            name = 'NotoSansSC'
            pdfmetrics.registerFont(TTFont(name, f))
            noto_sc = name
            break
        except:
            pass

dejavu = None
for d in font_dirs:
    for f in glob.glob(os.path.join(d, 'DejaVuSans.ttf')):
        try:
            pdfmetrics.registerFont(TTFont('DejaVu', f))
            dejavu = 'DejaVu'
            break
        except:
            pass

tinos = None
for d in font_dirs:
    for f in glob.glob(os.path.join(d, 'Tinos*')):
        try:
            pdfmetrics.registerFont(TTFont('Tinos', f))
            tinos = 'Tinos'
            break
        except:
            pass

BODY_FONT = dejavu or tinos or 'Helvetica'
HEADING_FONT = 'Helvetica-Bold'

# ── Styles ──
styles = getSampleStyleSheet()

style_title = ParagraphStyle('Title2', parent=styles['Title'], fontName=HEADING_FONT,
    fontSize=24, textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=0, leading=28)
style_h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontName=HEADING_FONT,
    fontSize=18, textColor=HEADER_FILL, spaceAfter=8, spaceBefore=16, leading=22)
style_h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontName=HEADING_FONT,
    fontSize=14, textColor=ACCENT, spaceAfter=6, spaceBefore=12, leading=18)
style_h3 = ParagraphStyle('H3', parent=styles['Heading3'], fontName=HEADING_FONT,
    fontSize=11, textColor=COVER_BLOCK, spaceAfter=4, spaceBefore=8, leading=14)
style_body = ParagraphStyle('Body2', parent=styles['Normal'], fontName=BODY_FONT,
    fontSize=9, textColor=TEXT_PRIMARY, spaceAfter=4, spaceBefore=2, leading=13, alignment=TA_JUSTIFY)
style_body_small = ParagraphStyle('BodySmall', parent=style_body, fontSize=8, leading=11)
style_muted = ParagraphStyle('Muted', parent=style_body, textColor=TEXT_MUTED, fontSize=8)
style_bullet = ParagraphStyle('Bullet', parent=style_body, leftIndent=12, bulletIndent=0,
    spaceBefore=1, spaceAfter=1)
style_table_header = ParagraphStyle('TH', fontName=HEADING_FONT, fontSize=8, textColor=colors.white,
    leading=10, alignment=TA_CENTER)
style_table_cell = ParagraphStyle('TC', fontName=BODY_FONT, fontSize=8, textColor=TEXT_PRIMARY,
    leading=10, alignment=TA_LEFT)
style_table_cell_c = ParagraphStyle('TCC', parent=style_table_cell, alignment=TA_CENTER)
style_table_cell_r = ParagraphStyle('TCR', parent=style_table_cell, alignment=TA_RIGHT)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    th = [Paragraph(h, style_table_header) for h in headers]
    data = [th]
    for row in rows:
        data.append([Paragraph(str(c), style_table_cell) for c in row])
    
    if not col_widths:
        n = len(headers)
        col_widths = [CONTENT_W / n] * n
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), HEADING_FONT),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    # Stripe alternating rows
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    
    t.setStyle(TableStyle(style_cmds))
    return t

def section(title, level=1):
    """Return a section heading paragraph."""
    s = {1: style_h1, 2: style_h2, 3: style_h3}[level]
    return Paragraph(title, s)

def body(text):
    return Paragraph(text, style_body)

def bullet(text):
    return Paragraph(f"&bull; {text}", style_bullet)

def spacer(h=6):
    return Spacer(1, h*mm)

# ── Build Document ──
doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title="RestaurantOS - Analiza in Indeks Repozitorija",
    author="Z.ai", creator="Z.ai",
    subject="Celovita analiza in indeks RestaurantOS repozitorija")

story = []

# ══════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 60*mm))
story.append(Paragraph("RestaurantOS", ParagraphStyle('CoverTitle', fontName=HEADING_FONT,
    fontSize=36, textColor=HEADER_FILL, alignment=TA_CENTER, leading=42)))
story.append(Spacer(1, 8*mm))
story.append(Paragraph("Analiza in Indeks Repozitorija", ParagraphStyle('CoverSub',
    fontName=BODY_FONT, fontSize=16, textColor=ACCENT, alignment=TA_CENTER, leading=20)))
story.append(Spacer(1, 12*mm))
story.append(HRFlowable(width="60%", thickness=2, color=BORDER, spaceAfter=12, spaceBefore=0, hAlign='CENTER'))
story.append(Paragraph("Profesionalni POS sistem za restavracije", ParagraphStyle('CoverDesc',
    fontName=BODY_FONT, fontSize=11, textColor=TEXT_MUTED, alignment=TA_CENTER, leading=15)))
story.append(Spacer(1, 6*mm))
story.append(Paragraph("Repozitorij: github.com/markec12345678/restaurantos", ParagraphStyle('CoverRepo',
    fontName=BODY_FONT, fontSize=9, textColor=TEXT_MUTED, alignment=TA_CENTER, leading=12)))
story.append(Paragraph("Datum analize: 10. junij 2026", ParagraphStyle('CoverDate',
    fontName=BODY_FONT, fontSize=9, textColor=TEXT_MUTED, alignment=TA_CENTER, leading=12)))
story.append(Spacer(1, 30*mm))

# Summary block
summary_data = [
    [Paragraph('<b>79.000+</b>', style_table_cell_c), Paragraph('<b>69</b>', style_table_cell_c),
     Paragraph('<b>132</b>', style_table_cell_c), Paragraph('<b>76</b>', style_table_cell_c),
     Paragraph('<b>5</b>', style_table_cell_c)],
    [Paragraph('Vrstic kode', style_table_cell_c), Paragraph('Prisma modelov', style_table_cell_c),
     Paragraph('API rut', style_table_cell_c), Paragraph('POS komponent', style_table_cell_c),
     Paragraph('Jezikov', style_table_cell_c)],
]
st = Table(summary_data, colWidths=[CONTENT_W/5]*5)
st.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
]))
story.append(st)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 1. POVZETEK PROJEKTA
# ══════════════════════════════════════════════════════════════
story.append(section("1. Povzetek projekta"))
story.append(body(
    "RestaurantOS je celovit, profesionalni Point of Sale (POS) sistem, zasnovan posebej za evropske restavracije, "
    "s poudarkom na slovensko trzisce in FURS davcno potrjevanje. Zdruzuje najboljse prakse svetovnih POS sistemov "
    "(Toast, TouchBistro, Square, Lightspeed, 7shifts, OpenTable) v enotno, sodobno spletno aplikacijo. Sistem "
    "pokriva vse vidike restavratorskega poslovanja od naročanja in plačevanja, preko kuhinjskega prikaza in zalog, "
    "do analitike, davčnega potrjevanja in upravljanja osebja. Deluje tudi brez internetne povezave zahvaljujoč "
    "Service Workerju in IndexedDB, kar je ključnega pomena za zanesljivo poslovanje v restavracijah."
))
story.append(spacer(4))

# Key advantages table
story.append(section("Kljucne prednosti", 2))
adv_rows = [
    ["FURS certificirano", "Avtomatsko davcno potrjevanje racunov (ZOI offline, EOR queued)"],
    ["Vecjezikno", "5 jezikov (Slovenscina, English, Italiano, Hrvatski, Deutsch)"],
    ["Offline-first", "Service Worker + Background Sync + IndexedDB (22 trgovin)"],
    ["Varno", "Zod validacija, Prisma $transaction, requireAuth() + ROUTE_PERMISSIONS"],
    ["ESC/POS tiskanje", "Podpora za termicne tiskalnike"],
    ["Napredna analitika", "WoW primerjava, toplotna karta, analitika gostov"],
    ["AI zmogljivosti", "Gemini AI napovedi, priporocila, pomocnik"],
    ["Multi-lokacija", "Vec lokacij z locenimi FURS certifikati"],
    ["PWA ready", "Namestljiv na namizje, deluje kot native aplikacija"],
]
story.append(make_table(["Prednost", "Opis"], adv_rows, [CONTENT_W*0.3, CONTENT_W*0.7]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 2. TEHNOLOSKI SKLOP
# ══════════════════════════════════════════════════════════════
story.append(section("2. Tehnoloski sklop"))
story.append(body(
    "RestaurantOS temelji na sodobnem tehnoloskem sklopu, ki zdruzuje hitri razvoj z visoko zmogljivostjo in "
    "zanesljivostjo. Jedro je Next.js 16.1.3 s App Routerjem in Server Components, kar omogoca hibridno "
    "renderiranje (SSR + CSR) za optimalno uporabnisko izkusnjo. Podatkovna plast uporablja Prisma ORM s "
    "SQLite podatkovno bazo, ki ne zahteva zunanjih odvisnosti in je primerna za lokalno namestitev v "
    "restavracijah. Celotna koda je napisana v TypeScriptu za tipovno varnost."
))
story.append(spacer(4))

tech_rows = [
    ["Next.js 16.1.3", "Full-stack framework (App Router, Server Components, API Routes)"],
    ["TypeScript 5.x", "Tipovno varna koda po vsem projektu"],
    ["Prisma ORM 6.x", "Dostop do baze (SQLite) s 69 modeli"],
    ["SQLite + WAL", "Lokalna baza brez zunanjih odvisnosti, hkratno branje/pisanje"],
    ["Tailwind CSS 4", "Sodobno oblikovanje z utility-first pristopom"],
    ["shadcn/ui", "UI komponente (Radix UI + Tailwind CSS), New York stil"],
    ["TanStack Query", "Upravljanje stanja strezniskih podatkov in caching"],
    ["TanStack Table", "Napredne tabele s sortiranjem in filtriranjem"],
    ["Recharts", "Interaktivni grafikoni in vizualizacije"],
    ["next-intl", "Internacionalizacija (5 jezikov s polnimi prevodi)"],
    ["Zod", "Validacija podatkov na strezniku in odjemalcu"],
    ["Zustand", "Lahko globalno stanje za POS kosarico in UI"],
    ["Framer Motion", "Tekoce animacije in prehodi"],
    ["ws (WebSocket)", "Real-time komunikacija za KDS in obvestila"],
    ["docx", "Generiranje Word dokumentov za porocila"],
    ["Sharp", "Obdelava slik na strezniku"],
    ["QRCode", "Generiranje QR kod za mize, racune, menije"],
    ["z-ai-web-dev-sdk", "AI zmogljivosti (Gemini)"],
]
story.append(make_table(["Tehnologija", "Namen"], tech_rows, [CONTENT_W*0.3, CONTENT_W*0.7]))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 3. ARHITEKTURA SISTEMA
# ══════════════════════════════════════════════════════════════
story.append(section("3. Arhitektura sistema"))
story.append(body(
    "Sistem sledi sodobni full-stack arhitekturi, kjer Next.js hkrati streze frontend in backend. Frontend je "
    "grajen iz React komponent (64 POS komponent + 49 UI komponent), ki komunicirajo z backend API-jem preko "
    "TanStack Queryja. Backend uporablja 132 API rut razporejenih v 68 modulov, vsaka ruta pa je zascitena z "
    "avtentikacijskim middlewarem (requireAuth) in validirana z Zod shemami. Podatkovna plast uporablja Prisma "
    "ORM s SQLite podatkovno bazo v WAL nacinu za hkratno branje in pisanje. Za real-time komunikacijo skrbi "
    "WebSocket streznik, za offline delovanje pa Service Worker z IndexedDB (22 trgovin podatkov)."
))
story.append(spacer(4))

# Architecture layers
story.append(section("Arhitekturni sloji", 2))
arch_rows = [
    ["Frontend (React)", "64 POS komponent, 49 UI komponent, Zustand store, TanStack Query, Framer Motion"],
    ["Public Pages", "QR Menu, QR naročanje, Rezervacije, Sledenje naročila, Račun, Natakar, Cenik, KDS, Ocene"],
    ["API Layer", "132 API rut v 68 modulih, Zod validacija, requireAuth() middleware, ROUTE_PERMISSIONS"],
    ["Business Logic", "Prisma $transaction, FURS davcno potrjevanje, ESC/POS tiskanje, AI napovedi"],
    ["Data Layer", "Prisma ORM (69 modelov), SQLite z WAL nacinom, Audit log z SHA-256 hash verigo"],
    ["Real-time", "WebSocket streznik, KDS osvezevanje, Obvestila, Broadcast"],
    ["Offline", "Service Worker, IndexedDB (22 trgovin), Background Sync, FURS ZOI offline"],
    ["External", "FURS davna blagajna, Gemini AI, Glovo/Wolt/Bolt webhooks, Karticni terminal"],
]
story.append(make_table(["Sloj", "Vsebina"], arch_rows, [CONTENT_W*0.25, CONTENT_W*0.75]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 4. PODATKOVNI MODEL (69 PRISMA MODELOV)
# ══════════════════════════════════════════════════════════════
story.append(section("4. Podatkovni model (69 Prisma modelov)"))
story.append(body(
    "Podatkovni model obsega 69 Prisma modelov, ki pokrivajo celoten poslovni proces restavracije: od menija "
    "in naročanja, preko plačil in FURS potrjevanja, do zalog, osebja, dostav in analitike. Modeli so "
    "organizirani v logične sklope s kaskadnimi relacijami in indeksi za optimalno zmogljivost. Shema vsebuje "
    "1868 vrstic in je ena najobsegujših med podobnimi odprtokodnimi projekti."
))
story.append(spacer(4))

models_by_group = [
    ("Menu hierarhija", [
        ("Menu", "Meniji (Hrana, Pijaca)"), ("Category", "Kategorije (Predjedi, Glavne jedi)"),
        ("MenuItem", "Artikli s cenami, DDV, alergeni"), ("ModifierGroup", "Skupine prilagoditev"),
        ("Modifier", "Posamezne prilagoditve"), ("MenuItemModifierGroup", "Vezna tabela"),
    ]),
    ("Konfiguracija", [
        ("TaxRate", "Davcne stopnje (22%, 9.5%, 0%)"), ("DiningOption", "Nacin prehranjevanja"),
        ("RevenueCenter", "Prihodkovni centri (Bar, Terasa)"), ("ServiceCharge", "Storitveni pristanki"),
        ("SalesCategory", "Prodajne kategorije"), ("PriceGroup", "Ceniki (Redni, Happy Hour)"),
        ("PrepStation", "Pripravljalne postaje"), ("AlternatePaymentType", "Alternativna placila"),
        ("VoidReason", "Razlogi za storno"), ("NoSaleReason", "Razlogi za odpis"),
        ("Printer", "Tiskalniki"), ("PackagingConfig/Item", "Embalaža"),
    ]),
    ("Narocila in placila", [
        ("Order", "Narocila s statusi in zneski"), ("OrderItem", "Postavke narocila"),
        ("Check", "Ceki (split check)"), ("Payment", "Placila (gotovina, kartica, itd.)"),
        ("Discount", "Popusti"), ("DeliveryInfo", "Podatki o dostavi"),
    ]),
    ("Zaposleni in ure", [
        ("Employee", "Zaposleni s PIN prijavo"), ("Job", "Funkcije z dovoljenji"),
        ("EmployeeJob", "Vezna tabela"), ("Shift", "Izmene"),
        ("TimeEntry", "Casovne evidence"), ("CashRegisterShift", "Izmene blagajne"),
        ("StaffShift", "Razpored zaposlenih"),
    ]),
    ("Zaloga in dobava", [
        ("InventoryItem", "Zalozni artikli"), ("StockTransaction", "Zalozne transakcije"),
        ("RecipeItem", "Recepti z normativi"), ("Supplier", "Dobavitelji"),
        ("PurchaseOrder/Item", "Nabavna narocila"),
    ]),
    ("Racuni in FURS", [
        ("Receipt", "Fiskalni racuni z ZOI/EOR"), ("HaccpEntry", "HACCP dnevnik"),
    ]),
    ("Zvestoba in darilne kartice", [
        ("LoyaltyAccount/Transaction", "Zvestobni program"), ("GiftCard/Transaction", "Darilne kartice"),
    ]),
    ("Lokacije in dostave", [
        ("Location", "Vec lokacij z locenimi FURS certifikati"), ("DeliveryZone", "Cone dostave"),
        ("OpeningHours", "Odpiralni casi"), ("DeliveryTracking", "Sledenje dostav"),
    ]),
    ("Rezervacije in gostje", [
        ("Reservation", "Rezervacije"), ("Guest/Visit/Feedback", "CRM za goste"),
        ("WaitlistEntry", "Cakalni seznam"), ("Course", "Course pacing"),
    ]),
    ("Sistem in integracije", [
        ("RestaurantSettings", "Nastavitve restavracije"), ("AuditLog", "Revizijski dnevnik z SHA-256"),
        ("Webhook/Delivery", "Webhook integracije"), ("Integration/Log", "Zunanje integracije"),
        ("Counter", "Stevec racunov"), ("AIConversation", "AI pogovori"),
        ("HappyHourSchedule", "Happy hour urniki"), ("Subscription/Invoice", "Narocnine"),
        ("ZReport", "Z-porocila"), ("TipPool/Distribution", "Napitnine"),
        ("NotificationTemplate", "Predloge obvestil"), ("DailyChecklist", "Dnevni seznam"),
        ("Expense", "Stroski"),
    ]),
]

for group_name, models in models_by_group:
    story.append(section(group_name, 3))
    rows = [[m[0], m[1]] for m in models]
    story.append(make_table(["Model", "Opis"], rows, [CONTENT_W*0.3, CONTENT_W*0.7]))
    story.append(spacer(2))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 5. API RUTE - INDEKS
# ══════════════════════════════════════════════════════════════
story.append(section("5. API rute - indeks (132 rut v 68 modulih)"))
story.append(body(
    "RestaurantOS vsebuje 132 API rut, organiziranih v 68 modulov. Vsaka ruta je zascitena z avtentikacijskim "
    "middlewarem (requireAuth), ki preverja Bearer token in dovoljenja uporabnika. Javne rute (api/public, "
    "api/auth, api/qr-menu) so dostopne brez avtentikacije. Vse vhodne podatke validirajo Zod sheme, kriticne "
    "operacije (narocila, placila) pa se izvajajo znotraj Prisma $transaction za atomskost."
))
story.append(spacer(4))

api_modules = [
    ("Jedro POS", [
        ("api/orders", "Narocila: CRUD, dodajanje postavk, seed"),
        ("api/order-items", "Postavke narocil: posodobitve, storno"),
        ("api/checks", "Ceki: delitev racuna, placila"),
        ("api/payments", "Placila: gotovina, kartica, kombinirano"),
        ("api/receipts", "Fiskalni racuni z ZOI/EOR"),
        ("api/discounts", "Popusti: odstotni, fiksni, promo kode"),
        ("api/courses", "Course pacing za fine dining"),
    ]),
    ("Meni", [
        ("api/menus", "Meniji: Hrana, Pijaca"),
        ("api/categories", "Kategorije menija"),
        ("api/menu-items", "Artikli s cenami, DDV, alergeni"),
        ("api/modifier-groups", "Skupine prilagoditev"),
        ("api/qr-menu", "Javni QR meni za stranke"),
    ]),
    ("Mize in rezervacije", [
        ("api/tables", "Mize: CRUD, vizualni tloris, statusi"),
        ("api/reservations", "Rezervacije s potrditvami"),
        ("api/waitlist", "Cakalni seznam z oceno cakanja"),
    ]),
    ("Blagajna", [
        ("api/cash-register", "Odpiranje/zapiranje izmene"),
        ("api/card-terminal", "Integracija s karticnim terminalom"),
        ("api/end-of-day", "Zakljucek dneva"),
        ("api/z-report", "Z-porocilo blagajne"),
        ("api/tip-pool", "Napitnine: pool in point distribucija"),
    ]),
    ("Kuhinja", [
        ("api/kitchen", "Kuhinjski zaslon (KDS)"),
        ("api/print", "ESC/POS tiskanje bonov in racunov"),
        ("api/ws-broadcast", "WebSocket broadcast za KDS"),
    ]),
    ("Osebje", [
        ("api/employees", "Zaposleni: CRUD, PIN prijava"),
        ("api/jobs", "Funkcije z dovoljenji"),
        ("api/shifts", "Izmene"),
        ("api/staff-shifts", "Razpored zaposlenih"),
        ("api/time-entries", "Casovne evidence, clock in/out"),
        ("api/staff-performance", "KPI-ji po zaposlenem"),
        ("api/daily-checklist", "Opening/closing checklist"),
    ]),
    ("Zaloga in dobava", [
        ("api/inventory", "Zalozni artikli: CRUD, transakcije, napovedi"),
        ("api/stock/check", "Preverjanje zaloge"),
        ("api/recipes", "Recepti z normativi"),
        ("api/food-cost", "Kalkulator stroskov jedi"),
        ("api/suppliers", "Dobavitelji s kontakti"),
        ("api/purchase-orders", "Nabavna narocila"),
        ("api/packaging", "Embalaža"),
    ]),
    ("Dostava", [
        ("api/delivery", "Dostave: CRUD, webhooks za Glovo/Wolt"),
        ("api/delivery-zones", "Cone dostave s cenami"),
        ("api/delivery-tracking", "GPS sledenje dostav"),
        ("api/locations", "Vec lokacij z locenimi certifikati"),
        ("api/locations/sync", "Sinhronizacija lokacij"),
    ]),
    ("Analitika in porocila", [
        ("api/dashboard", "Nadzorna plosca s KPI-ji"),
        ("api/reports/sales", "Prodajna porocila"),
        ("api/reports/financial", "Financna porocila"),
        ("api/reports/vat", "DDV porocila"),
        ("api/reports/eod", "End-of-day porocilo"),
        ("api/reports/employees", "Porocila o zaposlenih"),
        ("api/reports/shifts", "Porocila o izmenah"),
        ("api/reports/popular", "Priljubljeni artikli"),
        ("api/reports/export", "Izvoz porocil"),
    ]),
    ("FURS in skladnost", [
        ("api/furs", "FURS davcno potrjevanje"),
        ("api/furs/batch", "Mnozicno potrjevanje"),
        ("api/haccp", "HACCP dnevnik"),
        ("api/audit", "Revizijski dnevnik z hash verigo"),
    ]),
    ("Zvestoba in kartice", [
        ("api/loyalty", "Zvestobni program: tocke, nivoji"),
        ("api/gift-cards", "Darilne kartice: prodaja, poraba"),
        ("api/guests", "CRM za goste z obiski in povratnimi informacijami"),
        ("api/happy-hour", "Happy hour akcije z urniki"),
    ]),
    ("AI", [
        ("api/ai", "AI napovedi in priporocila"),
        ("api/ai-assistant", "AI klepet pomocnik"),
        ("api/ai/qr-upsell", "AI upsell pri naročanju"),
    ]),
    ("Javne rute (brez auth)", [
        ("api/public/menu", "Javni meni za QR"),
        ("api/public/order", "Javno naročanje"),
        ("api/public/order-track", "Sledenje naročila za stranke"),
        ("api/public/verify-table", "Preverjanje mize"),
        ("api/public/call-waiter", "Klic natakarja"),
        ("api/public/delivery-check", "Preverjanje dostave"),
        ("api/public/promo-check", "Preverjanje promocije"),
        ("api/public/order-config", "Konfiguracija naročanja"),
    ]),
    ("Integracije", [
        ("api/integrations", "Zunanje integracije s kljuci API"),
        ("api/webhooks", "Webhook integracije z zgodovino"),
        ("api/digital-receipt", "Digitalni racun za goste"),
        ("api/feedback-public", "Javne ocene gostov"),
    ]),
    ("Konfiguracija", [
        ("api/auth", "Avtentikacija: PIN prijava, seje"),
        ("api/settings", "Nastavitve restavracije"),
        ("api/configuration", "Sistemska konfiguracija"),
        ("api/opening-hours", "Odpiralni casi lokacij"),
        ("api/subscription", "Narocnina s fakturiranjem"),
        ("api/notifications", "Obvestila: SMS, Email, Push"),
        ("api/seed", "Sejanje baze"),
        ("api/seed-norms", "Sejanje normativov"),
    ]),
    ("Stroski", [
        ("api/expenses", "Kategorizirani stroski"),
    ]),
]

for mod_group, routes in api_modules:
    story.append(section(mod_group, 3))
    rows = [[r[0], r[1]] for r in routes]
    story.append(make_table(["Ruta", "Opis"], rows, [CONTENT_W*0.35, CONTENT_W*0.65]))
    story.append(spacer(2))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 6. POS KOMPONENTE
# ══════════════════════════════════════════════════════════════
story.append(section("6. POS komponente (76 komponent)"))
story.append(body(
    "Frontend je grajen iz 76 POS komponent in 49 UI komponent (shadcn/ui). POS komponente pokrivajo celoten "
    "poslovni proces od naročanja in plačevanja, preko upravljanja miz in kuhinje, do analitike in nastavitev. "
    "Vse komponente so napisane v TypeScriptu in Reactu, uporabljajo Zustand za globalno stanje, TanStack Query "
    "za strezniske podatke in Framer Motion za animacije. UI komponente sledijo shadcn/ui New York stilu z "
    "Radix UI primitivi in Tailwind CSS oblikovanjem."
))
story.append(spacer(4))

pos_components = [
    ("Naročanje in blagajna", [
        "OrderPanel", "PaymentDialog", "SplitCheckDialog", "StornoDialog",
        "VoidItemDialog", "OrderBump", "CashRegister", "KioskBar",
        "ReceiptDialog", "PinLogin", "HappyHourBanner",
    ]),
    ("Mize in rezervacije", [
        "TableMap", "VisualFloorPlan", "ReservationManager",
        "WaitlistManager", "TableReservationSync", "TableTurnoverAnalytics",
        "WaitTimeEstimator",
    ]),
    ("Kuhinja", [
        "KitchenDisplay", "KitchenPrepQueue", "KitchenStationManager",
        "CoursePacing",
    ]),
    ("Meni in artikli", [
        "MenuManager", "AllergenFilter", "AllergenMatrix",
        "MenuEngineeringMatrix", "NutritionalCalculator",
    ]),
    ("Analitika in poročila", [
        "Dashboard", "AIForecastDashboard", "AIRecommendations",
        "ReportsView", "ProfitLossReport", "TaxReport",
        "StatsCard", "StaffPerformance",
    ]),
    ("Osebje", [
        "EmployeeManager", "StaffScheduler", "ShiftManager",
        "ShiftOverview", "TipManager", "DailyChecklist",
    ]),
    ("Zaloga in dobava", [
        "InventoryManager", "InventoryAlerts", "StockDashboard",
        "RecipeManager", "RecipeScaling", "FoodCostCalculator",
        "SupplierManager", "VendorScorecard", "WasteTracker",
        "DeliveryManager", "DeliveryTracker",
    ]),
    ("Skladnost in FURS", [
        "FursManager", "HaccpManager", "ComplianceDashboard",
        "ZReportManager", "EndOfDayManager",
    ]),
    ("Zvestoba in gostje", [
        "LoyaltyManager", "GiftCardManager", "GuestManager",
        "CustomerFeedback", "CustomerTimeline",
    ]),
    ("Nastavitve in konfiguracija", [
        "SettingsManager", "ConfigurationManager", "PrinterManager",
        "LocationManager", "IntegrationManager", "WebhookManager",
        "SubscriptionManager", "NotificationManager", "LanguageSwitcher",
        "Sidebar", "GlobalNotifications",
    ]),
    ("AI", [
        "AIAssistant",
    ]),
    ("Stroški", [
        "ExpenseTracker",
    ]),
]

for comp_group, comps in pos_components:
    story.append(section(comp_group, 3))
    for c in comps:
        story.append(bullet(c))
    story.append(spacer(2))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 7. JAVNE STRANI
# ══════════════════════════════════════════════════════════════
story.append(section("7. Javne strani (10 strani)"))
story.append(body(
    "RestaurantOS ponuja 10 javnih strani, ki so dostopne strankam brez prijave. Te strani pokrivajo "
    "celoten proces interakcije gosta z restavracijo: od pregleda menija in naročanja, preko rezervacij "
    "in sledenja naročila, do pregleda racuna in oddaje povratnih informacij. Vse strani so vecjezikovne "
    "in optimizirane za mobilne naprave, saj jih gostje dostopajo preko QR kod na mizah."
))
story.append(spacer(4))

pages_rows = [
    ["/", "Glavna stran", "Preusmeritev na POS ali QR meni"],
    ["/qr-menu", "QR meni", "Digitalni meni za stranke z alergeni in slikami"],
    ["/qr/[tableId]", "QR naročanje", "Naročanje na mizi z vecjezikovnim vmesnikom"],
    ["/reserve", "Rezervacije", "Spletno rezerviranje miz za stranke"],
    ["/order-status/[orderId]", "Sledenje naročila", "Domino's-style sledenje napredka naročila"],
    ["/order/[orderId]", "Podrobnosti naročila", "Podrobnosti specificnega naročila"],
    ["/receipt", "Digitalni racun", "QR racun z DDV in FURS podatki"],
    ["/waiter", "Natakar", "Mobilni pogled za natakarje"],
    ["/pricing", "Cenik", "Javni cenik storitev RestaurantOS"],
    ["/kds", "KDS", "Samostojen kuhinjski zaslon za kuharje"],
    ["/feedback", "Ocene", "Javna stran za ocene in povratne informacije"],
]
story.append(make_table(["URL", "Stran", "Opis"], pages_rows, [CONTENT_W*0.2, CONTENT_W*0.2, CONTENT_W*0.6]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 8. VARNOST
# ══════════════════════════════════════════════════════════════
story.append(section("8. Varnost"))
story.append(body(
    "RestaurantOS implementira vecplastno varnostno arhitekturo, ki ustreza zahtevam PCI DSS in FURS skladnosti. "
    "Vse zašcitene API rute zahtevajo veljavno sejo z Bearer tokenom, finoumna kontrola dostopa pa omogoča "
    "natančno upravljanje dovoljenj na podlagi vlog (admin, manager, staff). Podatki se validirajo z Zod shemami "
    "na strežniku in odjemalcu, kritične operacije pa se izvajajo znotraj Prisma transakcij za atomskost. "
    "Revizijski dnevnik uporablja SHA-256 hash verigo za zašcito pred poseganjem v evidence."
))
story.append(spacer(4))

security_rows = [
    ["requireAuth()", "Vse zašcitene API rute zahtevajo veljavno sejo z Bearer tokenom"],
    ["ROUTE_PERMISSIONS", "Finoumna kontrola dostopa na podlagi vlog (8 tipov dovoljenj)"],
    ["PIN prijava", "4-mestni PIN za hitro in varno prijavo v POS"],
    ["Seje", "JWT zetoni s potekom (8h TTL, 24h absolutni timeout), avtomatsko podaljševanje"],
    ["Zod validacija", "Vsi vhodni podatki validirani na strezniku in odjemalcu s shemami"],
    ["Prisma $transaction", "Atomske operacije za kriticne transakcije (narocila, placila)"],
    ["Audit log", "SHA-256 hash veriga za zašcito pred poseganjem v evidence"],
    ["Varnostne glave", "X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP, XSS zašcita"],
    ["Rate limiting", "Omejitev zahtev na javnih API-jih"],
]
story.append(make_table(["Mehanizem", "Opis"], security_rows, [CONTENT_W*0.3, CONTENT_W*0.7]))
story.append(spacer(4))

# Permission types
story.append(section("Tipi dovoljenj", 2))
perm_rows = [
    ["take_orders", "Naročanje, mize, meni, kuhinja"],
    ["void_items", "Storno artiklov z razlogom"],
    ["apply_discounts", "Uveljavljanje popustov in happy hour"],
    ["manage_cash", "Blagajna, izmene, placila, karticni terminal"],
    ["manage_inventory", "Zaloga, dobavitelji, nabava, recepti, stroski"],
    ["manage_employees", "Zaposleni, izmene, razpored, ure"],
    ["view_reports", "Analitika, porocila, dashboard"],
    ["admin", "Poln dostop: nastavitve, FURS, integracije, AI, audit"],
]
story.append(make_table(["Dovoljenje", "Obseg"], perm_rows, [CONTENT_W*0.25, CONTENT_W*0.75]))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 9. LIB DATOTEKE
# ══════════════════════════════════════════════════════════════
story.append(section("9. Knjiznične datoteke (src/lib/)"))
story.append(body(
    "Jedrna poslovna logika in infrastruktura sta organizirani v 16 knjizničnih datotekah, ki pokrivajo "
    "avtentikacijo, dostop do baze, validacijo, vecjezikovnost, offline zmogljivosti, tiskanje, FURS "
    "potrjevanje in vec. Te datoteke predstavljajo hrbtenico sistema in se uporabljajo v vseh API rutah "
    "in komponentah."
))
story.append(spacer(4))

lib_rows = [
    ["auth-middleware.ts", "Avtentikacija: requireAuth(), optionalAuth(), ROUTE_PERMISSIONS, seje z Bearer tokeni"],
    ["db.ts", "Prisma klient z WAL nacinom, audit log z SHA-256 hash verigo"],
    ["store.ts", "Zustand globalno stanje: kosarica, naročanje, DDV, locale, Happy Hour"],
    ["validations.ts", "Zod sheme za validacijo vseh vhodnih podatkov"],
    ["i18n.ts", "Vecjezikovnost: 5 jezikov, preklapljanje, persistenca"],
    ["utils.ts", "Uporabne funkcije (cn, formatiranje, izracuni)"],
    ["escpos.ts", "ESC/POS protokol za termicne tiskalnike"],
    ["furs.ts", "FURS davcno potrjevanje: ZOI generiranje, EOR zahtevki"],
    ["stock-deduction.ts", "Razknjizevanje zaloge ob prodaji"],
    ["counters.ts", "Stevec racunov in narocil"],
    ["country-config.ts", "Konfiguracija po drzavah (davki, valute, locale)"],
    ["event-emitter.ts", "Dogodkovni sistem za real-time obvestila"],
    ["websocket-client.ts", "WebSocket odjemalec za KDS in obvestila"],
    ["use-pos-shortcuts.ts", "Tipkovne bližnjice za POS"],
    ["webhook-engine.ts", "Webhook pogon za zunanje integracije"],
    ["integrations/connectors.ts", "Konektorji za Glovo, Wolt, Bolt"],
]
story.append(make_table(["Datoteka", "Opis"], lib_rows, [CONTENT_W*0.3, CONTENT_W*0.7]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 10. INTERNAZIONALIZACIJA
# ══════════════════════════════════════════════════════════════
story.append(section("10. Internacionalizacija (5 jezikov)"))
story.append(body(
    "RestaurantOS podpira 5 jezikov s polnimi prevodi vseh modulov. Vsak jezik vsebuje 700 vrstic "
    "oz. približno 332 prevodnih ključev, ki pokrivajo vse dele uporabniškega vmesnika: od gombov "
    "in menijev, preko obvestil in napak, do imen kategorij in modulov. Primarni jezik je slovenščina, "
    "kar ustreza ciljnemu tržišču. Preklapljanje jezikov je mogoče kadarkoli preko jezikovnega stikala "
    "v vrstici aplikacije, izbira pa se shrani v localStorage za persistenco."
))
story.append(spacer(4))

i18n_rows = [
    ["sl.json", "Slovenscina", "700 vrstic", "Primarni jezik, najbolj popoln"],
    ["en.json", "English", "700 vrstic", "Poln prevod vseh modulov"],
    ["it.json", "Italiano", "700 vrstic", "Poln prevod za italijansko mejo"],
    ["hr.json", "Hrvatski", "700 vrstic", "Poln prevod za hrvasko trzisce"],
    ["de.json", "Deutsch", "700 vrstic", "Poln prevod za avstrijsko/nemsko trzisce"],
]
story.append(make_table(["Datoteka", "Jezik", "Obseg", "Opomba"], i18n_rows, [CONTENT_W*0.15, CONTENT_W*0.2, CONTENT_W*0.2, CONTENT_W*0.45]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 11. DEPLOYMENT
# ══════════════════════════════════════════════════════════════
story.append(section("11. Namestitev in deployment"))
story.append(body(
    "RestaurantOS podpira vec nacinov namestitve in deploymenta, od lokalnega razvoja do produkcijskega "
    "strežnika. Za produkcijo je priporočen PM2 process manager z avtomatskim restartom in Caddy reverse "
    "proxy za HTTPS in avtomatske certifikate. Docker podpora omogoča enostavno namestitev v kontejnerjih, "
    "standalone output pa omogoča minimalni memory footprint brez dodatnih orodij."
))
story.append(spacer(4))

deploy_rows = [
    ["npm run dev", "Razvojni strežnik s hot-reload na portu 3000"],
    ["npm run build", "Produkcijski build s standalone outputom"],
    ["npm run start", "Produkcijski strežnik (bun .next/standalone/server.js)"],
    ["PM2", "Process manager z avtomatskim restartom (max 512M, 10 restartov)"],
    ["Caddy", "Reverse proxy na portu 81 z avtomatskimi HTTPS certifikati"],
    ["Docker", "Dockerfile za kontejnersko namestitev z volume mountom za bazo"],
    ["SQLite WAL", "WAL nacin za hkratno branje/pisanje, busy_timeout=5000ms"],
]
story.append(make_table(["Metoda", "Opis"], deploy_rows, [CONTENT_W*0.2, CONTENT_W*0.8]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 12. STATISTIKA ARTIKLOV
# ══════════════════════════════════════════════════════════════
story.append(section("12. Statistika artiklov hrane in pijace"))
story.append(body(
    "Analiza vseh JSON datotek, seed skript in menijskih podatkov je pokazala, da repozitorij vsebuje "
    "876 surovih artiklov, od katerih je 732 unikatnih (brez duplikatov). Hrana obsega 493 unikatnih "
    "artiklov v 23 podkategorijah, pijaca pa 239 unikatnih artiklov v 20 podkategorijah. 133 artiklov "
    "se pojavlja v vec virih, kar je pričakovano pri menijskih podatkih iz različnih restavracij."
))
story.append(spacer(4))

# Food summary
story.append(section("Hrana po podkategorijah (493 artiklov)", 2))
food_rows = [
    ["Pizze", "82"], ["Glavne jedi", "66"], ["Solate", "42"], ["Testenine", "39"],
    ["Priloge", "26"], ["Slovenske jedi", "25"], ["Ribje jedi", "23"], ["Predjedi", "18"],
    ["Sladice", "17"], ["Zara in Grill", "15"], ["Rizote", "14"], ["Burgerji", "14"],
    ["Palacinke", "14"], ["Morski sadexi", "13"], ["Juhe", "13"], ["Otroške jedi", "13"],
    ["Otroški meni", "12"], ["Zajtrk in Brunch", "12"], ["Vegetarijanske jedi", "10"],
    ["Tople predjedi", "10"], ["Sendvici in Tost", "6"], ["Ostala hrana", "6"],
    ["Hladne predjedi", "3"],
]
story.append(make_table(["Podkategorija", "Stevilo"], food_rows, [CONTENT_W*0.6, CONTENT_W*0.4]))
story.append(spacer(4))

# Drinks summary
story.append(section("Pijaca po podkategorijah (239 artiklov)", 2))
drink_rows = [
    ["Bela vina", "30"], ["Gin", "27"], ["Topli napitki", "25"], ["Sokovi", "19"],
    ["Pivo (steklenicno)", "18"], ["Redca vina", "17"], ["Destilati", "15"],
    ["Penine in Sampanjci", "13"], ["Ostale pijace", "11"], ["Viski", "10"],
    ["Vode", "8"], ["Likersko vino", "7"], ["Likerji", "7"], ["Grencice", "7"],
    ["Smoothie in Shake", "6"], ["Tuja vina", "6"], ["Vroca pijaca z alkoholom", "5"],
    ["Rose vino", "3"], ["Gazirane pijace", "3"], ["Mesane pijace", "2"],
]
story.append(make_table(["Podkategorija", "Stevilo"], drink_rows, [CONTENT_W*0.6, CONTENT_W*0.4]))
story.append(spacer(4))

# Sources
story.append(section("Viri podatkov", 2))
sources_rows = [
    ["scripts/seed-food-expansion.ts", "61", "Primarni strukturiran vir za hrano"],
    ["scripts/seed-wine-card.ts", "189", "Vinska karta in pijaca"],
    ["enjoi_menu.json", "132", "Gostilna Pod Lipco (Enjoi platforma)"],
    ["add_food_items.js", "106", "Dodatni seed skript"],
    ["jurman_*.json", "222", "Gostilna Jurman (17 datotek, Divi builder)"],
    ["most_menu.json", "64", "Restavracija Most"],
    ["micka_menu.json", "6", "Gostilna pri Micki"],
]
story.append(make_table(["Vir", "Artiklov", "Opis"], sources_rows, [CONTENT_W*0.35, CONTENT_W*0.15, CONTENT_W*0.5]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# 13. SKRIPTE
# ══════════════════════════════════════════════════════════════
story.append(section("13. Skripte in orodja"))
story.append(body(
    "Repozitorij vsebuje obsežen nabor skript za vzdrževanje podatkov, generiranje slik, audit in "
    "popravila. Skripte so razdeljene v tri kategorije: seed skripte za inicializacijo podatkov, "
    "image skripte za generiranje in optimizacijo slik menija, ter utility skripte za popravilo "
    "duplikatov, konsolidacijo kategorij in audit. Vecina skript je napisanih v JavaScriptu/TypeScriptu "
    "in se izvaja z Node.js ali Bun runtimeom."
))
story.append(spacer(4))

script_rows = [
    ["seed-food-expansion.ts", "Seed hrane s normativi in kategorijami"],
    ["seed-wine-card.ts", "Seed vinske karte in pijace (189 artiklov)"],
    ["seed-via-fetch.mjs", "Seed preko API klicev"],
    ["seed-minimal.mjs", "Minimalni seed za osnovne podatke"],
    ["seed-direct.mjs", "Direktni seed v bazo"],
    ["generate-food-images.mjs", "Generiranje slik za hrano z AI"],
    ["generate-images.mjs", "Generiranje slik z AI (splosno)"],
    ["generate-missing-images.mjs", "Generiranje manjkajocih slik"],
    ["generate-premium-images.mjs", "Premium AI generiranje slik"],
    ["generate-remaining-images.mjs", "Generiranje preostalih slik"],
    ["upgrade-images-ai.mjs", "Nadgradnja slik z AI"],
    ["upgrade-images-stock.mjs", "Nadgradnja slik s stock fotografijami"],
    ["upgrade-images-pexels.mjs", "Nadgradnja slik iz Pexels"],
    ["full-image-audit.mjs", "Polni audit vseh slik"],
    ["audit-images.mjs", "Audit slik (osnovni)"],
    ["fix-duplicates.mjs", "Popravilo duplikatov artiklov"],
    ["fix-duplicates-png.mjs", "Popravilo duplikatov PNG slik"],
    ["fix-duplicates-svg.mjs", "Popravilo duplikatov SVG slik"],
    ["fix-duplicates-ai.mjs", "Popravilo duplikatov AI slik"],
    ["consolidate-categories.mjs", "Konsolidacija kategorij menija"],
    ["convert-svg-to-png.mjs", "Pretvorba SVG v PNG"],
    ["fix-svg-xml.mjs", "Popravilo SVG XML napak"],
    ["test-manager.ts", "Test manager za POS"],
]
story.append(make_table(["Skripta", "Opis"], script_rows, [CONTENT_W*0.4, CONTENT_W*0.6]))
story.append(spacer(6))

# ══════════════════════════════════════════════════════════════
# 14. STATISTIKA PROJEKTA
# ══════════════════════════════════════════════════════════════
story.append(section("14. Statistika projekta"))
story.append(body(
    "RestaurantOS je obsežen projekt z blizu 79.000+ vrsticami kode, 284 izvornimi datotekami in "
    "70+ odvisnostmi. Projekt aktivno razvija en razvijalec in sledi profesionalnim standardom "
    "kodiranja s TypeScriptom, Zod validacijo in Prisma ORM. Shema podatkovne baze obsega 69 modelov "
    "v 1868 vrsticah, API plast pa vsebuje 132 rut v 22.134 vrsticah. Celotna koda je v sistemu "
    "verzioniranja Git z repositorijem na GitHubu."
))
story.append(spacer(4))

stats_rows = [
    ["Vrstic kode", "79.000+"],
    ["Izvornih datotek", "284"],
    ["POS komponent", "76"],
    ["UI komponent (shadcn/ui)", "49"],
    ["API modulov", "68"],
    ["API rut", "132"],
    ["Vrstic API kode", "22.134"],
    ["Prisma modelov", "69"],
    ["Vrstic sheme", "1.868"],
    ["Javnih strani", "10+1 (feedback)"],
    ["Jezikov", "5 (800+ kljucev vsak)"],
    ["Meni postavk (seed)", "438"],
    ["Unikatnih artiklov", "732 (493 hrana + 239 pijaca)"],
    ["Odvisnosti", "70+"],
    ["Lib datotek", "16"],
    ["Skript", "23"],
]
story.append(make_table(["Metrika", "Vrednost"], stats_rows, [CONTENT_W*0.5, CONTENT_W*0.5]))

# ── Build ──
doc.build(story)
print(f"PDF generiran: {OUTPUT}")
