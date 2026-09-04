#!/usr/bin/env python3
"""RestaurantOS P0 E2E Test Scenarios - PDF builder."""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (Paragraph, Spacer, PageBreak, Table, TableStyle, Image, Flowable, Preformatted)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame

sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')
from pdf import install_font_fallback

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
try:
    pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
except: pass
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
install_font_fallback()

HEADER_FILL=colors.HexColor('#685f46'); ACCENT=colors.HexColor('#86702b')
BORDER=colors.HexColor('#d1c9b3'); TEXT_PRIMARY=colors.HexColor('#1d1c1a')
TEXT_MUTED=colors.HexColor('#8a8881'); CARD_BG=colors.HexColor('#eeedea')
TABLE_STRIPE=colors.HexColor('#f0efed')
SEM_SUCCESS=colors.HexColor('#3c7a50'); SEM_WARNING=colors.HexColor('#a98846')
SEM_ERROR=colors.HexColor('#9b4a43'); SEM_INFO=colors.HexColor('#426990')
CODE_BG=colors.HexColor('#f5f4f2')

PAGE_W,PAGE_H=A4; MARGIN=22*mm; CONTENT_W=PAGE_W-2*MARGIN
OUTPUT_BODY='/home/z/my-project/scripts/e2e_body.pdf'

h1_style=ParagraphStyle('H1',fontName='NotoSerifSC-Bold',fontSize=20,leading=26,textColor=HEADER_FILL,spaceBefore=14,spaceAfter=10,alignment=TA_LEFT)
h2_style=ParagraphStyle('H2',fontName='NotoSerifSC-Bold',fontSize=14,leading=20,textColor=ACCENT,spaceBefore=12,spaceAfter=6,alignment=TA_LEFT)
h3_style=ParagraphStyle('H3',fontName='NotoSerifSC-Bold',fontSize=11.5,leading=16,textColor=TEXT_PRIMARY,spaceBefore=8,spaceAfter=4,alignment=TA_LEFT)
body_style=ParagraphStyle('Body',fontName='NotoSerifSC',fontSize=10.5,leading=16,textColor=TEXT_PRIMARY,spaceAfter=8,alignment=TA_LEFT,wordWrap='CJK')
bullet_style=ParagraphStyle('Bullet',fontName='NotoSerifSC',fontSize=10.5,leading=15,textColor=TEXT_PRIMARY,leftIndent=14,spaceAfter=4,alignment=TA_LEFT,wordWrap='CJK')
caption_style=ParagraphStyle('Caption',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER,spaceBefore=4,spaceAfter=14)
callout_t=ParagraphStyle('CT',fontName='NotoSerifSC-Bold',fontSize=11,leading=15,textColor=colors.white)
callout_b=ParagraphStyle('CB',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=colors.white,wordWrap='CJK')
th_style=ParagraphStyle('TH',fontName='NotoSerifSC-Bold',fontSize=9,leading=12,textColor=colors.white,alignment=TA_CENTER)
tc_style=ParagraphStyle('TC',fontName='NotoSerifSC',fontSize=8.5,leading=11,textColor=TEXT_PRIMARY,alignment=TA_LEFT,wordWrap='CJK')
tc_center=ParagraphStyle('TCC',fontName='NotoSerifSC',fontSize=8.5,leading=11,textColor=TEXT_PRIMARY,alignment=TA_CENTER,wordWrap='CJK')
toc1=ParagraphStyle('T1',fontName='NotoSerifSC-Bold',fontSize=11,leading=18,textColor=TEXT_PRIMARY,spaceBefore=4)
toc2=ParagraphStyle('T2',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=TEXT_PRIMARY,leftIndent=18,spaceBefore=2)
code_style=ParagraphStyle('Code',fontName='SarasaMonoSC',fontSize=8.5,leading=11,textColor=TEXT_PRIMARY,backColor=CODE_BG,borderColor=BORDER,borderWidth=0.5,borderPadding=8,spaceBefore=4,spaceAfter=10)

def H1(t):
    k=f'h_{hashlib.md5(t.encode()).hexdigest()[:8]}'
    p=Paragraph(f'<a name="{k}"/>{t}',h1_style); p.bookmark_name=k; p.bookmark_level=0; p.bookmark_text=t; p.bookmark_key=k
    return p
def H2(t):
    k=f'h_{hashlib.md5(t.encode()).hexdigest()[:8]}'
    p=Paragraph(f'<a name="{k}"/>{t}',h2_style); p.bookmark_name=k; p.bookmark_level=1; p.bookmark_text=t; p.bookmark_key=k
    return p
def H3(t): return Paragraph(f'<b>{t}</b>',h3_style)
def P(t): return Paragraph(t,body_style)
def B(t): return Paragraph(f'•  {t}',bullet_style)
def C(t): return Paragraph(t,caption_style)
def SP(h=10): return Spacer(1,h)
def CODE(t): return Preformatted(t, code_style)
def CALLOUT(title,body,color=ACCENT):
    data=[[Paragraph(f'<b>{title}</b>',callout_t)],[Paragraph(body,callout_b)]]
    t=Table(data,colWidths=[CONTENT_W])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),color),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('VALIGN',(0,0),(-1,-1),'TOP')]))
    return t

