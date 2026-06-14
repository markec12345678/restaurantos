#!/usr/bin/env python3
"""RestaurantOS — Analiza in indeks projekta (PDF generacija)"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate
import hashlib

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('LibSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LibSerif-Bold', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('WQYZenHei', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('LibSerif', normal='LibSerif', bold='LibSerif-Bold')
registerFontFamily('WQYZenHei', normal='WQYZenHei', bold='WQYZenHei')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━ Color Palette ━━
ACCENT       = colors.HexColor('#26728c')
TEXT_PRIMARY  = colors.HexColor('#22211f')
TEXT_MUTED    = colors.HexColor('#7d7971')
BG_SURFACE   = colors.HexColor('#e7e4df')
BG_PAGE      = colors.HexColor('#f1efec')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = BG_SURFACE

# ━━ Page Setup ━━
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.8 * inch
BOTTOM_MARGIN = 0.8 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ━━ Styles ━━
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    name='DocTitle', fontName='LibSerif', fontSize=28, leading=36,
    alignment=TA_CENTER, textColor=ACCENT, spaceAfter=12
)
subtitle_style = ParagraphStyle(
    name='DocSubtitle', fontName='LibSerif', fontSize=14, leading=20,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceAfter=24
)
h1_style = ParagraphStyle(
    name='H1', fontName='LibSerif', fontSize=20, leading=26,
    textColor=ACCENT, spaceBefore=18, spaceAfter=10
)
h2_style = ParagraphStyle(
    name='H2', fontName='LibSerif', fontSize=15, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8
)
h3_style = ParagraphStyle(
    name='H3', fontName='LibSerif', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6
)
body_style = ParagraphStyle(
    name='Body', fontName='LibSerif', fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6,
    firstLineIndent=0
)
body_indent_style = ParagraphStyle(
    name='BodyIndent', fontName='LibSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=4,
    leftIndent=18, bulletIndent=6
)
muted_style = ParagraphStyle(
    name='Muted', fontName='LibSerif', fontSize=9, leading=13,
    textColor=TEXT_MUTED, alignment=TA_LEFT
)
caption_style = ParagraphStyle(
    name='Caption', fontName='LibSerif', fontSize=9, leading=13,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6
)
header_cell_style = ParagraphStyle(
    name='HeaderCell', fontName='LibSerif', fontSize=10, leading=14,
    textColor=colors.white, alignment=TA_CENTER
)
cell_style = ParagraphStyle(
    name='Cell', fontName='LibSerif', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER
)
cell_left_style = ParagraphStyle(
    name='CellLeft', fontName='LibSerif', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)

# TOC styles
toc_h1_style = ParagraphStyle(
    name='TOCH1', fontName='LibSerif', fontSize=13, leading=22,
    leftIndent=20, textColor=TEXT_PRIMARY
)
toc_h2_style = ParagraphStyle(
    name='TOCH2', fontName='LibSerif', fontSize=11, leading=18,
    leftIndent=40, textColor=TEXT_MUTED
)

# ━━ Helper Functions ━━
def make_table(headers, rows, col_ratios=None):
    """Create a styled table with header and alternating row colors."""
    header = [Paragraph(f'<b>{h}</b>', header_cell_style) for h in headers]
    data = [header]
    for row in rows:
        data.append([Paragraph(str(c), cell_left_style) if i == 0 else Paragraph(str(c), cell_style) for i, c in enumerate(row)])
    
    n_cols = len(headers)
    if col_ratios:
        col_widths = [r * AVAILABLE_W for r in col_ratios]
    else:
        col_widths = [AVAILABLE_W / n_cols] * n_cols
    
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

H1_ORPHAN_THRESHOLD = (PAGE_H - TOP_MARGIN - BOTTOM_MARGIN) * 0.15

def add_major_section(text):
    return [
        CondPageBreak(H1_ORPHAN_THRESHOLD),
        add_heading(text, h1_style, level=0),
    ]

# ━━ TOC Document Template ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ━━ Build Document ━━
output_path = '/home/z/my-project/download/RestaurantOS_Analiza_Indeks.pdf'

doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
    title='RestaurantOS — Analiza in indeks projekta',
    author='Z.ai',
    creator='Z.ai',
    subject='Analiza in indeks repozitorija RestaurantOS'
)

story = []

# ━━ Cover Page ━━
story.append(Spacer(1, 120))
story.append(Paragraph('<b>RestaurantOS</b>', title_style))
story.append(Spacer(1, 8))
story.append(Paragraph('Analiza in indeks projekta', subtitle_style))
story.append(Spacer(1, 24))

cover_meta = ParagraphStyle(
    name='CoverMeta', fontName='LibSerif', fontSize=11, leading=18,
    alignment=TA_CENTER, textColor=TEXT_MUTED
)
story.append(Paragraph('Profesionalni POS sistem za restavracije', cover_meta))
story.append(Paragraph('Next.js 16.1.3 | TypeScript | Prisma | SQLite', cover_meta))
story.append(Spacer(1, 40))

cover_line_style = TableStyle([
    ('LINEBELOW', (0, 0), (-1, 0), 1.5, ACCENT),
])
line_table = Table([['']], colWidths=[AVAILABLE_W * 0.4], hAlign='CENTER')
line_table.setStyle(cover_line_style)
story.append(line_table)

story.append(Spacer(1, 40))
story.append(Paragraph('Repozitorij: github.com/markec12345678/restaurantos', cover_meta))
story.append(Paragraph('Licenca: MIT', cover_meta))
story.append(Paragraph('Datum analize: 10. junij 2026', cover_meta))

story.append(PageBreak())

# ━━ Table of Contents ━━
story.append(Paragraph('<b>Kazalo vsebine</b>', h1_style))
story.append(Spacer(1, 12))

toc = TableOfContents()
toc.levelStyles = [toc_h1_style, toc_h2_style]
story.append(toc)
story.append(PageBreak())

# ━━ 1. Povzetek projekta ━━
story.extend(add_major_section('1. Povzetek projekta'))

story.append(Paragraph(
    'RestaurantOS je celovit, profesionalni Point of Sale (POS) sistem, zasnovan posebej za evropske restavracije, s poudarkom na slovensko trzisce in FURS davcno potrjevanje. Zdruzuje najboljse prakse svetovnih POS sistemov (Toast, TouchBistro, Square, Lightspeed, 7shifts, OpenTable) v enotno, sodobno spletno aplikacijo. Sistem pokriva vse vidike restavratorskega poslovanja, od naročanja in plačevanja, preko kuhinjskega prikaza in zalog, do analitike, davčnega potrjevanja in upravljanja osebja. Deluje tudi brez internetne povezave zahvaljujoč Service Workerju in IndexedDB, kar je ključnega pomena za zanesljivo poslovanje v restavracijah.',
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Projekt je zgrajen na tehnološkem skladu Next.js 16.1.3 z App Router arhitekturo, TypeScriptom za tipovno varnost, Prisma ORM za dostop do podatkovne baze SQLite, ter Tailwind CSS in shadcn/ui za uporabniški vmesnik. Vključuje 69 Prisma modelov, 65 API modulov z več kot 130 rutami, 76 POS komponent in podporo za 5 jezikov z več kot 800 ključi na jezik. Celotna koda obsega več kot 83.000 vrstic v izvornih datotekah.',
    body_style
))

# Key metrics table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Metrika', 'Vrednost'],
    [
        ['Vrstic kode (src/)', '83.731'],
        ['Izvornih datotek (src/)', '294'],
        ['POS komponent', '76'],
        ['API modulov', '65 (130+ rut)'],
        ['Prisma modelov', '69'],
        ['Javni strani', '12'],
        ['Jezikov (i18n)', '5 (800+ ključev vsak)'],
        ['Meni postavk (seed)', '438'],
        ['Meni slik (PNG)', '438'],
        ['Skladijskih slik', '26'],
        ['Skript', '35'],
        ['Odvisnosti', '70+'],
    ],
    col_ratios=[0.55, 0.45]
))
story.append(Paragraph('Tabela 1: Ključne metrike projekta RestaurantOS', caption_style))

# ━━ 2. Arhitektura in tehnološki sklad ━━
story.extend(add_major_section('2. Arhitektura in tehnološki sklad'))

story.append(Paragraph(
    'RestaurantOS uporablja sodobno full-stack arhitekturo, ki temelji na Next.js 16.1.3 z App Routerjem. Ta arhitektura omogoča strežniško upodabljanje (Server Components), API rutne znotraj istega projekta in avtomatično optimizacijo za produkcijo. Aplikacija je zasnovana kot offline-first, kar pomeni, da bistvene funkcije delujejo tudi brez internetne povezave, kar je kritičnega pomena za restavratorsko poslovanje, kicer se internetne povezave v kuhinjah in jedilnicah pogosto izgubljajo.',
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Podatkovni sloj uporablja Prisma ORM z SQLite podatkovno bazo, ki ne zahteva zunanjih odvisnosti in je idealna za lokalno namestitev v restavracijah. Prisma schema vsebuje 69 modelov z obsežnimi relacijami, ki pokrivajo celoten poslovni proces od menija, naročil in plačil do zalog, zaposlenih in davčnega potrjevanja. Vse kritične transakcije so zavite v Prisma $transaction za atomarnost, vhodni podatki pa so validirani z Zod shemami na strežniku.',
    body_style
))

# Tech stack table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Tehnologija', 'Namen'],
    [
        ['Next.js 16.1.3', 'Full-stack framework (App Router, Server Components, API Routes)'],
        ['TypeScript', 'Tipovno varna koda po vsem projektu'],
        ['Prisma ORM', 'Dostop do baze (SQLite) s 69 modeli'],
        ['SQLite', 'Lokalna baza (brez zunanjih odvisnosti)'],
        ['Tailwind CSS 4', 'Sodobno oblikovanje z utility-first pristopom'],
        ['shadcn/ui (Radix UI)', 'UI komponente (47 komponent)'],
        ['TanStack Query', 'Upravljanje stanja strežniških podatkov in caching'],
        ['TanStack Table', 'Napredne tabele s sortiranjem in filtriranjem'],
        ['Recharts', 'Interaktivni grafikoni in vizualizacije'],
        ['next-intl', 'Internacionalizacija (5 jezikov)'],
        ['Zod', 'Validacija podatkov na strežniku in odjemalcu'],
        ['Zustand', 'Lahko globalno stanje za POS košarico in UI'],
        ['Service Worker + IndexedDB', 'Offline zmogljivost (22 trgovin)'],
        ['Framer Motion', 'Tekoče animacije in prehodi'],
        ['date-fns', 'Obdelava datumov in časov'],
        ['QRCode', 'Generiranje QR kod za mize, račune, menije'],
        ['docx', 'Generiranje Word dokumentov za poročila'],
        ['Sharp', 'Obdelava slik na strežniku'],
        ['ws (WebSocket)', 'Real-time komunikacija za KDS in obvestila'],
        ['z-ai-web-dev-sdk', 'AI zmogljivosti (Gemini, iskanje, generiranje slik)'],
    ],
    col_ratios=[0.30, 0.70]
))
story.append(Paragraph('Tabela 2: Tehnološki sklad projekta', caption_style))

# ━━ 3. Struktura repozitorija ━━
story.extend(add_major_section('3. Struktura repozitorija'))

story.append(Paragraph(
    'Repozitorij vsebuje obsežno zbirko datotek, ki sledijo standardni Next.js strukturi z dodatnimi mapami za skripte, prevode, slike menija in konfiguracijske datoteke. Jedro projekta je v mapi src/, kjer so API rute, komponente, knjižnice in strani. Mape public/menu-images/ in public/inventory-images/ vsebujeta vizualne podatke za meni in zalogo. Mapa scripts/ vsebuje 35 pomožnih skript za generiranje slik, sejanje podatkov in vzdrževanje. Mapi prisma/ in db/ skrbita za podatkovni model in samo SQLite bazo.',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Mapa / Datoteka', 'Opis', 'Velikost'],
    [
        ['src/app/api/', '65 API modulov (130+ rut)', 'Ključno'],
        ['src/app/[locale]/', 'Internacionalizirane strani (12)', 'Ključno'],
        ['src/components/pos/', '76 POS komponent', 'Ključno'],
        ['src/components/ui/', '47 shadcn/ui komponent', 'Ključno'],
        ['src/lib/', '16 knjižničnih modulov', 'Ključno'],
        ['prisma/schema.prisma', '69 Prisma modelov (1868 vrstic)', 'Ključno'],
        ['messages/', '5 jezikovnih datotek (~100 KB skupaj)', 'Ključno'],
        ['public/menu-images/', '438 PNG slik menija', 'Slike'],
        ['public/inventory-images/', '26 PNG slik zaloge', 'Slike'],
        ['scripts/', '35 pomožnih skript', 'Podpora'],
        ['db/custom.db', 'SQLite podatkovna baza', 'Podatki'],
        ['Dockerfile', 'Docker konfiguracija za produkcijo', 'Infrastruktura'],
        ['Caddyfile', 'Caddy reverse proxy konfiguracija', 'Infrastruktura'],
        ['ecosystem.config.js', 'PM2 procesna konfiguracija', 'Infrastruktura'],
    ],
    col_ratios=[0.35, 0.45, 0.20]
))
story.append(Paragraph('Tabela 3: Struktura repozitorija', caption_style))

# ━━ 4. Podatkovni model ━━
story.extend(add_major_section('4. Podatkovni model (Prisma)'))

story.append(Paragraph(
    'Podatkovni model je zasnovan po standardih svetovnih POS sistemov, predvsem Toast POS, in vsebuje 69 Prisma modelov, ki pokrivajo celoten restavratorski poslovni proces. Modeli so organizirani v logične skupine: meni hierarhija (Menu, Category, MenuItem, ModifierGroup, Modifier), naročila in plačila (Order, OrderItem, Check, Payment), konfiguracija (TaxRate, DiningOption, RevenueCenter, PrepStation), zaposleni (Employee, Job, Shift, TimeEntry), zaloga (InventoryItem, StockTransaction, RecipeItem), FURS in računi (Receipt), zvestoba (LoyaltyAccount, LoyaltyTransaction), darilne kartice (GiftCard, GiftCardTransaction) in multi-lokacija (Location, DeliveryZone, OpeningHours). Vse relacije so strogo tipizirane s cascade in restrict pravili za celovitost podatkov.',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Skupina modelov', 'Modeli', 'Število'],
    [
        ['Meni hierarhija', 'Menu, Category, MenuItem, ModifierGroup, Modifier, MenuItemModifierGroup', '6'],
        ['Konfiguracija', 'TaxRate, DiningOption, RevenueCenter, ServiceCharge, SalesCategory, PriceGroup, PrepStation, AlternatePaymentType, VoidReason, NoSaleReason, Printer, PackagingConfig, PackagingItem', '13'],
        ['Naročila in plačila', 'Table, Order, OrderItem, Check, Payment, Discount, DeliveryInfo', '7'],
        ['Zaposleni', 'Employee, Job, EmployeeJob, Shift, TimeEntry', '5'],
        ['Blagajna', 'CashRegisterShift', '1'],
        ['Zaloga', 'InventoryItem, StockTransaction, RecipeItem', '3'],
        ['Računi in FURS', 'Receipt', '1'],
        ['Zvestoba', 'LoyaltyAccount, LoyaltyTransaction', '2'],
        ['Darilne kartice', 'GiftCard, GiftCardTransaction', '2'],
        ['Nastavitve', 'RestaurantSettings', '1'],
        ['Multi-lokacija', 'Location, DeliveryZone, OpeningHours, DeliveryTracking', '4'],
        ['HACCP in revizija', 'HaccpEntry, AuditLog', '2'],
        ['Webhook integracije', 'Webhook, WebhookDelivery, Integration, IntegrationLog', '4'],
        ['Rezervacije in čakalni seznam', 'Reservation, WaitlistEntry', '2'],
        ['Kuhinja', 'Course, KitchenStation', '2'],
        ['Naročnina', 'Subscription, SubscriptionInvoice', '2'],
        ['Gosti CRM', 'Guest, GuestVisit, GuestFeedback', '3'],
        ['Dobavitelji', 'Supplier, PurchaseOrder, PurchaseOrderItem', '3'],
        ['Obvestila', 'NotificationTemplate', '1'],
        ['Poročila', 'ZReport, TipPool, TipDistribution', '3'],
        ['Razpored osebja', 'StaffShift', '1'],
        ['AI', 'AIConversation', '1'],
        ['Akcije', 'HappyHourSchedule', '1'],
        ['Števci', 'Counter', '1'],
        ['Stroški', 'Expense', '1'],
    ],
    col_ratios=[0.25, 0.55, 0.20]
))
story.append(Paragraph('Tabela 4: Pregled Prisma modelov po skupinah', caption_style))

# ━━ 5. API moduli ━━
story.extend(add_major_section('5. API moduli'))

story.append(Paragraph(
    'API sloj vsebuje 65 modulov z več kot 130 rutami, ki pokrivajo vse poslovne funkcije. Vsaka API ruta je zaščitena z avtentikacijo (requireAuth) in fino kontrolo dostopa (ROUTE_PERMISSIONS), vhodni podatki pa so validirani z Zod shemami. Kritične transakcije (naročila, plačila, inventura) uporabljajo Prisma $transaction za atomarnost. API vključuje tudi javne rute (brez avtentikacije) za QR meni, spletno naročanje, sledenje dostav in preverjanje promocijskih kod.',
    body_style
))

api_modules = [
    ['ai', 'AI napovedi, priporočila, QR upsell'],
    ['ai-assistant', 'AI klepet pomočnik (Gemini)'],
    ['audit', 'Revizijski dnevnik (SHA-256 hash veriga)'],
    ['auth', 'Avtentikacija (PIN, seje, JWT)'],
    ['card-terminal', 'Integracija s kartičnim terminalom'],
    ['cash-register', 'Blagajna (odpiranje/zapiranje izmene)'],
    ['categories', 'Kategorije menija'],
    ['checks', 'Čeki (split check, več čekov na naročilo)'],
    ['configuration', 'Nastavitve restavracije'],
    ['courses', 'Course pacing (fine dining)'],
    ['daily-checklist', 'Dnevni seznam (opening/closing)'],
    ['dashboard', 'Nadzorna plošča (KPI, grafikoni)'],
    ['delivery', 'Dostave (Glovo, Wolt webhook-i)'],
    ['delivery-tracking', 'Sledenje dostav v realnem času'],
    ['delivery-zones', 'Cone dostave (zonsko oblikovanje cen)'],
    ['digital-receipt', 'Digitalni račun za stranke'],
    ['discounts', 'Popusti (odstotni, fiksni, promo kode)'],
    ['employees', 'Zaposleni (CRUD, PIN, vloge)'],
    ['end-of-day', 'Zaključek dneva (EOD)'],
    ['expenses', 'Stroški (kategorizirani, ponavljajoči)'],
    ['feedback-public', 'Javne ocene in povratne informacije'],
    ['food-cost', 'Kalkulator stroškov jedi (food cost %)'],
    ['furs', 'FURS davčno potrjevanje (ZOI, EOR)'],
    ['gift-cards', 'Darilne kartice (prodaja, polnjenje, poraba)'],
    ['guests', 'Upravljanje gostov (CRM)'],
    ['haccp', 'HACCP dnevnik (temperature, CCP kontrole)'],
    ['happy-hour', 'Happy hour akcije in urniki'],
    ['integrations', 'Zunanje integracije (API, webhook)'],
    ['inventory', 'Zaloge (CRUD, transakcije, napovedi)'],
    ['jobs', 'Funkcije zaposlenih (natakar, kuhar, itd.)'],
    ['kitchen', 'Kuhinja (KDS, pripravljalni vrstni red)'],
    ['locations', 'Lokacije (multi-restavracija)'],
    ['loyalty', 'Zvestoben program (točke, nivoji, nagrade)'],
    ['menu-items', 'Meni postavke (CRUD, alergeni, slike)'],
    ['menus', 'Meniji (hrana, pijača, otroški, itd.)'],
    ['modifier-groups', 'Skupine prilagoditev (način pečenja, priloge)'],
    ['notifications', 'Obvestila (SMS, email, push)'],
    ['opening-hours', 'Odpiralni časi po lokacijah'],
    ['order-items', 'Postavke naročil (status, void, popusti)'],
    ['orders', 'Naročila (CRUD, statusi, split)'],
    ['packaging', 'Embalaža za dostavo'],
    ['payments', 'Plačila (gotovina, kartica, kombinirano)'],
    ['print', 'ESC/POS tiskanje (boni, računi, Z-poročila)'],
    ['public', 'Javne API rute (QR meni, naročanje, sledenje)'],
    ['purchase-orders', 'Nabavna naročila (dobavitelji)'],
    ['qr-menu', 'QR meni podatki za stranke'],
    ['receipts', 'Računi (FURS, digitalni, tiskanje)'],
    ['recipes', 'Recepti (normativi, kalkulacija)'],
    ['reports', 'Poročila (prodaja, DDV, izmene, zaposleni)'],
    ['reservations', 'Rezervacije (CRUD, dodeljevanje miz)'],
    ['seed', 'Sejanje baze (kategorije, meni, zaposleni)'],
    ['seed-food-norms', 'Sejanje hrane s normativi'],
    ['seed-norms', 'Sejanje normativov za recepte'],
    ['settings', 'Nastavitve sistema (FURS, DDV, zvestoba)'],
    ['shifts', 'Izmene (CRUD, statusi)'],
    ['staff-performance', 'Učinkovitost osebja (KPI, napitnine)'],
    ['staff-shifts', 'Razpored zaposlenih (tedenski vizualni)'],
    ['stock', 'Zaloge (vnosi, izpisi, inventura)'],
    ['subscription', 'Naročnine (SaaS model)'],
    ['suppliers', 'Dobavitelji (CRUD, kontakti, pogodbe)'],
    ['tables', 'Mize (CRUD, status, vizualni tloris)'],
    ['time-entries', 'Časovne evidence (clock in/out, odmori)'],
    ['tip-pool', 'Napitnine (pool in point distribucija)'],
    ['webhooks', 'Webhook integracije (Glovo, Wolt, Bolt)'],
    ['ws-broadcast', 'WebSocket broadcast (real-time)'],
    ['z-report', 'Z-poročilo (dnevni zaključek blagajne)'],
]

story.append(Spacer(1, 18))
# Split into two tables for better layout
half = len(api_modules) // 2 + 1
story.append(make_table(
    ['Modul', 'Opis'],
    api_modules[:half],
    col_ratios=[0.28, 0.72]
))
story.append(Paragraph('Tabela 5a: API moduli (1. del)', caption_style))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Modul', 'Opis'],
    api_modules[half:],
    col_ratios=[0.28, 0.72]
))
story.append(Paragraph('Tabela 5b: API moduli (2. del)', caption_style))

# ━━ 6. POS komponente ━━
story.extend(add_major_section('6. POS komponente'))

story.append(Paragraph(
    'Uporabniški vmesnik POS sistema je sestavljen iz 76 komponent, ki pokrivajo vse vidike restavratorskega poslovanja. Komponente so zgrajene z React in TypeScript ter uporabljajo shadcn/ui osnovo s Tailwind CSS oblikovanjem. Stanje aplikacije upravlja Zustand za globalno stanje (košarica, aktivni pogled) in TanStack Query za strežniške podatke s cachingem. Komponente vključujejo napredne funkcionalnosti, kot so AI pomočnik, vizualni tloris miz z drag-and-drop, kalkulator stroškov jedi, matrika alergenov EU 1169/2011 in menu engineering BCG matrika za optimizacijo menija.',
    body_style
))

pos_components = [
    ['AIAssistant', 'AI klepet pomočnik za podporo odločanju'],
    ['AIForecastDashboard', 'AI napovedovanje prometa (Gemini)'],
    ['AIRecommendations', 'AI priporočila za optimizacijo menija'],
    ['AllergenFilter', 'Filter alergenov v POS naročanju'],
    ['AllergenMatrix', 'Matrika 14 EU alergenov za artikle'],
    ['CashRegister', 'Blagajna (odpiranje/zapiranje, gotovina)'],
    ['ComplianceDashboard', 'Skladnost (HACCP, FURS, revizija)'],
    ['ConfigurationManager', 'Nastavitve restavracije in sistema'],
    ['CoursePacing', 'Tempo jedi (predjedi > glavne > sladice)'],
    ['CustomerFeedback', 'Povratne informacije strank'],
    ['CustomerTimeline', 'Kronologija gostov (obiski, naročila, povratne)'],
    ['DailyChecklist', 'Dnevni seznam (opening/closing)'],
    ['Dashboard', 'Nadzorna plošča (6 KPI, 7-dnevni graf)'],
    ['DeliveryManager', 'Upravljanje dostav (statusi, časi)'],
    ['DeliveryTracker', 'Sledenje dostav na zemljevidu'],
    ['EmployeeManager', 'Zaposleni (CRUD, PIN, vloge, kontakti)'],
    ['EndOfDayManager', 'Zaključek dneva (EOD proces)'],
    ['ExpenseTracker', 'Sledenje stroškov (kategorije, grafikoni)'],
    ['FoodCostCalculator', 'Kalkulator stroškov jedi (food cost %)'],
    ['FursManager', 'FURS certifikati in potrjevanje'],
    ['GiftCardManager', 'Darilne kartice (prodaja, polnjenje, poraba)'],
    ['GlobalNotifications', 'Globalna obvestila v realnem času'],
    ['GuestManager', 'Upravljanje gostov (CRM, obiski, zvestoba)'],
    ['HaccpManager', 'HACCP dnevnik (temperature, CCP, opozorila)'],
    ['HappyHourBanner', 'Happy hour pasica (časovno aktivna)'],
    ['IntegrationManager', 'Zunanje integracije (API, ključi, dnevniki)'],
    ['InventoryAlerts', 'Opozorila o zalogah (minimalne količine)'],
    ['InventoryManager', 'Upravljanje zalog (CRUD, enote, dobavitelji)'],
    ['KitchenDisplay', 'Kuhinjski zaslon (KDS, statusi, časi)'],
    ['KitchenPrepQueue', 'Pripravljalni vrstni red (prioritete, timerji)'],
    ['KitchenStationManager', 'Upravljanje kuhinjskih postaj'],
    ['KioskBar', 'Kiosk vrstica za hitro naročanje'],
    ['LanguageSwitcher', 'Preklapljanje 5 jezikov'],
    ['LocationManager', 'Upravljanje lokacij (multi-restavracija)'],
    ['LoyaltyManager', 'Zvestoben program (točke, nivoji, nagrade)'],
    ['MenuEngineeringMatrix', 'BCG matrika (Zvezdniki, Konji, Zagonetke, Psi)'],
    ['MenuManager', 'Upravljanje menijev in kategorij'],
    ['MultiLocationDashboard', 'Dashboard za vse lokacije'],
    ['NotificationManager', 'Obvestila (SMS, email, push, predloge)'],
    ['NutritionalCalculator', 'Prehranska analiza (kalorije, hranilne vrednosti)'],
    ['OrderBump', 'AI upsell predlaganje ob naročanju'],
    ['OrderPanel', 'Naročilna plošča (kategorije, iskanje, košarica)'],
    ['PaymentDialog', 'Plačilni dialog (gotovina, kartica, kombinirano)'],
    ['PinLogin', 'PIN prijava (4-mestni PIN za hiter dostop)'],
    ['PrinterManager', 'Upravljanje tiskalnikov (ESC/POS konfiguracija)'],
    ['ProfitLossReport', 'Poročilo o dobičku in izgubi'],
    ['RecipeManager', 'Recepti (normativi, kalkulacija, skaliranje)'],
    ['RecipeScaling', 'Skaliranje receptov (proportionalno)'],
    ['ReceiptDialog', 'Prikaz in tiskanje računov'],
    ['ReportsView', 'Poročila 2.0 (prodaja, DDV, izmene, izvoz)'],
    ['ReservationManager', 'Rezervacije (CRUD, statusi, mize)'],
    ['SettingsManager', 'Nastavitve sistema (FURS, DDV, zvestoba)'],
    ['ShiftManager', 'Izmene (odpiranje, zapiranje, gotovina)'],
    ['ShiftOverview', 'Pregled izmen (aktivne, zaključene)'],
    ['Sidebar', 'Stranska vrstica (navigacija, moduli)'],
    ['SplitCheckDialog', 'Delitev računa (po osebah ali artiklih)'],
    ['StaffPerformance', 'Učinkovitost osebja (KPI, ocena 0-100)'],
    ['StaffScheduler', 'Tedenski razpored zaposlenih (7shifts standard)'],
    ['StatsCard', 'Kartica s statistiko (KPI prikaz)'],
    ['StockDashboard', 'Dashboard zalog (vizualni pregled, opozorila)'],
    ['StornoDialog', 'Storno artiklov (z razlogom in avtorizacijo)'],
    ['SubscriptionManager', 'Naročnine (SaaS model, fakturiranje)'],
    ['SupplierManager', 'Dobavitelji (CRUD, kontakti, pogodbe)'],
    ['TableMap', 'Vizualni tloris miz (drag-and-drop)'],
    ['TableReservationSync', 'Sinhronizacija miz in rezervacij'],
    ['TableTurnoverAnalytics', 'Analitika obračuna miz (zasedenost, obračun)'],
    ['TaxReport', 'Davčno poročilo (DDV po stopnjah)'],
    ['TipManager', 'Napitnine (pool, point, distribucija)'],
    ['VendorScorecard', 'Ocenjevanje dobaviteljev (KPI)'],
    ['VisualFloorPlan', 'Vizualni tloris restavracije (interaktiven)'],
    ['VoidItemDialog', 'Poničenje artikla (razlog, avtorizacija)'],
    ['WaitTimeEstimator', 'AI ocena čakalnega časa'],
    ['WaitlistManager', 'Čakalni seznam (čas čakanja, obvestila)'],
    ['WasteTracker', 'Sledenje odpadkov (količine, razlogi)'],
    ['WebhookManager', 'Webhook integracije (Glovo, Wolt, Bolt)'],
    ['ZReportManager', 'Z-poročilo (dnevni zaključek blagajne)'],
]

story.append(Spacer(1, 18))
# Split into three tables for readability
third = len(pos_components) // 3 + 1
story.append(make_table(
    ['Komponenta', 'Opis'],
    pos_components[:third],
    col_ratios=[0.30, 0.70]
))
story.append(Paragraph('Tabela 6a: POS komponente (1. del)', caption_style))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Komponenta', 'Opis'],
    pos_components[third:2*third],
    col_ratios=[0.30, 0.70]
))
story.append(Paragraph('Tabela 6b: POS komponente (2. del)', caption_style))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Komponenta', 'Opis'],
    pos_components[2*third:],
    col_ratios=[0.30, 0.70]
))
story.append(Paragraph('Tabela 6c: POS komponente (3. del)', caption_style))

# ━━ 7. Javne strani in QR funkcionalnosti ━━
story.extend(add_major_section('7. Javne strani in QR funkcionalnosti'))

story.append(Paragraph(
    'RestaurantOS vključuje 12 javnih strani, ki so dostopne strankam brez prijave. Te strani omogočajo digitalno interakcijo med restavracijo in gosti, od pregleda menija in naročanja na mizi preko QR kode, do spletnega rezerviranja in sledenja naročil v realnem času. QR naročanje je zasnovano po vzoru Domino\'s Pizza sistema s sledenjem napredka v treh fazah: prejeto, v pripravi in pripravljeno. Vsaka miza ima unikatno QR kodo, ki gostu omogoča naročanje neposredno z mobilnega telefona brez nameščanja aplikacije.',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Stran', 'URL pot', 'Opis'],
    [
        ['Domača', '/', 'Preusmeritev na POS ali QR meni'],
        ['QR meni', '/qr-menu', 'Digitalni meni z alergeni in slikami'],
        ['QR naročanje', '/qr/[tableId]', 'Naročanje na mizi (večjezično)'],
        ['Rezervacije', '/reserve', 'Spletno rezerviranje miz'],
        ['Sledenje naročila', '/order-status/[orderId]', 'Domino\'s-style sledenje napredka'],
        ['Naročilo', '/order', 'Spletno naročanje za vnaprej'],
        ['Naročilo (detajli)', '/order/[orderId]', 'Podrobnosti naročila'],
        ['Digitalni račun', '/receipt', 'QR račun z DDV in FURS podatki'],
        ['Natakar', '/waiter', 'Mobilni pogled za natakarje'],
        ['Cenik', '/pricing', 'Javni cenik storitev'],
        ['KDS', '/kds', 'Samostojen kuhinjski zaslon'],
        ['Ocene', '/feedback', 'Javna stran za ocene gostov'],
    ],
    col_ratios=[0.22, 0.28, 0.50]
))
story.append(Paragraph('Tabela 7: Javne strani aplikacije', caption_style))

# ━━ 8. Varnost in skladnost ━━
story.extend(add_major_section('8. Varnost in skladnost'))

story.append(Paragraph(
    'Varnostni model RestaurantOS je večplasten in zajema avtentikacijo, avtorizacijo, validacijo vhodov, revizijski dnevnik in skladnost z evropskimi predpisi. Vse zaščitene API rute zahtevajo veljavno sejo preko requireAuth() funkcije, fina kontrola dostopa pa je implementirana s ROUTE_PERMISSIONS slovarjem, ki določa, katere vloge (admin, manager, staff) imajo dostop do posameznih modulov. PIN prijava uporablja 4-mestne PIN kode za hiter in varen dostop v POS okolju, seje pa so implementirane z JWT žetoni z 8-urnim TTL in 24-urnim absolutnim timeoutom.',
    body_style
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'Vsi vhodni podatki so validirani z Zod shemami na strežniku, kritične transakcije pa so zavite v Prisma $transaction za atomarnost. Revizijski dnevnik uporablja SHA-256 hash verigo za zaščito pred poseganjem v evidence, kar izpolnjuje zahteve FURS in davčne zakonodaje. Implementirani so tudi rate limiting na javnih API-jih, CORS zaščita in XSS zaščita s sanitizacijo uporabniških vnosov. Varnostne glave (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy) so konfigurirane v next.config.ts za vse rute.',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Mehanizem', 'Opis'],
    [
        ['requireAuth()', 'Vse zaščitene API rute zahtevajo veljavno sejo'],
        ['ROUTE_PERMISSIONS', 'Finoumna kontrola dostopa (admin, manager, staff)'],
        ['PIN prijava', '4-mestni PIN za hitro in varno prijavo v POS'],
        ['JWT seje', '8h TTL, 24h absolutni timeout'],
        ['Zod validacija', 'Vsi vhodni podatki validirani na strežniku s shemami'],
        ['Prisma $transaction', 'Atomske operacije za kritične transakcije'],
        ['Audit log (SHA-256)', 'Hash veriga za zaščito pred poseganjem v evidence'],
        ['Rate limiting', 'Omejitev zahtev na javnih API-jih'],
        ['CORS zaščita', 'Konfigurirana za dovoljene izvore'],
        ['XSS zaščita', 'Sanitizacija vseh uporabniških vnosov'],
        ['Varnostne glave', 'X-Frame-Options, X-Content-Type-Options, itd.'],
        ['FURS ZOI offline', 'Generiranje zaščitnega označevalnika brez povezave'],
        ['EOR čakalna vrsta', 'Računi se pošljejo FURS-u ob ponovni povezavi'],
    ],
    col_ratios=[0.30, 0.70]
))
story.append(Paragraph('Tabela 8: Varnostni mehanizmi', caption_style))

# ━━ 9. Offline zmogljivosti ━━
story.extend(add_major_section('9. Offline zmogljivosti'))

story.append(Paragraph(
    'RestaurantOS je zasnovan kot offline-first aplikacija, kar pomeni, da bistvene funkcije delujejo tudi brez internetne povezave. Ta funkcionalnost je ključnega pomena za restavratorsko poslovanje, kjer se internetne povezave pogosto izgubljajo. Service Worker predpomni vse kritične vire (HTML, CSS, JS, slike) za offline delovanje, IndexedDB pa shrani 22 trgovin podatkov za lokalno uporabo. Background Sync poskrbi za avtomatično sinhronizacijo ob ponovni povezavi z omrežjem. Implementiranih je več kot 15 custom hookov za offline delovanje, vključno z useOfflineOrder, useSyncQueue in useOfflineMenu. FURS ZOI se generira brez povezave, EOR pa se pošlje v čakalno vrsto in avtomatično obnovi, ko je povezava spet na voljo.',
    body_style
))

# ━━ 10. Internacionalizacija ━━
story.extend(add_major_section('10. Internacionalizacija'))

story.append(Paragraph(
    'Sistem podpira 5 jezikov s polnimi prevodi vseh modulov. Vsak jezik vsebuje več kot 800 ključev, kar zagotavlja popolno lokalizacijo vseh delov uporabniškega vmesnika, od gumbov in nalepk do obvestil in poročil. Primarni jezik je slovenščina, ki je tudi najbolj podrobno prevedena, saj je sistem zasnovan predvsem za slovensko tržišče. Preklapljanje jezikov je mogoče kadarkoli preko jezikovnega stikala v vrstici aplikacije, pri čemer se izbira shrani v lokalno shrambo in se ohranja med sejami. Prevodi so shranjeni v mapo messages/ v JSON formatu, vsak jezik pa ima svojo datoteko (sl.json, en.json, it.json, hr.json, de.json).',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Jezik', 'Datoteka', 'Velikost'],
    [
        ['Slovenščina (primarni)', 'sl.json', '~20 KB'],
        ['English', 'en.json', '~19 KB'],
        ['Italiano', 'it.json', '~20 KB'],
        ['Hrvatski', 'hr.json', '~20 KB'],
        ['Deutsch', 'de.json', '~21 KB'],
    ],
    col_ratios=[0.35, 0.35, 0.30]
))
story.append(Paragraph('Tabela 9: Podprti jeziki in velikosti prevodov', caption_style))

# ━━ 11. Infrastruktura in namestitev ━━
story.extend(add_major_section('11. Infrastruktura in namestitev'))

story.append(Paragraph(
    'RestaurantOS podpira več načinov namestitve za različna produkcijska okolja. Razvojni strežnik se zažene z npm run dev na vratih 3000, produkcijska namestitev pa uporablja Next.js standalone build z Bun runtime za hitrejši zagon. Za kontejnersko namestitev je na voljo Dockerfile z večstopenjskim buildom (deps, builder, runner), ki ustvari optimizirano Alpine sliko z minimalno velikostjo. Za procesno upravljanje je na voljo PM2 konfiguracija (ecosystem.config.js) z avtomatskim restartom ob napakah. Caddy reverse proxy (Caddyfile) poskrbi za HTTPS, kompresijo in caching. Vse skupaj je mogoče zagnati tudi z enostavnimi shell skriptami (start.sh, start-prod.sh, start-server.sh).',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Način namestitve', 'Ukaz', 'Opis'],
    [
        ['Razvoj', 'npm run dev', 'Next.js dev strežnik na vratih 3000'],
        ['Produkcija', 'npm run start', 'Bun + standalone build'],
        ['Docker', 'docker build -t restaurantos .', 'Alpine kontejner z večstopenjskim buildom'],
        ['PM2', 'pm2 start ecosystem.config.js', 'Procesno upravljanje z avtomatskim restartom'],
        ['WebSocket', 'node server.js', 'Ločen WebSocket strežnik za real-time'],
    ],
    col_ratios=[0.20, 0.40, 0.40]
))
story.append(Paragraph('Tabela 10: Načini namestitve', caption_style))

# ━━ 12. Knjižnični moduli ━━
story.extend(add_major_section('12. Knjižnični moduli (src/lib/)'))

story.append(Paragraph(
    'Mapa src/lib/ vsebuje 16 jedrnih knjižničnih modulov, ki zagotavljajo skupno funkcionalnost za vse dele aplikacije. Ti moduli vključujejo avtentikacijsko posredništvo, Prisma odjemalca z audit log podporo, ESC/POS protokol za termične tiskalnike, FURS integracijo za davčno potrjevanje, webhook motor za obdelavo zunanjih integracij, WebSocket odjemalec za real-time komunikacijo in Zod validacijske sheme za vse API vhode. Vsak modul je tipiziran s TypeScriptom in sledi enotnim konvencijam za obravnavo napak in dnevniško beleženje.',
    body_style
))

story.append(Spacer(1, 18))
story.append(make_table(
    ['Modul', 'Namen'],
    [
        ['auth-middleware.ts', 'Avtentikacija in dovoljenja (requireAuth, ROUTE_PERMISSIONS)'],
        ['connectors.ts', 'Integracijski konektorji za zunanje sisteme'],
        ['country-config.ts', 'Državno-specifična konfiguracija (DDV, FURS, valuta)'],
        ['counters.ts', 'Števci za sekvencne številke (naročila, računi)'],
        ['db.ts', 'Prisma klient + audit log pomožne funkcije'],
        ['escpos.ts', 'ESC/POS protokol za termične tiskalnike'],
        ['event-emitter.ts', 'Custom dogodkovni oddajnik za real-time obvestila'],
        ['furs.ts', 'FURS integracija (ZOI, EOR, certifikati, podpisovanje)'],
        ['i18n.ts', 'Internacionalizacija (5 jezikov, nalaganje prevodov)'],
        ['stock-deduction.ts', 'Logika razknjiževanja zalog ob naročilu'],
        ['store.ts', 'Zustand globalno stanje (košarica, aktivni pogled, UI)'],
        ['use-pos-shortcuts.ts', 'POS tipkovne bližnjice (F1-F12, Ctrl+X)'],
        ['utils.ts', 'Splošne pomožne funkcije (cn, formatiranje, itd.)'],
        ['validations.ts', 'Zod validacijske sheme za vse API vhode'],
        ['webhook-engine.ts', 'Webhook obdelovalni motor (pošiljanje, ponovni poskusi)'],
        ['websocket-client.ts', 'WebSocket odjemalec za real-time posodobitve'],
    ],
    col_ratios=[0.28, 0.72]
))
story.append(Paragraph('Tabela 11: Knjižnični moduli', caption_style))

# ━━ 13. AI zmogljivosti ━━
story.extend(add_major_section('13. AI zmogljivosti'))

story.append(Paragraph(
    'RestaurantOS vključuje obsežne AI zmogljivosti, ki jih poganja Google Gemini preko z-ai-web-dev-sdk paketa. AI pomočnik omogoča klepet v realnem času za podporo odločanju osebja, AI napovedi napovedujejo promet na podlagi zgodovinskih podatkov in trendov, AI priporočila optimizirajo meni, cene in zaloge, AI upsell pametno predlaga dodatke ob naročanju (priloge, pijača), AI ocena čakanja napove čakalni čas na podlagi zgodovine in zasedenosti, AI prehranska analiza pa kalkulira kalorije in hranilne vrednosti jedi. Vse AI funkcije so integrirane naravnost v POS vmesnik in so dostopne s klikom na gumb, ne da bi uporabnik zapustil svoj trenutni delovni okvir.',
    body_style
))

# ━━ 14. Načrt za prihodnje ━━
story.extend(add_major_section('14. Načrt za prihodnje'))

story.append(Paragraph(
    'Projekt ima jasno definiran načrt razvoja v treh časovnih obdobjih. Kratkoročno (Q2 2026) so načrtovane integracije s Twilio SMS, SendGrid email, Stripe plačilnim prehodom za spletne naročnine, real-time WebSocket posodobitve za vse module in PWA namestitev z ikono na namizju. Srednjeročno (Q3 2026) so načrtovane mobilna aplikacija (React Native/Capacitor), multi-tenant SaaS način, napredna AI analitika z TensorFlow.js, avtentikacija z biometrijo in integracija z računovodskimi programi (Pantheon, SAOP, Datalab). Dolgoročno (Q4 2026+) so načrtovani spletna trgovina za naročanje hrane, avtomatski backup v oblak, napredno upravljanje dobavne verige, CRM za goste z avtomatskimi kampanjami in compliance z EU regulativami (GDPR, DSGVO).',
    body_style
))

# ━━ 15. Zaključek ━━
story.extend(add_major_section('15. Zaključek'))

story.append(Paragraph(
    'RestaurantOS je izjemno obsežen in dobro strukturiran projekt, ki pokriva celoten spekter restavratorskega poslovanja z več kot 83.000 vrsticami kode, 69 podatkovnimi modeli, 65 API moduli in 76 POS komponentami. Arhitektura je zasnovana po standardih vodilnih svetovnih POS sistemov (Toast, Square, Lightspeed) in vključuje napredne funkcionalnosti, kot so FURS davčno potrjevanje, offline-first delovanje, AI zmogljivosti, multi-lokacijska podpora in celovit varnostni model. Projekt je pripravljen za produkcijsko namestitev z Docker, PM2 in Caddy podporo, obenem pa ima jasno definiran načrt razvoja za naslednje leto in pol, ki vključuje mobilno aplikacijo, SaaS model in napredno AI analitiko.',
    body_style
))

# ━━ Build ━━
doc.multiBuild(story)
print(f'PDF generated: {output_path}')
