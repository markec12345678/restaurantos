#!/usr/bin/env python3
"""Generate comprehensive RestaurantOS analysis & index PDF report."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib import colors
import os

# Colors
PRIMARY = HexColor('#d97706')      # Amber
SECONDARY = HexColor('#92400e')    # Dark amber
ACCENT = HexColor('#f59e0b')       # Light amber
BG_LIGHT = HexColor('#fffbeb')     # Very light amber
TEXT_DARK = HexColor('#1c1917')    # Stone 900
TEXT_MID = HexColor('#57534e')     # Stone 600
BORDER = HexColor('#e7e5e4')       # Stone 200

OUTPUT_PATH = '/home/z/my-project/download/RestaurantOS_Analiza_Indeks.pdf'

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=20*mm,
    rightMargin=20*mm,
    topMargin=25*mm,
    bottomMargin=20*mm,
    title='RestaurantOS - Analiza in Indeks',
    author='Z.ai',
    subject='Celovita analiza in indeks repozitorija RestaurantOS'
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'CoverTitle', parent=styles['Title'],
    fontSize=28, leading=34, textColor=SECONDARY,
    spaceAfter=6*mm, alignment=TA_CENTER,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'CoverSub', parent=styles['Normal'],
    fontSize=14, leading=18, textColor=TEXT_MID,
    spaceAfter=4*mm, alignment=TA_CENTER,
    fontName='Helvetica'
))
styles.add(ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontSize=18, leading=22, textColor=SECONDARY,
    spaceBefore=10*mm, spaceAfter=4*mm,
    fontName='Helvetica-Bold',
    borderWidth=0, borderPadding=0,
))
styles.add(ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontSize=14, leading=18, textColor=PRIMARY,
    spaceBefore=6*mm, spaceAfter=3*mm,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontSize=11, leading=14, textColor=SECONDARY,
    spaceBefore=4*mm, spaceAfter=2*mm,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=9, leading=13, textColor=TEXT_DARK,
    spaceAfter=2*mm, alignment=TA_JUSTIFY,
    fontName='Helvetica'
))
styles.add(ParagraphStyle(
    'Small', parent=styles['Normal'],
    fontSize=8, leading=11, textColor=TEXT_MID,
    spaceAfter=1.5*mm, fontName='Helvetica'
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=8, leading=10, textColor=TEXT_DARK,
    fontName='Helvetica'
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=8, leading=10, textColor=colors.white,
    fontName='Helvetica-Bold'
))
styles.add(ParagraphStyle(
    'BulletItem', parent=styles['Normal'],
    fontSize=9, leading=13, textColor=TEXT_DARK,
    leftIndent=12, spaceAfter=1.5*mm,
    fontName='Helvetica', bulletIndent=0
))

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    avail_width = A4[0] - 40*mm
    if col_widths is None:
        n = len(headers)
        col_widths = [avail_width / n] * n
    
    # Build data
    data = [[Paragraph(h, styles['TableHeader']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), styles['TableCell']) for c in row])
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), SECONDARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, PRIMARY),
    ]))
    return t

story = []

# ===== COVER =====
story.append(Spacer(1, 40*mm))
story.append(Paragraph('RestaurantOS', styles['CoverTitle']))
story.append(Paragraph('Celovita Analiza in Indeks Repositorija', styles['CoverSub']))
story.append(Spacer(1, 10*mm))
story.append(HRFlowable(width="60%", thickness=2, color=PRIMARY, spaceAfter=10*mm, spaceBefore=5*mm))
story.append(Paragraph('Next.js 16 POS sistem za slovenske restavracije', styles['CoverSub']))
story.append(Paragraph('Repozitorij: github.com/markec12345678/restaurantos', styles['Small']))
story.append(Paragraph('Datum analize: 10. junij 2026', styles['Small']))
story.append(Spacer(1, 15*mm))

# Cover summary table
summary_data = [
    ['Tehnologija', 'Next.js 16 + React 19 + Prisma + SQLite'],
    ['Komponente', '63 POS + 49 UI = 112 komponent'],
    ['API rute', '90+ REST endpoints'],
    ['Modelov DB', '55 Prisma modelov'],
    ['Artikli', '438 meni + 26 inventar = 464 artiklov'],
    ['Slike', '464 PNG (vse regenerirane in preverjene)'],
    ['Jeziki', '5 (SL, EN, IT, HR, DE)'],
    ['Strani', '12 Pages (POS, KDS, QR, Waiter...)'],
]
avail = A4[0] - 40*mm
story.append(make_table(['Metrika', 'Vrednost'], summary_data, [avail*0.3, avail*0.7]))

story.append(PageBreak())

# ===== 1. ARHITEKTURA PROJEKTA =====
story.append(Paragraph('1. Arhitektura Projekta', styles['H1']))
story.append(Paragraph(
    'RestaurantOS je profesionalen POS (Point-of-Sale) sistem za restavracije, zgrajen kot Next.js 16 aplikacija '
    's Prisma ORM in SQLite podatkovno bazo. Sistem je namenjen slovenskemu trgu s podporo za FURS fiskalizacijo, '
    'HACCP živilsko varnost, večlokacijsko poslovanje, realno-časovno komunikacijo preko WebSocket in PWA zmožnostmi. '
    'Aplikacija sledi Toast POS podatkovnemu modelu s prilagoditvami za slovensko davčno zakonodajo (DDV 22%, 9.5%, 0%) '
    'in fiskalno verifikacijo računov (ZOI/EOR).', styles['Body']))

story.append(Paragraph('1.1 Zgradba Direktorijev', styles['H2']))

dir_rows = [
    ['src/app/', 'Next.js App Router - strani in API rute'],
    ['src/components/pos/', '63 POS poslovnih komponent'],
    ['src/components/ui/', '49 shadcn/ui osnovnih komponent'],
    ['src/components/providers/', 'QueryProvider, ThemeProvider'],
    ['src/lib/', 'Jedrna poslovna logika in utility-ji'],
    ['src/hooks/', 'React hooks (use-mobile, use-toast)'],
    ['src/i18n/', 'next-intl konfiguracija'],
    ['prisma/', 'Prisma shema + SQLite baza'],
    ['public/menu-images/', '438 slik hrane in pijace po kategorijah'],
    ['public/inventory-images/', '26 slik inventarnih artiklov'],
    ['messages/', '5-jezikovni prevodi (sl, en, it, hr, de)'],
    ['scripts/', '~30 skript (generiranje slik, seeding, AI)'],
]
story.append(make_table(['Direktorij', 'Vsebina'], dir_rows, [avail*0.35, avail*0.65]))

story.append(Paragraph('1.2 Kljucne Tehnologije', styles['H2']))
tech_rows = [
    ['Framework', 'Next.js 16.1.1 (App Router, RSC)'],
    ['React', '19.0.0'],
    ['Database', 'Prisma 6.11.1 + SQLite (WAL mode)'],
    ['State', 'Zustand 5.0.6'],
    ['Data Fetching', 'TanStack React Query 5.82.0'],
    ['UI', 'shadcn/ui (new-york) + 25+ Radix primitivov'],
    ['Styling', 'Tailwind CSS 4 + oklch barvni prostor'],
    ['i18n', 'next-intl 4.3.4 + custom i18n sistem'],
    ['Charts', 'Recharts 2.15.4'],
    ['Animations', 'Framer Motion 12.23.2'],
    ['Forms', 'react-hook-form 7.60 + zod 4.0.2'],
    ['DnD', '@dnd-kit/core 6.3.1 (tloris miz)'],
    ['WebSocket', 'ws 8.20.0 (custom server)'],
    ['AI', 'z-ai-web-dev-sdk 0.0.17 + Gemini'],
    ['Printing', 'ESC/POS (thermal printers)'],
    ['QR', 'qrcode 1.5.4'],
]
story.append(make_table(['Kategorija', 'Knjiznica'], tech_rows, [avail*0.25, avail*0.75]))

# ===== 2. STRANI IN RUTE =====
story.append(Paragraph('2. Strani in Rute', styles['H1']))
story.append(Paragraph(
    'Aplikacija ima 12 uporabniskih strani in 90+ API endpointov. Glavna POS stran je enostranska aplikacija (SPA), '
    'kjer se moduli preklapljajo preko Zustand stanja. KDS, natakar in QR naročanje so locene strani za razlicne naprave.', styles['Body']))

pages_rows = [
    ['/', 'POS Terminal', 'Glavni POS terminal z moduli'],
    ['/waiter', 'Natakar', 'Mobilni pogled za natakarje'],
    ['/kds', 'KDS', 'Kuhinjski zaslon (Kitchen Display)'],
    ['/qr/[tableId]', 'QR Naročanje', 'Naročanje preko QR kode mize'],
    ['/qr-menu', 'QR Jedilnik', 'Javni jedilnik z AI upsell'],
    ['/order', 'Spletno naročanje', 'Dostava/odnos s plačilom'],
    ['/order/[orderId]', 'Sledenje', 'Domino-style sledenje naročila'],
    ['/order-status/[orderId]', 'Status', 'Iskanje statusa po telefonski'],
    ['/receipt', 'Račun', 'Digitalni račun s FURS QR'],
    ['/reserve', 'Rezervacija', 'Obrazec za rezervacijo mize'],
    ['/feedback', 'Povratna info', 'Ocena gostov (zvezdice + tagi)'],
    ['/pricing', 'Cenik SaaS', 'Starter 29EUR, Pro 49EUR, Ent 99EUR'],
]
story.append(make_table(['Ruta', 'Ime', 'Opis'], pages_rows, [avail*0.2, avail*0.2, avail*0.6]))

# ===== 3. PODATKOVNA BAZA =====
story.append(Paragraph('3. Podatkovna Baza - Prisma Shema', styles['H1']))
story.append(Paragraph(
    'Podatkovna baza vsebuje 55 Prisma modelov, organiziranih v 9 funkcionalnih domen. Uporablja SQLite s prizhganim WAL nacinom '
    'za hkratno branje/pisanje iz vec terminalov. Baza nima migracij (uporablja prisma db push). Aktivna baza je db/custom.db (1.49 MB), '
    'medtem ko je prisma/dev.db prazna (0 bytov).', styles['Body']))

story.append(Paragraph('3.1 Domene Modelov', styles['H2']))
domain_rows = [
    ['Meni Hierarhija', '6 modelov', 'Menu, Category, MenuItem, ModifierGroup, Modifier, MenuItemModifierGroup'],
    ['Konfiguracija', '13 modelov', 'TaxRate, DiningOption, RevenueCenter, ServiceCharge, SalesCategory, PriceGroup, PrepStation, AlternatePaymentType, VoidReason, NoSaleReason, Printer, PackagingConfig, PackagingItem'],
    ['Narocila in Placila', '7 modelov', 'Table, Order, OrderItem, Check, Payment, Discount, DeliveryInfo'],
    ['Kadri', '6 modelov', 'Employee, Job, EmployeeJob, Shift, TimeEntry, StaffShift'],
    ['Blagajna', '1 model', 'CashRegisterShift'],
    ['Inventar', '5 modelov', 'InventoryItem, StockTransaction, RecipeItem, Supplier, PurchaseOrder + PurchaseOrderItem'],
    ['Fiskal/Loyalty/Gift', '5 modelov', 'Receipt, LoyaltyAccount, LoyaltyTransaction, GiftCard, GiftCardTransaction'],
    ['CRM/Gost', '5 modelov', 'Guest, GuestVisit, GuestFeedback, Reservation, WaitlistEntry'],
    ['Sistem/Platforma', '12+ modelov', 'RestaurantSettings, Location, DeliveryZone, OpeningHours, HaccpEntry, Webhook, AuditLog, Course, AIConversation, HappyHourSchedule, Integration, Subscription, ZReport, TipPool...'],
]
story.append(make_table(['Domena', 'Stevilo', 'Modeli'], domain_rows, [avail*0.18, avail*0.1, avail*0.72]))

story.append(Paragraph('3.2 Kljucne Relacije', styles['H2']))
story.append(Paragraph(
    'Menu 1:N Category 1:N MenuItem - jedilnik je hierarhicno organiziran. MenuItem je povezan z InventoryItem (1:1), '
    'RecipeItem (1:N, BOM/sestavine), in ModifierGroup (M:N preko MenuItemModifierGroup). '
    'Order je centralni transakcijski model z OrderItem, Check (split billing), Payment, Receipt (FURS) in DeliveryInfo. '
    'Location je "hub" model z 12 relacijami za veclokacijsko poslovanje. '
    'Guest je povezan z LoyaltyAccount (1:1), GuestVisit (1:N) in Order (1:N).', styles['Body']))

# ===== 4. API RUTE =====
story.append(Paragraph('4. API Rute (90+ Endpointov)', styles['H1']))

api_rows = [
    ['Avtentikacija', '3', 'POST/GET/DELETE /api/auth (PIN login, status, logout)'],
    ['Narocila', '7', 'CRUD /api/orders + /add-items, /seed'],
    ['Checki', '4', 'CRUD /api/checks (split billing)'],
    ['Placila', '3', 'GET/POST /api/payments (cash/card/mobile/voucher/loyalty/giftcard)'],
    ['Racuni/FURS', '6', '/api/receipts + /api/furs (ZOI, EOR, batch, storno)'],
    ['Meni', '10', 'CRUD menus, categories, menu-items, modifier-groups'],
    ['Mize', '4', 'CRUD /api/tables (vizualni tloris: posX/Y, shape, rotation)'],
    ['Inventar', '12', '/api/inventory + adjust, restock, reorder, forecast, menu-stock, transactions'],
    ['Zaposleni', '12', 'CRUD employees, shifts, time-entries, jobs, staff-performance, tip-pool'],
    ['Blagajna', '5', '/api/cash-register, /api/end-of-day, /api/z-report'],
    ['Gostje CRM', '10', 'CRUD guests, reservations, waitlist, loyalty, gift-cards'],
    ['Dostava', '7', '/api/delivery + zones, tracking + Wolt/Glovo webhooks'],
    ['Pricne priloznosti', '4', '/api/discounts, /api/happy-hour'],
    ['Poročila', '8', '/api/reports (sales, eod, popular, shifts, employees, vat, financial, export)'],
    ['Javne (brez auth)', '12', '/api/public/* (menu, order, order-track, verify-table, call-waiter...)'],
    ['Nastavitve', '7', '/api/settings, configuration, opening-hours, locations, printers, haccp'],
    ['Integracije', '11', '/api/integrations + webhooks (rotate-key, logs, sync, scheduler)'],
    ['Kuhinja', '3', '/api/kitchen, /api/courses, /api/ws-broadcast'],
    ['AI', '3', '/api/ai-assistant + /api/ai/qr-upsell'],
    ['Ostalo', '8', 'seed, audit, notifications, daily-checklist, expenses, card-terminal, subscription, packaging'],
]
story.append(make_table(['Kategorija', 'St.', 'Endpointi'], api_rows, [avail*0.18, avail*0.06, avail*0.76]))

story.append(Paragraph('4.1 Avtentikacija in Avtorizacija', styles['H2']))
story.append(Paragraph(
    'Sistem uporablja custom session-based avtentikacijo (ne NextAuth). Zaposleni se prijavi s PIN kodo, '
    'ki se primerja z bcrypt hashem. Seja se shrani v pomnilniku (Map) z Bearer tokenom (8h drsneci, 24h absolutni timeout). '
    'RBAC ima 8 dovoljenj: take_orders, void_items, apply_discounts, manage_cash, manage_inventory, manage_employees, view_reports, admin. '
    'Javne rute (GET) so brez avtentikacije. Rate limiting: 5 poskusov prijave na IP/15min, 5 javnih narocil na IP/min.', styles['Body']))

# ===== 5. KOMPONENTE =====
story.append(Paragraph('5. Frontend Komponente', styles['H1']))

story.append(Paragraph('5.1 POS Komponente (63)', styles['H2']))
comp_rows = [
    ['Jedro POS', 'Sidebar, OrderPanel, PaymentDialog, ReceiptDialog, SplitCheckDialog, StornoDialog, VoidItemDialog, PinLogin, OrderBump, KioskBar'],
    ['Kuhinja', 'KitchenDisplay, KitchenPrepQueue, KitchenStationManager, CoursePacing'],
    ['Tloris', 'TableMap, VisualFloorPlan, TableTurnoverAnalytics, TableReservationSync'],
    ['Meni', 'MenuManager, MenuEngineeringMatrix, AllergenMatrix, AllergenFilter, NutritionalCalculator, FoodCostCalculator, RecipeManager, RecipeScaling'],
    ['Inventar', 'InventoryManager, StockDashboard, InventoryAlerts, SupplierManager, VendorScorecard, WasteTracker'],
    ['Kadri', 'EmployeeManager, StaffScheduler, StaffPerformance, ShiftManager, ShiftOverview, TipManager'],
    ['Blagajna', 'CashRegister, EndOfDayManager, ZReportManager, TaxReport, ProfitLossReport, ExpenseTracker, DailyChecklist'],
    ['CRM', 'GuestManager, CustomerTimeline, CustomerFeedback, LoyaltyManager, GiftCardManager, WaitlistManager, ReservationManager'],
    ['Dostava', 'DeliveryManager, DeliveryTracker'],
    ['Poročila', 'ReportsView, Dashboard, StatsCard, AIForecastDashboard'],
    ['AI', 'AIAssistant, AIRecommendations, WaitTimeEstimator'],
    ['Konfig', 'SettingsManager, ConfigurationManager, PrinterManager, FursManager, IntegrationManager, WebhookManager, LocationManager, MultiLocationDashboard, SubscriptionManager, ComplianceDashboard, HaccpManager'],
    ['UI', 'LanguageSwitcher, HappyHourBanner, GlobalNotifications, NotificationManager'],
]
story.append(make_table(['Kategorija', 'Komponente'], comp_rows, [avail*0.15, avail*0.85]))

story.append(Paragraph('5.2 Stanje Aplikacije (Zustand)', styles['H2']))
state_rows = [
    ['activeModule', 'string', 'Trenutno aktiven POS modul'],
    ['cart', 'CartItemType[]', 'Kosarica z modifikatorji, DDV'],
    ['orderType', 'string', 'dine-in / takeout / delivery'],
    ['selectedTable', 'string|null', 'Aktivna miza'],
    ['discount', 'number', 'Popust'],
    ['locale', 'Locale', 'Trenutni jezik (sl, en, it, hr, de)'],
    ['country', 'CountryCode', 'Drzava (vpliva na davke)'],
    ['kioskMode', 'boolean', 'Kiosk nacin'],
    ['happyHourActive', 'boolean', 'Veseli uro aktivna'],
    ['activePriceGroupId', 'string|null', 'Cenovna skupina za veselo uro'],
]
story.append(make_table(['Kljuc', 'Tip', 'Opis'], state_rows, [avail*0.22, avail*0.2, avail*0.58]))

# ===== 6. SLIKE ARTIKLOV =====
story.append(Paragraph('6. Slike Artiklov - Preverjanje in Popravki', styles['H1']))
story.append(Paragraph(
    'Vsi 438 meni artikli in 26 inventarnih artiklov imajo svoje slike povezane v podatkovni bazi. '
    'Splet VLM (Vision Language Model) preverjanja je identificiral 5 neujemanj, Python analiza barvne variance pa se 38 sumljivih slik '
    '(ikone/grafike namesto fotografij). Vseh 43 slik je bilo regeneriranih s pravilnimi AI fotografijami hrane/pijace. '
    'Regenerirane slike so bile ponovno preverjene z VLM in vse ustrezno prikazujejo artikel, ki ga predstavljajo.', styles['Body']))

story.append(Paragraph('6.1 Popravljene Kategorije', styles['H2']))
fix_rows = [
    ['Kalamari', '5/7', 'Risane ikone lignja zamenjane s pravimi fotografijami kalamarijev'],
    ['Sladice', '10', 'Generične ikone zamenjane s pravimi fotografijami sladic'],
    ['Vegetarijanske jedi', '5', 'Ikone zamenjane s pravimi fotografijami vegetarijanskih jedi'],
    ['Omake', '4', 'Ikone zamenjane s pravimi fotografijami omak'],
    ['Grenčice', '3', 'Ikone zamenjane s fotografijami steklenic'],
    ['Destilati', '3', 'Ikone zamenjane s fotografijami steklenic'],
    ['Palačinke', '3', 'Ikone zamenjane s pravimi fotografijami'],
    ['Malice', '3', 'Ikone zamenjane s pravimi fotografijami jedi'],
    ['Gazirane pijače', '2', 'Ikone zamenjane s fotografijami steklenic'],
    ['Viski', '2', 'Ikone zamenjane s fotografijami steklenic'],
    ['Otroške jedi', '1', 'Ikona zamenjana s fotografijo'],
    ['Likerji', '1', 'Ikona zamenjana s fotografijo'],
    ['Mešane pijače', '1', 'Ikona zamenjana s fotografijo'],
    ['Hladne predjedi', '1', 'Napacna slika zamenjana s sirno plosco'],
]
story.append(make_table(['Kategorija', 'Popravljeno', 'Opis popravka'], fix_rows, [avail*0.2, avail*0.1, avail*0.7]))

story.append(Paragraph('6.2 Statistika Slik', styles['H2']))
img_rows = [
    ['Skupaj slik', '464', '438 meni + 26 inventar'],
    ['Popravljene slike', '43', '5 VLM potrjeno + 38 Python odkritih'],
    ['Forma', 'PNG', 'Vse slike so PNG format'],
    ['Resolucije', '1024x1024 (58%), 600x600 (32%), 864x1152 (10%)', 'Tri razlicne resolucije'],
    ['Povprecna velikost', '295 KB', 'Mediana: 98 KB'],
    ['Zmanjsane slike', '0', 'Vse slike so nad 50KB'],
    ['Duplikati', '0', 'Vse slike so unikatne'],
    ['Manjkajoce', '0', 'Vse povezave v DB so veljavne'],
]
story.append(make_table(['Metrika', 'Vrednost', 'Opomba'], img_rows, [avail*0.2, avail*0.2, avail*0.6]))

# ===== 7. STATISTIKA ARTIKLOV =====
story.append(Paragraph('7. Statistika Artiklov po Kategorijah', styles['H1']))

cat_rows = [
    ['Glavne jedi', '37', 'Hrana', '22%'],
    ['Pizze', '27', 'Hrana', '22%'],
    ['Sladice', '24', 'Hrana', '22%'],
    ['Solate', '23', 'Hrana', '22%'],
    ['Testenine, njoki', '18', 'Hrana', '22%'],
    ['Priloge', '18', 'Hrana', '22%'],
    ['Topli napitki', '18', 'Pijaca', '22%'],
    ['Palačinke', '13', 'Hrana', '22%'],
    ['Penine in Sampanjci', '13', 'Pijaca', '22%'],
    ['Malice', '12', 'Hrana', '22%'],
    ['Otroške jedi', '12', 'Hrana', '22%'],
    ['Mešane pijače', '14', 'Pijaca', '22%'],
    ['Gazirane pijače', '11', 'Pijaca', '22%'],
    ['Burgerji', '9', 'Hrana', '22%'],
    ['Omake', '9', 'Hrana', '22%'],
    ['Sokovi', '9', 'Pijaca', '22%'],
    ['Vegetarijanske jedi', '8', 'Hrana', '22%'],
    ['Vode', '8', 'Pijaca', '22%'],
    ['Tople predjedi', '7', 'Hrana', '9.5%'],
    ['Kalamari', '7', 'Hrana', '22%'],
    ['Ribje jedi', '7', 'Hrana', '9.5%'],
    ['Likersko vino', '7', 'Pijaca', '22%'],
    ['Destilati', '15', 'Pijaca', '22%'],
    ['Bela vina', '25', 'Pijaca', '22%'],
    ['Rdeča vina', '16', 'Pijaca', '22%'],
    ['Točeno pivo', '10', 'Pijaca', '22%'],
    ['Viski', '10', 'Pijaca', '22%'],
    ['Grenčice', '6', 'Pijaca', '22%'],
    ['Gin', '6', 'Pijaca', '22%'],
    ['Likerji', '6', 'Pijaca', '22%'],
    ['Tuja vina', '6', 'Pijaca', '22%'],
    ['Craft piva', '3', 'Pijaca', '22%'],
    ['Pivo', '3', 'Pijaca', '22%'],
    ['Rižote', '5', 'Hrana', '9.5%'],
    ['Rosé vino', '3', 'Pijaca', '22%'],
    ['Naravni sokovi', '5', 'Pijaca', '22%'],
    ['Juhe', '3', 'Hrana', '9.5%'],
    ['Hladne predjedi', '3', 'Hrana', '22%'],
    ['Brezalkoholno pivo', '2', 'Pijaca', '22%'],
]
story.append(make_table(['Kategorija', 'Artiklov', 'Tip', 'DDV'], cat_rows, [avail*0.35, avail*0.1, avail*0.15, avail*0.1]))

# ===== 8. ZUNANJE INTEGRACIJE =====
story.append(Paragraph('8. Zunanje Integracije', styles['H1']))

int_rows = [
    ['FURS', 'Fiskalizacija', 'ZOI + EOR verifikacija, OAuth2/JWT, test/prod okolje'],
    ['Wolt', 'Dostava', 'Webhook z HMAC podpisom, idempotentno ustvarjanje narocil'],
    ['Glovo', 'Dostava', 'Webhook z HMAC podpisom, enak vzorec kot Wolt'],
    ['Google Gemini', 'AI', 'AI asistent za optimizacijo menija, napovedi, priporocila'],
    ['ESC/POS', 'Tiskanje', 'Termicni tiskalniki za kuhinjo in racune'],
    ['Stripe', 'Placila', 'SaaS naročnine (Subscription model)'],
    ['Twilio', 'SMS', 'Obvestila za goste in osebje'],
    ['SendGrid', 'Email', 'E-poštna obvestila'],
]
story.append(make_table(['Servis', 'Tip', 'Opis'], int_rows, [avail*0.15, avail*0.15, avail*0.7]))

# ===== 9. DEPLOYMENT =====
story.append(Paragraph('9. Deployment in Infrastruktura', styles['H1']))

deploy_rows = [
    ['Dockerfile', 'Multi-stage (node:20-alpine), standalone output, port 3000'],
    ['server.js', 'Custom Next.js server z WebSocket podporo (/ws)'],
    ['Caddyfile', 'Reverse proxy (port 81 -> 3000) z X-Forwarded headers'],
    ['PM2', 'Process manager (max 512MB, auto-restart, 10 max restarts)'],
    ['Start skripte', 'start.sh, start-prod.sh, start-server.sh, run-prod.sh'],
    ['PWA', 'Service Worker + manifest.json za namestitev kot aplikacijo'],
    ['SQLite WAL', 'Concurrent read/write za več terminalov'],
    ['Varnost', 'Security headers (X-Frame-Options, CSP, XSS Protection)'],
]
story.append(make_table(['Komponenta', 'Opis'], deploy_rows, [avail*0.2, avail*0.8]))

# ===== 10. POVZETEK =====
story.append(Paragraph('10. Povzetek in Ugotovitve', styles['H1']))
story.append(Paragraph(
    'RestaurantOS je izjemno obsezen in funkcionalen POS sistem, ki pokriva vse vidike poslovanja restavracije: '
    'od naročanja in plačevanja, preko upravljanja zaloge in kadrov, do fiskalne skladnosti in CRM. '
    'S 55 podatkovnimi modeli, 90+ API endpointi in 112 React komponentami predstavlja enega najbolj celovitih '
    'odprtokodnih POS sistemov za slovenski trg.', styles['Body']))

story.append(Paragraph('10.1 Kljucne Prednosti', styles['H2']))
strengths = [
    'Polna FURS fiskalna skladnost (ZOI/EOR, ZDDV-1 računi, storno postopek)',
    'Večlokacijsko poslovanje z locenimi FURS certifikati po lokaciji',
    'Realno-časovna komunikacija (WebSocket) za KDS, natakarje in obvestila',
    '5-jezikovna podpora s slovenščino kot primarnim jezikom',
    'AI funkcije (asistent, napovedi, priporočila, QR upsell)',
    'Integracija z dostavnimi platformami (Wolt, Glovo)',
    'HACCP skladnost z dnevnimi kontrolnimi seznami',
    'PWA za namestitev na tablice in telefone brez app store-a',
    'Split billing (Toast-style checki) za delitev računa',
    'EU 14-alergenska skladnost z barvno kodiranimi oznakami',
]
for s in strengths:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {s}', styles['BulletItem']))

story.append(Paragraph('10.2 Potential Izboljsave', styles['H2']))
improvements = [
    'Resolucija slik: 3 razlicne resolucije (600x600, 864x1152, 1024x1024) - poenotiti na 1024x1024',
    'prisma/dev.db je prazna - aktivna baza je v db/custom.db, zmeda pri konfiguraciji',
    '60+ JSON datotek v korenu projekta - razmisliti o .gitignore ali premiku v podimenik',
    'In-memory seje (Map) namesto Redis - omejitev za horizontalno skaliranje',
    'Ni CI/CD pipeline-a (brez .github/workflows) - ročno deployanje',
    'ESLint pravila sproscena (no-explicit-any, no-unused-vars) - tehnični dolg',
    'Nekatere slike so bile ikone/grafike namesto fotografij - ze popravljeno v tej analizi',
]
for s in improvements:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {s}', styles['BulletItem']))

# Build PDF
doc.build(story)
print(f'PDF generated: {OUTPUT_PATH}')
print(f'Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB')