def test_case(test_id, title, priority, preconditions, steps, expected, status='☐'):
    """Build a single test case as a table."""
    data = [
        [Paragraph(f'<b>{test_id}</b>', ParagraphStyle('tid', fontName='SarasaMonoSC', fontSize=10, textColor=ACCENT, alignment=TA_LEFT)),
         Paragraph(f'<b>{title}</b>', ParagraphStyle('tt', fontName='NotoSerifSC-Bold', fontSize=10, textColor=TEXT_PRIMARY, alignment=TA_LEFT)),
         Paragraph(f'<b>Prioriteta:</b> {priority}', ParagraphStyle('tp', fontName='NotoSerifSC', fontSize=9, textColor=TEXT_MUTED, alignment=TA_LEFT)),
         Paragraph(f'<b>Status:</b> {status}', ParagraphStyle('ts', fontName='NotoSerifSC', fontSize=9, textColor=TEXT_MUTED, alignment=TA_LEFT))],
    ]
    t1 = Table(data, colWidths=[60, CONTENT_W-260, 100, 100])
    t1.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ]))

    # Details table
    details = [
        [Paragraph('<b>Predpogoji</b>', ParagraphStyle('ph', fontName='NotoSerifSC-Bold', fontSize=9, textColor=HEADER_FILL)), Paragraph(preconditions, tc_style)],
        [Paragraph('<b>Koraki</b>', ParagraphStyle('ph', fontName='NotoSerifSC-Bold', fontSize=9, textColor=HEADER_FILL)), Paragraph(steps, tc_style)],
        [Paragraph('<b>Pričakovan rezultat</b>', ParagraphStyle('ph', fontName='NotoSerifSC-Bold', fontSize=9, textColor=HEADER_FILL)), Paragraph(expected, tc_style)],
    ]
    t2 = Table(details, colWidths=[80, CONTENT_W-80])
    t2.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LINEBELOW', (0,0), (-1,-2), 0.3, BORDER),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('BACKGROUND', (0,0), (0,-1), TABLE_STRIPE),
    ]))
    return [t1, t2, SP(8)]

