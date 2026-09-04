#!/usr/bin/env python3
"""RestaurantOS API Documentation - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/api_body.pdf'

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
tcc_style=ParagraphStyle('TCC',fontName='NotoSerifSC',fontSize=8.5,leading=11,textColor=TEXT_PRIMARY,alignment=TA_CENTER,wordWrap='CJK')
toc1=ParagraphStyle('T1',fontName='NotoSerifSC-Bold',fontSize=11,leading=18,textColor=TEXT_PRIMARY,spaceBefore=4)
toc2=ParagraphStyle('T2',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=TEXT_PRIMARY,leftIndent=18,spaceBefore=2)
stat_n=ParagraphStyle('SN',fontName='NotoSerifSC-Bold',fontSize=22,leading=26,textColor=ACCENT,alignment=TA_CENTER)
stat_l=ParagraphStyle('SL',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER)
code_style=ParagraphStyle('Code',fontName='SarasaMonoSC',fontSize=8,leading=10.5,textColor=TEXT_PRIMARY,backColor=CODE_BG,borderColor=BORDER,borderWidth=0.5,borderPadding=8,spaceBefore=4,spaceAfter=10)

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
def STATS(stats):
    rn=[Paragraph(n,stat_n) for n,_ in stats]; rl=[Paragraph(l,stat_l) for _,l in stats]
    data=[rn,rl]; n=len(stats); cw=CONTENT_W/n
    t=Table(data,colWidths=[cw]*n)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('BACKGROUND',(0,0),(-1,-1),CARD_BG),('LINEBELOW',(0,0),(-1,0),1.2,ACCENT)]))
    return t

def endpoint(method, path, summary, auth, request=None, response=None, errors=None, color=ACCENT):
    """Build an API endpoint documentation block."""
    method_color = {'GET': SEM_INFO, 'POST': SEM_SUCCESS, 'PUT': SEM_WARNING, 'DELETE': SEM_ERROR, 'PATCH': SEM_WARNING}.get(method, ACCENT)
    header_data = [
        [Paragraph(f'<b>{method}</b>', ParagraphStyle('m', fontName='SarasaMonoSC', fontSize=10, textColor=colors.white, alignment=TA_CENTER, backColor=method_color)),
         Paragraph(f'<b>{path}</b>', ParagraphStyle('p', fontName='SarasaMonoSC', fontSize=10, textColor=TEXT_PRIMARY, alignment=TA_LEFT)),
         Paragraph(f'<b>{auth}</b>', ParagraphStyle('a', fontName='NotoSerifSC', fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER))],
        [Paragraph(f'<i>{summary}</i>', ParagraphStyle('s', fontName='NotoSerifSC', fontSize=9, textColor=TEXT_MUTED, alignment=TA_LEFT)), '', ''],
    ]
    t = Table(header_data, colWidths=[50, CONTENT_W-180, 130])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (0,0), method_color),
        ('BACKGROUND', (1,0), (-1,0), CARD_BG),
        ('BACKGROUND', (0,1), (-1,1), TABLE_STRIPE),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('SPAN', (0,1), (-1,1)),
    ]))
    return t

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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · API Dokumentacija · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building API documentation...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod v API'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS API je RESTful API zgrajen na Next.js API Routes. Vsebuje <b>229 endpointov</b> v 102 kategorijah, ki pokrivajo celotno funkcionalnost sistema: avtentikacijo, naročila, plačila, FURS, zaloge, računovodstvo in več. Ta dokumentacija vsebuje ključnih 60+ endpointov, ki so dovolj za večino integracij.'))
story.append(SP(6))
story.append(STATS([
    ('229', 'API endpointov'),
    ('102', 'kategorij'),
    ('60+', 'dokumentiranih'),
    ('5', 'HTTP metod'),
]))
story.append(SP(12))
story.append(H2('1.1 Base URL'))
story.append(CODE('''# Produkcija
https://restaurantos.app/api

# Staging
https://restaurantos-staging.vercel.app/api

# Lokalno (razvoj)
http://localhost:3000/api'''))
story.append(H2('1.2 Splošne konvencije'))
story.append(B('<b>Format:</b> JSON (Content-Type: application/json)'))
story.append(B('<b>Avtentikacija:</b> Bearer token v Authorization header-ju'))
story.append(B('<b>Encoding:</b> UTF-8'))
story.append(B('<b>Časovni format:</b> ISO 8601 (2025-09-04T10:30:00Z)'))
story.append(B('<b>Valuta:</b> EUR (centi za plačila: 4990 = 49.90 EUR)'))
story.append(B('<b>ID format:</b> CUID (clxyz123abc...)'))
story.append(B('<b>Paginacija:</b> ?limit=20&offset=0 (default limit=20, max=100)'))
story.append(B('<b>Rate limiting:</b> 60 req/min (authenticated), 20 req/min (public)'))
story.append(H2('1.3 HTTP status codes'))
story.append(TBL([
    ['Code', 'Status', 'Pomen'],
    ['200', 'OK', 'Uspešna zahteva (GET, PUT, PATCH)'],
    ['201', 'Created', 'Resource uspešno ustvarjen (POST)'],
    ['204', 'No Content', 'Uspešno izbrisano (DELETE)'],
    ['400', 'Bad Request', 'Neveljavni parametri ali body'],
    ['401', 'Unauthorized', 'Manjka ali neveljaven token'],
    ['403', 'Forbidden', 'Ni dovoljenja za to akcijo'],
    ['404', 'Not Found', 'Resource ne obstaja'],
    ['409', 'Conflict', 'Optimistic lock conflict (updatedAt)'],
    ['413', 'Payload Too Large', 'Body prevelik (max 512KB)'],
    ['429', 'Too Many Requests', 'Rate limit presežen'],
    ['500', 'Internal Server Error', 'Napaka na serverju (Sentry alert)'],
    ['503', 'Service Unavailable', 'FURS/Stripe nedosegljiv'],
], [60, 180, CONTENT_W-240]))
story.append(C('Tabela 1.1: HTTP status codes'))
story.append(PageBreak())

# 2. AVTENTIKACIJA
story.append(H1('2. Avtentikacija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS uporablja PIN-based auth z Bearer token. Po uspešni prijavi se generira JWT token, ki velja 8 ur. Token se pošilja v Authorization header-ju za vse zaščitene endpointe.'))
story.append(H2('2.1 Prijava (PIN)'))
story.append(endpoint('POST', '/api/auth', 'Prijava uporabnika z employee ID in PIN', 'Public'))
story.append(H3('Request body'))
story.append(CODE('''{
  "employeeId": "test-admin",
  "pin": "1234"
}'''))
story.append(H3('Response 200 OK'))
story.append(CODE('''{
  "success": true,
  "employee": {
    "id": "clxyz123abc",
    "name": "Janez Novak",
    "role": "admin",
    "locationId": "clabc456def"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-09-04T18:30:00Z"
}'''))
story.append(H3('Response 401 Unauthorized'))
story.append(CODE('''{
  "error": "Neveljaven PIN",
  "code": "INVALID_PIN"
}'''))
story.append(H2('2.2 Uporaba tokena'))
story.append(CODE('''# Vsi zaščiteni endpointi zahtevajo Authorization header:
curl -H "Authorization: Bearer eyJhbGciOi..." \\
     -H "Content-Type: application/json" \\
     https://restaurantos.app/api/orders'''))
story.append(H2('2.3 Permission levels'))
story.append(TBL([
    ['Vloga', 'PIN', 'Dovoljenja', 'Primer endpointa'],
    ['Natakar', '0000', 'take_orders, process_payments', 'POST /api/orders'],
    ['Kuhar', '2222', 'view_orders, update_status', 'PUT /api/orders/[id]/status'],
    ['Manager', '3333', 'view_reports, manage_staff', 'GET /api/reports/daily'],
    ['Admin', '1234', 'all + configuration', 'PUT /api/settings'],
    ['Super-admin', '5555', 'all + cross-branch', 'GET /api/audit-log?locationId=all'],
], [80, 60, 200, CONTENT_W-340]))
story.append(C('Tabela 2.1: Vloge in dovoljenja'))
story.append(PageBreak())

# 3. NAROČILA
story.append(H1('3. Naročila (Orders)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('API za upravljanje naročil - od ustvarjanja do plačila in FURS potrjevanja.'))
story.append(H2('3.1 Seznam naročil'))
story.append(endpoint('GET', '/api/orders?limit=20&offset=0&status=open', 'Pridobi seznam naročil', 'take_orders'))
story.append(H3('Query parametri'))
story.append(TBL([
    ['Parameter', 'Tip', 'Default', 'Opis'],
    ['limit', 'number', '20', 'Št. rezultatov (max 100)'],
    ['offset', 'number', '0', 'Offset za paginacijo'],
    ['status', 'string', '-', 'Filter: open, paid, cancelled, all'],
    ['locationId', 'string', '-', 'Filter po lokaciji (super-admin)'],
    ['tableId', 'string', '-', 'Filter po mizi'],
    ['dateFrom', 'string', '-', 'ISO datum (od)'],
    ['dateTo', 'string', '-', 'ISO datum (do)'],
], [100, 70, 60, CONTENT_W-230]))
story.append(H3('Response 200'))
story.append(CODE('''{
  "orders": [
    {
      "id": "clxyz123",
      "number": "2025-001",
      "tableId": "clabc",
      "tableNumber": 5,
      "status": "open",
      "total": 49.90,
      "items": [
        { "id": "clitem1", "name": "Pizza Margherita", "quantity": 1, "price": 12.00, "modifiers": [] },
        { "id": "clitem2", "name": "Pivo Laško", "quantity": 2, "price": 3.50, "modifiers": [] }
      ],
      "employeeId": "clemp1",
      "employeeName": "Janez",
      "locationId": "clloc1",
      "createdAt": "2025-09-04T10:30:00Z",
      "updatedAt": "2025-09-04T10:35:00Z"
    }
  ],
  "total": 145,
  "limit": 20,
  "offset": 0
}'''))
story.append(H2('3.2 Ustvari naročilo'))
story.append(endpoint('POST', '/api/orders', 'Ustvari novo naročilo', 'take_orders'))
story.append(H3('Request body'))
story.append(CODE('''{
  "tableId": "clabc456",
  "items": [
    {
      "menuItemId": "clitem123",
      "quantity": 2,
      "modifiers": ["clsizel", "cltopping1"],
      "notes": "Brez čebule"
    }
  ],
  "locationId": "clloc1",
  "type": "dine_in"
}'''))
story.append(H3('Response 201 Created'))
story.append(CODE('''{
  "id": "clxyz789",
  "number": "2025-002",
  "status": "open",
  "total": 25.00,
  "items": [...],
  "fursZoi": null,
  "fursEor": null,
  "createdAt": "2025-09-04T11:00:00Z"
}'''))
story.append(H2('3.3 Posodobi naročilo'))
story.append(endpoint('PUT', '/api/orders/[id]', 'Posodobi naročilo (optimistic lock)', 'take_orders'))
story.append(H3('Request body'))
story.append(CODE('''{
  "items": [...],
  "status": "open",
  "updatedAt": "2025-09-04T10:35:00Z"  // za optimistic lock
}'''))
story.append(H3('Response 409 Conflict (optimistic lock)'))
story.append(CODE('''{
  "error": "Naročilo je bilo posodobljeno s strani drugega uporabnika",
  "code": "OPTIMISTIC_LOCK_CONFLICT",
  "currentUpdatedAt": "2025-09-04T10:36:00Z",
  "yourUpdatedAt": "2025-09-04T10:35:00Z"
}'''))
story.append(H2('3.4 Pridobi posamezno naročilo'))
story.append(endpoint('GET', '/api/orders/[id]', 'Pridobi naročilo z vsemi podrobnostmi', 'take_orders'))
story.append(H2('3.5 Prenos mize'))
story.append(endpoint('POST', '/api/orders/[id]/transfer', 'Prenesi naročilo na drugo mizo', 'take_orders'))
story.append(H3('Request body'))
story.append(CODE('''{
  "newTableId": "cltable8"
}'''))
story.append(PageBreak())

# 4. PLAČILA
story.append(H1('4. Plačila (Payments)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('API za upravljanje plačil - gotovina, kartice (Stripe), darilne kartice.'))
story.append(H2('4.1 Ustvari plačilo (gotovina)'))
story.append(endpoint('POST', '/api/payments', 'Ustvari plačilo za naročilo', 'take_orders'))
story.append(H3('Request body (gotovina)'))
story.append(CODE('''{
  "orderId": "clxyz789",
  "method": "cash",
  "amount": 50.00,
  "receivedAmount": 50.00,
  "tip": 0.00
}'''))
story.append(H3('Response 201 Created'))
story.append(CODE('''{
  "id": "clpay123",
  "orderId": "clxyz789",
  "method": "cash",
  "amount": 50.00,
  "status": "completed",
  "change": 0.10,
  "receiptNumber": "2025-001",
  "fursZoi": "abc123def456...",
  "fursEor": "uuid-1234-5678",
  "createdAt": "2025-09-04T11:05:00Z"
}'''))
story.append(H2('4.2 Stripe PaymentIntent (kartica)'))
story.append(endpoint('POST', '/api/payments/stripe-intent', 'Ustvari Stripe PaymentIntent', 'take_orders'))
story.append(H3('Request body'))
story.append(CODE('''{
  "amount": 4990,
  "currency": "eur",
  "orderId": "clxyz789",
  "locationId": "clloc1",
  "metadata": {
    "tableNumber": "5",
    "waiterName": "Janez"
  }
}'''))
story.append(H3('Response 200'))
story.append(CODE('''{
  "clientSecret": "pi_3Pxyz..._secret_abc123...",
  "paymentIntentId": "pi_3Pxyz...",
  "amount": 4990,
  "currency": "eur",
  "status": "requires_payment_method"
}'''))
story.append(H2('4.3 Stripe webhook'))
story.append(endpoint('POST', '/api/payment-gateways/webhook', 'Stripe webhook (HMAC verified)', 'Stripe'))
story.append(P('Webhook prejema Stripe evente. Signature se preverja z HMAC-SHA256. Ni potrebna auth (Stripe signature je auth).'))
story.append(H3('Podprti eventi'))
story.append(TBL([
    ['Event', 'Akcija', 'DB update'],
    ['payment_intent.succeeded', 'Payment.status = "completed"', 'Order.status = "paid"'],
    ['payment_intent.payment_failed', 'Payment.status = "failed"', 'Order ostane "open"'],
    ['charge.refunded', 'Payment.status = "refunded"', 'Refund zapisan'],
], [200, 200, CONTENT_W-400]))
story.append(H2('4.4 Refund'))
story.append(endpoint('POST', '/api/payments/[id]/refund', 'Refund plačila (delni ali polni)', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "amount": 25.00,  // null za polni refund
  "reason": "customer_request"
}'''))
story.append(PageBreak())

# 5. FURS
story.append(H1('5. FURS (Davčno potrjevanje)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('API za FURS modul - davčno potrjevanje računov po ZDDV-1.'))
story.append(H2('5.1 FURS status'))
story.append(endpoint('GET', '/api/furs', 'Preveri FURS povezavo in konfiguracijo', 'admin'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "connected": true,
  "environment": "production",
  "configValid": true,
  "certificateLoaded": true,
  "certificateValidUntil": "2030-09-04",
  "lastSuccessfulVerify": "2025-09-04T11:05:00Z"
}'''))
story.append(H2('5.2 Cert status'))
story.append(endpoint('GET', '/api/furs/cert-status', 'Status certifikata (veljavnost, renewal)', 'admin'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "valid": true,
  "validUntil": "2030-09-04",
  "daysUntilExpiry": 1825,
  "issuer": "FURS CA",
  "environment": "production",
  "warningLevel": "none"
}'''))
story.append(H2('5.3 Upload certifikata (P0-1)'))
story.append(endpoint('POST', '/api/furs/cert-upload', 'Upload .p12 certifikata', 'admin'))
story.append(H3('Request (multipart/form-data)'))
story.append(CODE('''POST /api/furs/cert-upload
Content-Type: multipart/form-data

Form fields:
  cert: File (.p12, max 100KB)
  password: string
  locationId: string (optional)
  environment: "test" | "production"'''))
story.append(H3('Response 200'))
story.append(CODE('''{
  "success": true,
  "certPath": "./certs/furs-clloc1-production.p12",
  "environment": "production",
  "validUntil": "2030-09-04",
  "issuer": "FURS CA",
  "message": "Certifikat uspešno naložen"
}'''))
story.append(H2('5.4 Verify invoice'))
story.append(endpoint('POST', '/api/furs', 'Pošlji račun FURS-u za potrjevanje', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "orderId": "clxyz789",
  "invoiceNumber": "2025-001",
  "issueDateTime": "2025-09-04T11:05:00Z",
  "taxNumber": "SI12345678",
  "premisesId": "PE123",
  "electronicDeviceId": "BLAG1",
  "invoiceAmount": 49.90,
  "paymentAmount": 50.00,
  "taxes": [
    { "rate": 22, "base": 30.00, "tax": 6.60 },
    { "rate": 9.5, "base": 13.30, "tax": 1.26 }
  ]
}'''))
story.append(H3('Response 200'))
story.append(CODE('''{
  "success": true,
  "zoi": "abc123def456ghi789jkl012mno345...",  // 32-znakovni MD5
  "eor": "uuid-1234-5678-9012-345678901234",
  "fursTimestamp": "2025-09-04T11:05:01Z"
}'''))
story.append(PageBreak())

# 6. MENIJI IN ARTIKLI
story.append(H1('6. Meniji in artikli'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('API za upravljanje menijev, artiklov, kategorij in modifikatorjev.'))
story.append(H2('6.1 Seznam menijev'))
story.append(endpoint('GET', '/api/menus', 'Pridobi vse menije', 'view_reports'))
story.append(H2('6.2 Seznam artiklov'))
story.append(endpoint('GET', '/api/menu-items?categoryId=clcat1', 'Pridobi artikle (z filter)', 'take_orders'))
story.append(H3('Query parametri'))
story.append(TBL([
    ['Parameter', 'Tip', 'Opis'],
    ['categoryId', 'string', 'Filter po kategoriji'],
    ['search', 'string', 'Iskanje po imenu'],
    ['active', 'boolean', 'Samo aktivni artikli'],
    ['includeModifiers', 'boolean', 'Vključi modifikatorje'],
    ['locationId', 'string', 'Filter po lokaciji'],
], [120, 80, CONTENT_W-200]))
story.append(H3('Response 200 (skrajšano)'))
story.append(CODE('''{
  "items": [
    {
      "id": "clitem123",
      "name": "Pizza Margherita",
      "nameEn": "Margherita Pizza",
      "price": 12.00,
      "categoryId": "clcat1",
      "taxRate": 22,
      "allergens": ["gluten", "milk"],
      "imageUrl": "/images/pizza-margherita.jpg",
      "active": true,
      "modifiers": [
        { "id": "clmod1", "name": "Velikost", "options": ["S", "M", "L"] }
      ]
    }
  ],
  "total": 145
}'''))
story.append(H2('6.3 Ustvari artikel'))
story.append(endpoint('POST', '/api/menu-items', 'Ustvari nov artikel', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "name": "Pizza Margherita",
  "nameEn": "Margherita Pizza",
  "price": 12.00,
  "categoryId": "clcat1",
  "taxRate": 22,
  "allergens": ["gluten", "milk"],
  "description": "Klasična italijanska pizza",
  "preparationTime": 15,
  "active": true
}'''))
story.append(PageBreak())

# 7. MIZE IN SEKTORJI
story.append(H1('7. Mize in sektorji'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('7.1 Seznam miz'))
story.append(endpoint('GET', '/api/tables?locationId=clloc1', 'Pridobi vse mize', 'take_orders'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "tables": [
    {
      "id": "cltab1",
      "number": 5,
      "capacity": 4,
      "section": "Main Hall",
      "status": "occupied",
      "currentOrderId": "clxyz789",
      "locationId": "clloc1"
    }
  ]
}'''))
story.append(H2('7.2 QR batch generacija'))
story.append(endpoint('POST', '/api/tables/qr-batch', 'Generiraj QR kode za mize', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "tableIds": ["cltab1", "cltab2", "cltab3"],
  "format": "png"
}'''))
story.append(H2('7.3 Transfer mize'))
story.append(endpoint('POST', '/api/tables/transfer', 'Prenesi mizo na drugo lokacijo', 'admin'))
story.append(PageBreak())

# 8. DASHBOARD IN POROČILA
story.append(H1('8. Dashboard in poročila'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('8.1 Dashboard podatki'))
story.append(endpoint('GET', '/api/dashboard?date=2025-09-04', 'Pridovi dashboard metrike', 'view_reports'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "today": {
    "revenue": 1542.50,
    "orders": 47,
    "avgOrderValue": 32.82,
    "items": 156
  },
  "hourly": [
    { "hour": 9, "revenue": 125.50, "orders": 4 },
    { "hour": 10, "revenue": 234.00, "orders": 7 }
  ],
  "topItems": [
    { "id": "clitem123", "name": "Pizza Margherita", "quantity": 12, "revenue": 144.00 }
  ],
  "paymentMethods": {
    "cash": 542.50,
    "card": 1000.00
  }
}'''))
story.append(H2('8.2 Dnevno poročilo'))
story.append(endpoint('GET', '/api/reports/daily?date=2025-09-04', 'Dnevno poročilo prodaje', 'view_reports'))
story.append(H2('8.3 Poročilo po natakarjih'))
story.append(endpoint('GET', '/api/reports/employees?dateFrom=2025-09-01&dateTo=2025-09-04', 'Poročilo po natakarjih', 'view_reports'))
story.append(H2('8.4 Z-Report (zapiranje izmene)'))
story.append(endpoint('POST', '/api/cash-register/close', 'Zapri izmeno z Z-Report', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "locationId": "clloc1",
  "closingAmount": 542.50,
  "countedCash": 540.00,
  "notes": "Manjka 2.50 EUR"
}'''))
story.append(H3('Response 200'))
story.append(CODE('''{
  "zReportNumber": "Z-2025-001",
  "openingAmount": 200.00,
  "closingAmount": 542.50,
  "cashSales": 342.50,
  "cardSales": 1000.00,
  "totalSales": 1342.50,
  "discrepancy": -2.50,
  "closedAt": "2025-09-04T22:00:00Z"
}'''))
story.append(PageBreak())

# 9. ZALOGE
story.append(H1('9. Zaloge (Inventory)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('9.1 Seznam zaloga'))
story.append(endpoint('GET', '/api/inventory?locationId=clloc1', 'Pridobi stanje zalog', 'view_reports'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "items": [
    {
      "id": "clinv1",
      "name": "Paradižnik",
      "quantity": 25.5,
      "unit": "kg",
      "minQuantity": 5.0,
      "cost": 2.50,
      "locationId": "clloc1",
      "supplier": "clsup1"
    }
  ]
}'''))
story.append(H2('9.2 Restock (dopolnitev)'))
story.append(endpoint('POST', '/api/inventory/restock', 'Dopolni zalogo', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "itemId": "clinv1",
  "quantity": 10.0,
  "cost": 25.00,
  "supplierId": "clsup1",
  "note": "Tedenska dobava"
}'''))
story.append(H2('9.3 Adjust (korekcija)'))
story.append(endpoint('POST', '/api/inventory/adjust', 'Korekcija zaloge (inventura)', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "itemId": "clinv1",
  "newQuantity": 23.0,
  "reason": "inventura",
  "note": "Manjka 2.5 kg (razlitje)"
}'''))
story.append(PageBreak())

# 10. UPORABNIKI
story.append(H1('10. Uporabniki (Employees)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('10.1 Seznam uporabnikov'))
story.append(endpoint('GET', '/api/employees?locationId=clloc1', 'Pridobi seznam zaposlenih', 'manage_staff'))
story.append(H2('10.2 Ustvari uporabnika'))
story.append(endpoint('POST', '/api/employees', 'Ustvari novega uporabnika', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "name": "Ana Horvat",
  "pin": "4444",
  "role": "waiter",
  "locationId": "clloc1",
  "email": "ana@restaurant.com",
  "phone": "+386 41 234 567"
}'''))
story.append(H2('10.3 Posodobi uporabnika'))
story.append(endpoint('PUT', '/api/employees/[id]', 'Posodobi uporabnika', 'admin'))
story.append(H2('10.4 Reset PIN'))
story.append(endpoint('POST', '/api/employees/[id]/reset-pin', 'Reset PIN uporabnika', 'admin'))
story.append(H3('Request body'))
story.append(CODE('''{
  "newPin": "5555"
}'''))
story.append(PageBreak())

# 11. PWA IN PUSH
story.append(H1('11. PWA in Push Notifications'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('11.1 Subscribe na push'))
story.append(endpoint('POST', '/api/push/subscribe', 'Subscribe na Web Push notifications', 'take_orders'))
story.append(H3('Request body'))
story.append(CODE('''{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNa...",
    "auth": "abc..."
  },
  "expirationTime": null
}'''))
story.append(H2('11.2 Pošlji push notification'))
story.append(endpoint('POST', '/api/push/send', 'Pošlji push notification uporabniku', 'manage_staff'))
story.append(H3('Request body'))
story.append(CODE('''{
  "employeeId": "clemp1",
  "title": "Novo naročilo",
  "body": "Miza 5 - 2x Pizza",
  "data": {
    "url": "/orders/clxyz789",
    "orderId": "clxyz789"
  }
}'''))
story.append(H3('Response 200'))
story.append(CODE('''{
  "succeeded": 1,
  "failed": 0,
  "total": 1
}'''))
story.append(PageBreak())

# 12. AUDIT LOG
story.append(H1('12. Audit Log'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Audit log je chain hash (SHA-256), nepopravljiv. Vsi kritični dogodki so loggani.'))
story.append(H2('12.1 Pridobi audit log'))
story.append(endpoint('GET', '/api/audit-log?from=2025-09-01&to=2025-09-04', 'Pridobi audit log vnose', 'admin'))
story.append(H3('Query parametri'))
story.append(TBL([
    ['Parameter', 'Tip', 'Opis'],
    ['from', 'string', 'ISO datum (od)'],
    ['to', 'string', 'ISO datum (do)'],
    ['employeeId', 'string', 'Filter po uporabniku'],
    ['action', 'string', 'Filter po akciji (furs.verify, payment.create)'],
    ['locationId', 'string', 'Filter po lokaciji (super-admin: all)'],
], [100, 80, CONTENT_W-180]))
story.append(H3('Response 200'))
story.append(CODE('''{
  "logs": [
    {
      "id": "cllog1",
      "timestamp": "2025-09-04T11:05:00Z",
      "employeeId": "clemp1",
      "employeeName": "Janez",
      "action": "payment.create",
      "entityId": "clpay123",
      "entityType": "payment",
      "ipAddress": "192.168.1.100",
      "metadata": { "method": "cash", "amount": 50.00 },
      "previousHash": "abc123...",
      "currentHash": "def456..."
    }
  ],
  "total": 1247,
  "chainValid": true
}'''))
story.append(H2('12.2 Verificiraj chain'))
story.append(endpoint('GET', '/api/audit-log/verify', 'Verificiraj integriteto audit log chain-a', 'super_admin'))
story.append(H3('Response 200'))
story.append(CODE('''{
  "valid": true,
  "totalEntries": 1247,
  "verifiedAt": "2025-09-04T12:00:00Z",
  "firstEntry": "2025-01-01T00:00:00Z",
  "lastEntry": "2025-09-04T11:59:00Z"
}'''))
story.append(PageBreak())

# 13. ERROR HANDLING
story.append(H1('13. Error handling in konvencije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Vsi error-ji sledijo standardnemu formatu z error kodo za programsko obravnavo.'))
story.append(H2('13.1 Error response format'))
story.append(CODE('''{
  "error": "Človeku berljivo sporočilo",
  "code": "MACHINE_READABLE_CODE",
  "details": {
    "field": "pin",
    "issue": "must be 4 digits"
  },
  "requestId": "req_abc123"
}'''))
story.append(H2('13.2 Error kode'))
story.append(TBL([
    ['Code', 'HTTP', 'Pomen', 'Kdaj'],
    ['INVALID_PIN', '401', 'Neveljaven PIN', 'POST /api/auth'],
    ['OPTIMISTIC_LOCK_CONFLICT', '409', 'Konflikt pri posodobitvi', 'PUT /api/orders/[id]'],
    ['INSUFFICIENT_FUNDS', '400', 'Premalo sredstev na kartici', 'Stripe plačilo'],
    ['FURS_TIMEOUT', '503', 'FURS API ne odgovarja', 'POST /api/furs'],
    ['FURS_CERT_INVALID', '400', 'FURS certifikat neveljaven', 'POST /api/furs/cert-upload'],
    ['RATE_LIMIT_EXCEEDED', '429', 'Presežen rate limit', 'Katerikoli endpoint'],
    ['PERMISSION_DENIED', '403', 'Ni dovoljenja', 'Katerikoli zaščiten endpoint'],
    ['VALIDATION_ERROR', '400', 'Neveljavni parametri', 'POST/PUT z neveljavnim body'],
    ['NOT_FOUND', '404', 'Resource ne obstaja', 'GET/PUT/DELETE z neobstoječim ID'],
    ['STRIPE_WEBHOOK_INVALID', '400', 'Neveljaven webhook signature', 'POST /api/payment-gateways/webhook'],
], [200, 50, 200, CONTENT_W-450]))
story.append(C('Tabela 13.1: Standardne error kode'))
story.append(H2('13.3 Rate limiting'))
story.append(P('Vsi endpointi so rate-limited. Header-ji v responsu prikazujejo trenutno stanje:'))
story.append(CODE('''# Response headers:
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1695840000

# Ko presežen (429):
Retry-After: 60'''))
story.append(TBL([
    ['Kategorija', 'Limit', 'Okno', 'Endpointi'],
    ['Public', '20 req', '1 min', '/api/auth (POST), /api/qr-menu'],
    ['Authenticated', '60 req', '1 min', 'Večina endpointov'],
    ['FURS', '10 req', '1 min', '/api/furs/*'],
    ['Auth attempts', '5 req', '15 min', '/api/auth (POST) - zaščita brute force'],
    ['Public menu', '100 req', '1 min', '/api/menus, /api/menu-items (public)'],
], [120, 80, 70, CONTENT_W-270]))
story.append(C('Tabela 13.2: Rate limit kategorije'))
story.append(H2('13.4 Idempotency'))
story.append(P('Kritični endpointi (plačila, FURS) podpirajo idempotency prek Idempotency-Key header-ja:'))
story.append(CODE('''POST /api/payments
Idempotency-Key: random-uuid-12345
Content-Type: application/json

{
  "orderId": "clxyz789",
  "method": "cash",
  "amount": 50.00
}

# Če se request ponovi z istim key-em, se vrne originalni rezultat
# (preprečuje duplikate pri network retry)'''))
story.append(PageBreak())

# 14. SDK IN PRIMERI
story.append(H1('14. SDK in primeri uporabe'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('14.1 JavaScript/TypeScript SDK (načrtovan)'))
story.append(CODE('''// Namestitev (načrtovano):
npm install @restaurantos/sdk

// Uporaba:
import { RestaurantOSClient } from '@restaurantos/sdk'

const client = new RestaurantOSClient({
  baseURL: 'https://restaurantos.app/api',
  token: 'eyJhbGciOi...'  // iz /api/auth
})

// Ustvari naročilo:
const order = await client.orders.create({
  tableId: 'cltab1',
  items: [{ menuItemId: 'clitem1', quantity: 2 }]
})

// Plačaj:
const payment = await client.payments.create({
  orderId: order.id,
  method: 'cash',
  amount: order.total,
  receivedAmount: order.total
})'''))
story.append(H2('14.2 cURL primeri'))
story.append(H3('Prijava'))
story.append(CODE('''curl -X POST https://restaurantos.app/api/auth \\
  -H "Content-Type: application/json" \\
  -d '{"employeeId": "test-admin", "pin": "1234"}' '''))
story.append(H3('Pridobi naročila'))
story.append(CODE('''curl https://restaurantos.app/api/orders?limit=10 \\
  -H "Authorization: Bearer eyJhbGciOi..."'''))
story.append(H3('Ustvari naročilo'))
story.append(CODE('''curl -X POST https://restaurantos.app/api/orders \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "tableId": "cltab1",
    "items": [{"menuItemId": "clitem1", "quantity": 2}]
  }' '''))
story.append(H2('14.3 Postman collection'))
story.append(P('Postman collection je na voljo v /docs/postman-collection.json. Import v Postman za hitro testiranje vseh endpointov.'))
story.append(H2('14.4 OpenAPI specifikacija'))
story.append(P('OpenAPI 3.1 specifikacija je na voljo v /docs/openapi.yaml. Uporabi jo za generacijo SDK-jev v drugih jezikih (Python, Go, Java, itd.) prek swagger-codegen ali openapi-generator.'))
story.append(CALLOUT('API STATUS','API je v stabilni fazi v1.0.0. Breaking changes bodo verzionirani (v2, v3). Backward compatibility je zagotovljena za 12 mesecev po release-u. Za integracijo kontaktiraj api-support@restaurantos.app.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - API Documentation', author='Z.ai', subject='API dokumentacija', creator='Z.ai')
doc.multiBuild(story)
print(f'API doc body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