def TBL(data,cw=None,hdr=True):
    if cw is None: cw=[CONTENT_W/len(data[0])]*len(data[0])
    rows=[]
    for ri,row in enumerate(data):
        nr=[]
        for c in row:
            if isinstance(c,(Paragraph,Image,Table)): nr.append(c)
            else: nr.append(Paragraph(str(c),th_style if (hdr and ri==0) else tc_style))
        rows.append(nr)
    t=Table(rows,colWidths=cw,hAlign='CENTER',repeatRows=1 if hdr else 0)
    st=[('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('GRID',(0,0),(-1,-1),0.4,BORDER)]
    if hdr:
        st.append(('BACKGROUND',(0,0),(-1,0),HEADER_FILL)); st.append(('TEXTCOLOR',(0,0),(-1,0),colors.white))
        for r in range(1,len(rows)):
            st.append(('BACKGROUND',(0,r),(-1,r),TABLE_STRIPE if r%2==1 else colors.white))
    t.setStyle(TableStyle(st))
    return t

class HR(Flowable):
    def __init__(self,w=None,th=1.0,c=None,sb=4,sa=8):
        super().__init__(); self.w=w or CONTENT_W; self.th=th; self.c=c or BORDER; self.sb=sb; self.sa=sa
    def wrap(self,*a): return (self.w,self.th+self.sb+self.sa)
    def draw(self):
        self.canv.setStrokeColor(self.c); self.canv.setLineWidth(self.th); y=self.sa
        self.canv.line(0,y,self.w,y)

class TocDoc(BaseDocTemplate):
    def __init__(self,f,**kw):
        super().__init__(f,**kw)
        fr=Frame(MARGIN,MARGIN,CONTENT_W,PAGE_H-2*MARGIN,id='n',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        self.addPageTemplates([PageTemplate(id='B',frames=fr,onPage=self._f)])
    def _f(self,c,d):
        c.saveState(); c.setStrokeColor(BORDER); c.setLineWidth(0.5)
        c.line(MARGIN,MARGIN-8,PAGE_W-MARGIN,MARGIN-8)
        c.setFont('NotoSerifSC',8); c.setFillColor(TEXT_MUTED)
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · P0 E2E Test Scenarios · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building E2E test scenarios...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. INTRO
story.append(H1('1. Uvod in testno okolje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Ta dokument vsebuje E2E (end-to-end) testne scenarije za P0 prioritete RestaurantOS v1.0.0. Testni scenariji so namenjeni QA inženirju (Peter Leban) za izvajanje v sprintih 6-7 (glej Sprint Plan, naloge P0-033 do P0-037). Vsak testni scenarij vsebuje: ID, naslov, prioriteto, predpogoje, korake izvedbe in pričakovan rezultat.'))
story.append(P('Skupno je pripravljenih <b>40 testnih scenarijev</b> razporejenih v 4 kategorije: FURS (10), Stripe (12), PWA (10), integracijski (8). Po uspešnem izvedu vseh testov se P0 šteje za zaključen (Definition of Done).'))
story.append(H2('1.1 Testno okolje'))
story.append(B('<b>URL:</b> http://localhost:3000 (lokalno) ali https://restaurantos-staging.vercel.app (staging)'))
story.append(B('<b>Admin PIN:</b> 1234 (admin), 5555 (super-admin)'))
story.append(B('<b>Testni uporabnik:</b> test-admin (PIN 1111, seedan v tests/e2e/global.setup.ts)'))
story.append(B('<b>Baza:</b> PGlite (embedded PostgreSQL) za testiranje, Neon za staging'))
story.append(B('<b>Browser:</b> Chromium (Playwright), Chrome 120+, Firefox 121+, Safari 17+'))
story.append(B('<b>FURS certifikat:</b> Test certifikat (pridobljen prek ToZS portala, FURS_ENV=test)'))
story.append(B('<b>Stripe keys:</b> Test keys (sk_test_..., pk_test_...) iz Stripe dashboard'))
story.append(H2('1.2 Setup pred testiranjem'))
story.append(CODE('''# 1. Zaženi aplikacijo lokalno
bun run dev

# 2. Seed test podatke
curl -X POST http://localhost:3000/api/seed -H "Authorization: Bearer <admin-token>"

# 3. Zaženi Playwright
bunx playwright test --project=chromium

# 4. Za Stripe local testing (v drugem terminalu)
stripe listen --forward-to localhost:3000/api/payment-gateways/webhook

# 5. Za FURS test certifikat
# Upload prek Admin UI → Settings → FURS → Upload .p12'''))
story.append(H2('1.3 Legenda statusov'))
story.append(TBL([
    ['Status', 'Pomen', 'Barva', 'Akcija'],
    ['☐ Načrtovano', 'Test še ni izveden', 'Siva', 'Izvedi test'],
    ['✅ Pass', 'Test uspešen', 'Zelena', 'Označi kot done'],
    ['❌ Fail', 'Test neuspešen', 'Rdeča', 'Prijavi bug, dodeli developerju'],
    ['⚠ Blocked', 'Test blokiran (odvisnost)', 'Oranžna', 'Razreši blokado'],
], [100, 180, 60, CONTENT_W-340]))
story.append(C('Tabela 1.1: Legenda statusov testov'))
story.append(PageBreak())

# 2. FURS TEST SCENARIJI
story.append(H1('2. FURS testni scenariji (10)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Testni scenariji za P0-1 FURS produkcijska certifikacija. Pokrivajo upload certifikata, validacijo, ZOI generacijo in FURS API klice.'))

for tc in test_case('FURS-01', 'Upload veljavnega .p12 certifikata', 'P0-Kritično',
    'Admin prijavljen; FURS modul aktiven; test certifikat (.p12) pripravljen',
    '1. Odpri Admin → Settings → FURS\n2. Klikni "Upload certifikat"\n3. Izberi .p12 datoteko (test cert)\n4. Vnesi geslo certifikata\n5. Izberi okolje: "test"\n6. Klikni "Naloži"',
    'Certifikat uspešno naložen; prikazana so polja: okolje=test, veljaven do=<datum>, izdajatelj=FURS CA; Location.fursCertPath posodobljen v DB'):
    story.append(tc)

for tc in test_case('FURS-02', 'Upload z napačnim geslom', 'P0-Kritično',
    'Admin prijavljen; .p12 certifikat pripravljen',
    '1. Odpri Admin → Settings → FURS\n2. Upload .p12 datoteko\n3. Vnesi NAPAČNO geslo\n4. Klikni "Naloži"',
    'Napaka 400: "Neveljavno geslo ali poškodovan certifikat"; certifikat NI shranjen; nobena sprememba v DB'):
    story.append(tc)

for tc in test_case('FURS-03', 'Upload prevelike datoteke (>100KB)', 'P0-Visoko',
    'Admin prijavljen',
    '1. Pripravi .p12 datoteko >100KB (lahko dummy)\n2. Odpri Admin → Settings → FURS\n3. Poskusi upload',
    'Napaka 413: "Certifikat prevelik (max 100KB)"; upload zavrnjen'):
    story.append(tc)

for tc in test_case('FURS-04', 'Upload napačnega tipa datoteke (.pdf)', 'P0-Visoko',
    'Admin prijavljen',
    '1. Pripravi .pdf datoteko\n2. Odpri Admin → Settings → FURS\n3. Poskusi upload .pdf',
    'Napaka 400: "Datoteka mora biti .p12 ali .pfx"; upload zavrnjen'):
    story.append(tc)

for tc in test_case('FURS-05', 'Preveri cert-status API po uploadu', 'P0-Visoko',
    'Admin prijavljen; certifikat uspešno uploadan (FURS-01)',
    '1. GET /api/furs/cert-status\n2. Preveri response',
    '200 OK z: { valid: true, validUntil: <datum>, issuer: "FURS CA", environment: "test" }'):
    story.append(tc)

for tc in test_case('FURS-06', 'ZOI generacija za račun', 'P0-Kritično',
    'Admin prijavljen; FURS cert uploadan; meni z artikli seedan',
    '1. Ustvari novo naročilo (POST /api/orders)\n2. Dodaj artikel\n3. Zaključi naročilo\n4. Preveri ZOI v DB (Order.fursZoi)',
    'ZOI je 32-znakovni MD5 hash; format: 32 znakov [a-f0-9]; ustreza formulu md5(taxNumber+issueDateTime+invoiceNumber+businessPremiseId+electronicDeviceId+invoiceAmount)'):
    story.append(tc)

for tc in test_case('FURS-07', 'FURS verify invoice - test okolje', 'P0-Kritično',
    'Admin prijavljen; FURS test cert aktiven; naročilo z ZOI pripravljeno',
    '1. POST /api/furs z orderId\n2. Preveri response\n3. Preveri Order.fursEor v DB',
    '200 OK z EOR (Enkratna Oznaka Računa); EOR format: UUID; Order.fursEor shranjen; Order.fursVerifiedAt nastavljen'):
    story.append(tc)

for tc in test_case('FURS-08', 'FURS offline mode (brez interneta)', 'P0-Visoko',
    'Admin prijavljen; FURS cert aktiven; aplikacija deluje',
    '1. Onemogoči internet (DevTools → Network → Offline)\n2. Ustvari naročilo\n3. Poskusi FURS verify\n4. Povravi internet\n5. Preveri offline-furs queue',
    'FURS zahtevek shranjen v offline-furs queue; prikaže se toast "FURS bo potrjen ko bo povezava"; po povrnitvi povezave se zahtevek samodejno pošlje; EOR prejet z zamikom'):
    story.append(tc)

for tc in test_case('FURS-09', 'FURS storno račun', 'P0-Visoko',
    'Admin prijavljen; obstaja potrjen račun z EOR',
    '1. Odpri obstoječi račun\n2. Klikni "Storno"\n3. Vnesi razlog storna\n4. Potrdi\n5. Preveri FURS response',
    'Storno račun uspešno potrjen pri FURS; nov EOR za storno; originalni račun označen kot storniran; audit log posodobljen'):
    story.append(tc)

for tc in test_case('FURS-10', 'Produkcijski preklop (FURS_ENV=production)', 'P0-Kritično',
    'Admin prijavljen; test cert validiran (FURS-07); produkcijski cert pripravljen',
    '1. Upload produkcijski .p12 cert (prek Admin UI)\n2. Izberi okolje: "production"\n3. Spremeni FURS_ENV=production v .env\n4. Restart aplikacije\n5. Izdaj testni račun (1 EUR)\n6. Preveri FURS response',
    'Produkcijski FURS zahtevek uspešen; EOR prejet iz produkcije; račun viden v FURS eDavki portal stranke'):
    story.append(tc)

story.append(PageBreak())

# 3. STRIPE TEST SCENARIJI
story.append(H1('3. Stripe testni scenariji (12)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Testni scenariji za P0-2 Stripe plačilni gateway. Pokrivajo PaymentIntent creation, kartična plačila, webhook events in refund flow.'))

for tc in test_case('STR-01', 'Ustvari PaymentIntent', 'P0-Kritično',
    'Natakar prijavljen; Stripe test keys konfigurirani; naročilo ustvarjeno',
    '1. POST /api/payments/stripe-intent\n2. Body: { amount: 4990, currency: "eur", orderId: "<id>" }\n3. Preveri response',
    '200 OK z: { clientSecret: "pi_..._secret_...", paymentIntentId: "pi_...", status: "requires_payment_method" }; Payment zapis ustvarjen v DB z status="pending"'):
    story.append(tc)

for tc in test_case('STR-02', 'Uspešno plačilo s test kartico 4242', 'P0-Kritično',
    'Natakar prijavljen; PaymentIntent ustvarjen (STR-01); StripeCardInput renderan',
    '1. Odpri plačilni modal v POS\n2. Vnesi kartico: 4242 4242 4242 4242\n3. CVC: 123, datum: 12/30\n4. Klikni "Plačaj"\n5. Počakaj na potrditev',
    'Plačilo uspešno; onSuccess callback klican; Payment.status="completed" v DB; order status posodobljen na "paid"; toast "Plačilo uspešno"'):
    story.append(tc)

for tc in test_case('STR-03', 'Padec plačila - insufficient_funds', 'P0-Kritično',
    'Natakar prijavljen; PaymentIntent ustvarjen',
    '1. Odpri plačilni modal\n2. Vnesi kartico: 4000 0000 0000 9995\n3. CVC: 123, datum: 12/30\n4. Klikni "Plačaj"',
    'Plačilo neuspešno; onError callback klican; error message: "Your card has insufficient funds"; Payment.status="failed"; toast z napako prikazan'):
    story.append(tc)

for tc in test_case('STR-04', 'Padec plačila - expired card', 'P0-Visoko',
    'Natakar prijavljen; PaymentIntent ustvarjen',
    '1. Odpri plačilni modal\n2. Vnesi kartico: 4000 0000 0000 0069\n3. CVC: 123, datum: 12/30\n4. Klikni "Plačaj"',
    'Plačilo neuspešno; error: "Your card has expired"; Payment.status="failed"'):
    story.append(tc)

for tc in test_case('STR-05', 'Padec plačila - incorrect CVC', 'P0-Visoko',
    'Natakar prijavljen; PaymentIntent ustvarjen',
    '1. Odpri plačilni modal\n2. Vnesi kartico: 4000 0000 0000 0119\n3. CVC: 123, datum: 12/30\n4. Klikni "Plačaj"',
    'Plačilo neuspešno; error: "Your card\'s security code is incorrect"; Payment.status="failed"'):
    story.append(tc)

for tc in test_case('STR-06', '3-D Secure (SCA) required', 'P0-Visoko',
    'Natakar prijavljen; PaymentIntent ustvarjen',
    '1. Odpri plačilni modal\n2. Vnesi kartico: 4000 0027 6000 3184\n3. CVC: 123, datum: 12/30\n4. Klikni "Plačaj"\n5. Na Stripe popup klikni "Complete authentication"',
    '3DS challenge prikazan; po uspešni avtentikaciji plačilo uspešno; Payment.status="completed"'):
    story.append(tc)

for tc in test_case('STR-07', 'Webhook: payment_intent.succeeded', 'P0-Kritično',
    'Stripe CLI listening; uspešno plačilo izvedeno (STR-02)',
    '1. Preveri Stripe CLI output v terminalu\n2. Preveri DB Payment.status\n3. Preveri Sentry logs',
    'Webhook prejet s statusom 200; Payment.status posodobljen na "completed"; log v Sentry: "Payment succeeded: pi_..."'):
    story.append(tc)

for tc in test_case('STR-08', 'Webhook: payment_intent.payment_failed', 'P0-Kritično',
    'Stripe CLI listening; neuspešno plačilo izvedeno (STR-03)',
    '1. Preveri Stripe CLI output\n2. Preveri DB Payment.status\n3. Preveri Sentry logs',
    'Webhook prejet s statusom 200; Payment.status posodobljen na "failed"; log v Sentry: "Payment failed: pi_..."'):
    story.append(tc)

for tc in test_case('STR-09', 'Webhook: charge.refunded', 'P0-Visoko',
    'Stripe CLI listening; uspešno plačilo izvedeno (STR-02)',
    '1. Odpri Stripe dashboard → Payment → Refund\n2. Izvedi polni refund\n3. Preveri DB Payment.status',
    'Webhook charge.refunded prejet; Payment.status posodobljen na "refunded"; refund amount zapisan v DB'):
    story.append(tc)

for tc in test_case('STR-10', 'Stripe health check', 'P0-Visoko',
    'Admin prijavljen; STRIPE_SECRET_KEY nastavljen',
    '1. GET /api/payment-gateways?health=1\n2. Preveri response',
    '200 OK z: { gateways: [{ type: "stripe", healthy: true, ... }] }; Stripe gateway označen kot healthy'):
    story.append(tc)

for tc in test_case('STR-11', 'Delni refund', 'P1-Visoko',
    'Admin prijavljen; uspešno plačilo 49.90 EUR',
    '1. Odpri Stripe dashboard → Payment\n2. Izvedi delni refund (20 EUR)\n3. Preveri DB',
    'Webhook charge.refunded prejet; refund amount=20.00; Payment.status ostane "completed" z refundAmount=20.00'):
    story.append(tc)

for tc in test_case('STR-12', 'PCI compliance - kartica ne gre na naš server', 'P0-Kritično',
    'Natakar prijavljen; Chrome DevTools odprt',
    '1. Odpri plačilni modal\n2. Odpri Network tab v DevTools\n3. Vnesi kartico 4242...\n4. Klikni "Plačaj"\n5. Preveri vse outbound requeste',
    'Nobena request na naš server ne vsebuje številke kartice; kartica gre direktno na api.stripe.com; samo PaymentIntent ID se pošlje na naš server'):
    story.append(tc)

story.append(PageBreak())

# 4. PWA TEST SCENARIJI
story.append(H1('4. PWA testni scenariji (10)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Testni scenariji za P0-3 PWA aplikacija. Pokrivajo push notifications, install prompt, offline mode in app icons.'))

for tc in test_case('PWA-01', 'Service Worker registracija', 'P0-Kritično',
    'Aplikacija odprta v Chrome',
    '1. Odpri http://localhost:3000\n2. Odpri DevTools → Application → Service Workers\n3. Preveri SW status',
    'Service Worker "sw.js" registriran in aktiven; status: "activated and is running"; verzija: v10'):
    story.append(tc)

for tc in test_case('PWA-02', 'Push subscription', 'P0-Kritično',
    'Natakar prijavljen; SW aktiven (PWA-01); VAPID ključi konfigurirani',
    '1. Odpri profil → Notifications\n2. Klikni "Vklopi obvestila"\n3. Browser prompt: dovoli\n4. Preveri DB PushSubscription tabelo',
    'Permission = "granted"; PushSubscription ustvarjen; zapis v PushSubscription tabeli z endpoint in keys'):
    story.append(tc)

for tc in test_case('PWA-03', 'Push notification - prejmi', 'P0-Kritično',
    'Natakar subscriben (PWA-02); admin prijavljen',
    '1. Admin: POST /api/push/send z { employeeId: "<id>", title: "Novo naročilo", body: "Miza 5" }\n2. Preveri browser natakarja',
    'Notification prikazan v browserju; title="Novo naročilo"; body="Miza 5"; icon=/icons/icon-192.png; klik odpre aplikacijo'):
    story.append(tc)

for tc in test_case('PWA-04', 'Push notification - klik', 'P0-Visoko',
    'Push notification prikazan (PWA-03)',
    '1. Klikni na notification\n2. Preveri, ali se aplikacija odpre/focusa',
    'Aplikacija se odpre (ali focusa, če je odprta); preusmeritev na URL iz notification.data.url (ali "/")'):
    story.append(tc)

for tc in test_case('PWA-05', 'Permission denied', 'P0-Visoko',
    'Natakar prijavljen; SW aktiven',
    '1. Odpri profil → Notifications\n2. Klikni "Vklopi obvestila"\n3. Browser prompt: ZAVRNI\n4. Preveri UI',
    'Permission = "denied"; gumb onemogočen; prikazano sporočilo "Obvestila so onemogočena"; noben PushSubscription v DB'):
    story.append(tc)

for tc in test_case('PWA-06', 'Install prompt - prikaz po 3 obiskih', 'P0-Visoko',
    'Nov uporabnik; aplikacija še ni instalirana; localStorage visits < 3',
    '1. Obišči aplikacijo 1x (reload) - ni prompt\n2. Obišči 2x - ni prompt\n3. Obišči 3x - prompt se prikaže',
    'InstallPrompt se prikaže po 3. obisku; gumb "Namesti" aktiven; gumb "X" (zapri) deluje; localStorage.visits = 3'):
    story.append(tc)

for tc in test_case('PWA-07', 'Install - dodaj na home screen', 'P0-Visoko',
    'InstallPrompt prikazan (PWA-06)',
    '1. Klikni "Namesti" v InstallPrompt\n2. Browser prompt: Namesti\n3. Preveri, ali je app instalirana',
    'Aplikacija instalirana na napravi; ikona prikazana na home screen; odpiranje ikone odpre app v standalone mode (brez browser UI)'):
    story.append(tc)

for tc in test_case('PWA-08', 'App ikone prikazane pravilno', 'P0-Visoko',
    'Aplikacija odprta; DevTools → Application → Manifest',
    '1. Odpri DevTools → Application → Manifest\n2. Preveri "Icons" sekcijo\n3. Preveri "Display" field',
    '8 ikon prikazanih (72, 96, 128, 144, 152, 192, 384, 512); maskable variants za 192 in 512; display="standalone"; theme_color in background_color pravilni'):
    story.append(tc)

for tc in test_case('PWA-09', 'Offline mode - naročilo brez interneta', 'P0-Kritično',
    'Natakar prijavljen; SW aktiven; meni seedan',
    '1. Odpri DevTools → Network → Offline\n2. Ustvari novo naročilo\n3. Dodaj artikle\n4. Zaključi naročilo\n5. Preveri UI in IndexedDB',
    'Naročilo shranjeno v IndexedDB (offline-orders queue); toast "Naročilo bo sinhronizirano"; naročilo NI takoj v DB; offline.html fallback deluje'):
    story.append(tc)

for tc in test_case('PWA-10', 'Offline - sinhronizacija po povrnitvi povezave', 'P0-Kritično',
    'Offline naročilo ustvarjeno (PWA-09)',
    '1. Povravi internet (DevTools → Network → Online)\n2. Počakaj 5 sekund\n3. Preveri DB Order tabelo',
    'Naročilo samodejno sinhronizirano; Order zapis v DB z ustreznim timestamp; toast "Naročilo sinhronizirano"; offline queue prazna'):
    story.append(tc)

story.append(PageBreak())

# 5. INTEGRATION SCENARIJI
story.append(H1('5. Integracijski testni scenariji (8)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Integracijski testni scenariji preverjajo delovanje več komponent skupaj - tipične dnevne workflowe natakarja in managerja.'))

for tc in test_case('INT-01', 'Celoten POS flow: Order → Payment → FURS → Receipt', 'P0-Kritično',
    'Admin prijavljen; FURS cert aktiven; Stripe konfiguriran; meni seedan',
    '1. Odpri POS\n2. Izberi mizo\n3. Dodaj 2 artikla (npr. Pizza + Pivo)\n4. Zaključi naročilo\n5. Klikni "Plačaj"\n6. Vnesi kartico 4242...\n7. Potrdi plačilo\n8. Preveri FURS potrjevanje\n9. Preveri tiskanje računa',
    'Plačilo uspešno; FURS EOR prejet; ZOI generiran; račun natisnjen z QR kodo; Payment.status="completed"; Order.status="paid"; vse v DB sinhrono'):
    story.append(tc)

for tc in test_case('INT-02', 'Offline naročilo + kasnejša sinhronizacija + FURS', 'P0-Kritično',
    'Natakar prijavljen; SW aktiven; FURS cert aktiven',
    '1. Onemogoči internet\n2. Ustvari 3 naročila (offline)\n3. Plačaj z gotovino (offline)\n4. Povravi internet\n5. Preveri sinhronizacijo\n6. Preveri FURS potrjevanje',
    '3 naročila sinhronizirana; 3 FURS zahtevki poslani (z zamikom); 3 EOR prejeti; nobeno naročilo izgubljeno; FURS dovoli 48h zamik'):
    story.append(tc)

for tc in test_case('INT-03', 'Multi-tenant: 2 lokaciji z ločenima FURS certifikatoma', 'P0-Kritično',
    'Super-admin prijavljen (PIN 5555); 2 lokaciji s svojima certifikatoma',
    '1. Preklopi na lokacijo A\n2. Izdaj račun\n3. Preveri FURS response (premisesId A)\n4. Preklopi na lokacijo B\n5. Izdaj račun\n6. Preveri FURS response (premisesId B)',
    'Lokacija A uporablja svoj certifikat in premisesId; Lokacija B uporablja svoj; noben križni dostop; audit log beleži pravilno lokacijo'):
    story.append(tc)

for tc in test_case('INT-04', 'Stripe plačilo + refund + FURS storno', 'P0-Visoko',
    'Admin prijavljen; uspešno plačilo (STR-02); FURS potrjen',
    '1. Odpri račun v admin\n2. Klikni "Refund" (polni)\n3. Klikni "Storno" (FURS)\n4. Preveri DB in Stripe dashboard',
    'Stripe refund izveden; Payment.status="refunded"; FURS storno račun potrjen; nov EOR za storno; originalni račun označen kot storniran'):
    story.append(tc)

for tc in test_case('INT-05', 'Push notification ob novem naročilu', 'P1-Visoko',
    'Natakar subscriben (PWA-02); admin prijavljen',
    '1. Admin: ustvari novo naročilo za natakarja\n2. Dodeli natakarju\n3. Preveri notification',
    'Push notification poslan natakarju; notification vsebuje: title="Novo naročilo", body="Miza X", data={url="/orders/..."}; klik odpre naročilo'):
    story.append(tc)

for tc in test_case('INT-06', 'Rate limiting - prepreči zlorabo FURS API-ja', 'P0-Visoko',
    'Admin prijavljen',
    '1. Pošlji 100 FURS zahtevkov v 1 minuti (script)\n2. Preveri response po 60. zahtevku',
    'Po 60 zahtevkih: 429 Too Many Requests; header "Retry-After" nastavljen; noben dodaten FURS zahtevek obdelan'):
    story.append(tc)

for tc in test_case('INT-07', 'Audit log - sledljivost FURS in Stripe operacij', 'P0-Visoko',
    'Admin prijavljen; izvedeni FURS in Stripe operaciji',
    '1. GET /api/audit-log?type=furs\n2. Preveri zadnje vnose\n3. GET /api/audit-log?type=payment\n4. Preveri zadnje vnose',
    'Audit log vsebuje: timestamp, employeeId, action (furs.verify/storno, payment.create/refund), entityId, ipAddress; chain hash veljaven (SHA-256); nepopravljiv'):
    story.append(tc)

for tc in test_case('INT-08', 'Sentry error tracking - simuliraj napako', 'P0-Visoko',
    'Admin prijavljen; Sentry konfiguriran',
    '1. Sproži napako (npr. neveljaven API klic)\n2. Preveri Sentry dashboard',
    'Napaka prikazana v Sentry z: stack trace, user context, request context, breadcrumbs; SENTRY_DSN pravilno konfiguriran; release tag nastavljen'):
    story.append(tc)

story.append(PageBreak())

# 6. TEST EXECUTION MATRIX
story.append(H1('6. Matrika izvedbe testov'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Povzetek vseh 40 testnih scenarijev z trenutnim statusom. QA inženir naj posodablja status po vsakem izvedenem testu.'))
story.append(SP(6))

matrix_data = [
    ['ID', 'Test', 'Prioriteta', 'Kategorija', 'Status'],
]
# Generate from test cases
test_cases_summary = [
    ('FURS-01', 'Upload veljavnega .p12 certifikata', 'P0', 'FURS'),
    ('FURS-02', 'Upload z napačnim geslom', 'P0', 'FURS'),
    ('FURS-03', 'Upload prevelike datoteke', 'P1', 'FURS'),
    ('FURS-04', 'Upload napačnega tipa', 'P1', 'FURS'),
    ('FURS-05', 'Cert-status API', 'P1', 'FURS'),
    ('FURS-06', 'ZOI generacija', 'P0', 'FURS'),
    ('FURS-07', 'FURS verify invoice (test)', 'P0', 'FURS'),
    ('FURS-08', 'FURS offline mode', 'P1', 'FURS'),
    ('FURS-09', 'FURS storno račun', 'P1', 'FURS'),
    ('FURS-10', 'Produkcijski preklop', 'P0', 'FURS'),
    ('STR-01', 'Ustvari PaymentIntent', 'P0', 'Stripe'),
    ('STR-02', 'Uspešno plačilo (4242)', 'P0', 'Stripe'),
    ('STR-03', 'Padec - insufficient_funds', 'P0', 'Stripe'),
    ('STR-04', 'Padec - expired card', 'P1', 'Stripe'),
    ('STR-05', 'Padec - incorrect CVC', 'P1', 'Stripe'),
    ('STR-06', '3-D Secure (SCA)', 'P1', 'Stripe'),
    ('STR-07', 'Webhook: succeeded', 'P0', 'Stripe'),
    ('STR-08', 'Webhook: failed', 'P0', 'Stripe'),
    ('STR-09', 'Webhook: refunded', 'P1', 'Stripe'),
    ('STR-10', 'Stripe health check', 'P1', 'Stripe'),
    ('STR-11', 'Delni refund', 'P1', 'Stripe'),
    ('STR-12', 'PCI compliance', 'P0', 'Stripe'),
    ('PWA-01', 'SW registracija', 'P0', 'PWA'),
    ('PWA-02', 'Push subscription', 'P0', 'PWA'),
    ('PWA-03', 'Push notification - prejmi', 'P0', 'PWA'),
    ('PWA-04', 'Push notification - klik', 'P1', 'PWA'),
    ('PWA-05', 'Permission denied', 'P1', 'PWA'),
    ('PWA-06', 'Install prompt po 3 obiskih', 'P1', 'PWA'),
    ('PWA-07', 'Install - home screen', 'P1', 'PWA'),
    ('PWA-08', 'App ikone', 'P1', 'PWA'),
    ('PWA-09', 'Offline naročilo', 'P0', 'PWA'),
    ('PWA-10', 'Offline sinhronizacija', 'P0', 'PWA'),
    ('INT-01', 'Celoten POS flow', 'P0', 'Integracijski'),
    ('INT-02', 'Offline + sinhronizacija + FURS', 'P0', 'Integracijski'),
    ('INT-03', 'Multi-tenant FURS', 'P0', 'Integracijski'),
    ('INT-04', 'Stripe refund + FURS storno', 'P1', 'Integracijski'),
    ('INT-05', 'Push ob novem naročilu', 'P1', 'Integracijski'),
    ('INT-06', 'Rate limiting', 'P1', 'Integracijski'),
    ('INT-07', 'Audit log sledljivost', 'P1', 'Integracijski'),
    ('INT-08', 'Sentry error tracking', 'P1', 'Integracijski'),
]

for tc_id, title, prio, cat in test_cases_summary:
    matrix_data.append([tc_id, title, prio, cat, '☐'])

story.append(TBL(matrix_data, [50, CONTENT_W-220, 50, 70, 50]))
story.append(C('Tabela 6.1: Matrika izvedbe testov (40 testov)'))

story.append(SP(8))
story.append(H2('6.1 Povzetek po kategorijah'))
summary_data = [
    ['Kategorija', 'Št. testov', 'P0 (kritično)', 'P1 (visoko)', 'Status'],
    ['FURS', '10', '6', '4', '☐ Načrtovano'],
    ['Stripe', '12', '6', '6', '☐ Načrtovano'],
    ['PWA', '10', '5', '5', '☐ Načrtovano'],
    ['Integracijski', '8', '4', '4', '☐ Načrtovano'],
    ['SKUPNO', '40', '21', '19', '☐ Načrtovano'],
]
story.append(TBL(summary_data, [100, 80, 90, 90, CONTENT_W-360]))
story.append(C('Tabela 6.2: Povzetek testov po kategorijah'))

story.append(CALLOUT('DEFINITION OF DONE','P0 je zaključen, ko so VSI P0-kritični testi (21) označeni kot ✅ Pass. P1-visoki testi (19) so priporočeni, a ne blokirajojo deploy. Po zaključku testiranja QA pošlje povzetek Tech Lead-u za končno odobritev deploy-a.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - P0 E2E Test Scenarios', author='Z.ai', subject='E2E testni scenariji za P0', creator='Z.ai')
doc.multiBuild(story)
print(f'E2E body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
