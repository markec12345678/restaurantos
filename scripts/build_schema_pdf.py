#!/usr/bin/env python3
"""RestaurantOS Database Schema Documentation - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/schema_body.pdf'

h1_style=ParagraphStyle('H1',fontName='NotoSerifSC-Bold',fontSize=20,leading=26,textColor=HEADER_FILL,spaceBefore=14,spaceAfter=10,alignment=TA_LEFT)
h2_style=ParagraphStyle('H2',fontName='NotoSerifSC-Bold',fontSize=14,leading=20,textColor=ACCENT,spaceBefore=12,spaceAfter=6,alignment=TA_LEFT)
h3_style=ParagraphStyle('H3',fontName='NotoSerifSC-Bold',fontSize=11.5,leading=16,textColor=TEXT_PRIMARY,spaceBefore=8,spaceAfter=4,alignment=TA_LEFT)
body_style=ParagraphStyle('Body',fontName='NotoSerifSC',fontSize=10.5,leading=16,textColor=TEXT_PRIMARY,spaceAfter=8,alignment=TA_LEFT,wordWrap='CJK')
bullet_style=ParagraphStyle('Bullet',fontName='NotoSerifSC',fontSize=10.5,leading=15,textColor=TEXT_PRIMARY,leftIndent=14,spaceAfter=4,alignment=TA_LEFT,wordWrap='CJK')
caption_style=ParagraphStyle('Caption',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER,spaceBefore=4,spaceAfter=14)
callout_t=ParagraphStyle('CT',fontName='NotoSerifSC-Bold',fontSize=11,leading=15,textColor=colors.white)
callout_b=ParagraphStyle('CB',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=colors.white,wordWrap='CJK')
th_style=ParagraphStyle('TH',fontName='NotoSerifSC-Bold',fontSize=8.5,leading=11,textColor=colors.white,alignment=TA_CENTER)
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
    st=[('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),('GRID',(0,0),(-1,-1),0.4,BORDER)]
    if hdr:
        st.append(('BACKGROUND',(0,0),(-1,0),HEADER_FILL)); st.append(('TEXTCOLOR',(0,0),(-1,0),colors.white))
        for r in range(1,len(rows)):
            st.append(('BACKGROUND',(0,r),(-1,r),TABLE_STRIPE if r%2==1 else colors.white))
    t.setStyle(TableStyle(st))
    return t

def model_doc(name, description, fields, relations=None, indexes=None):
    """Build a model documentation block."""
    # Header
    header_data = [[
        Paragraph(f'<b>{name}</b>', ParagraphStyle('mn', fontName='SarasaMonoSC', fontSize=12, textColor=ACCENT, alignment=TA_LEFT)),
        Paragraph(f'<i>{description}</i>', ParagraphStyle('md', fontName='NotoSerifSC', fontSize=9, textColor=TEXT_MUTED, alignment=TA_LEFT))
    ]]
    t = Table(header_data, colWidths=[120, CONTENT_W-120])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ]))
    
    # Fields table
    field_data = [['Field', 'Type', 'Required', 'Description']]
    for f in fields:
        field_data.append([f[0], f[1], f[2], f[3] if len(f) > 3 else ''])
    
    return [t, SP(4), TBL(field_data, [110, 90, 50, CONTENT_W-250]), SP(8)]

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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Database Schema · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building Database Schema Documentation...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod v shemo'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS uporablja PostgreSQL bazo z 94 Prisma modeli (2992 vrstic sheme). Ta dokument vsebuje pregled vseh modelov razporejenih v 10 logičnih modulov z njihovimi polji, relacijami in indeksi.'))
story.append(SP(6))
story.append(STATS([
    ('94', 'Prisma modelov'),
    ('2992', 'vrstic sheme'),
    ('10', 'logičnih modulov'),
    ('8', 'multi-tenant tabel'),
]))
story.append(SP(12))
story.append(H2('1.1 Konvencije'))
story.append(B('<b>ID</b> - CUID (clxyz123abc...), 24 znakov, globally unique'))
story.append(B('<b>Timestamps</b> - createdAt (auto), updatedAt (auto, za optimistic lock)'))
story.append(B('<b>Soft delete</b> - ni privzet (hard delete z anonymize za GDPR)'))
story.append(B('<b>Multi-tenant</b> - locationId na 8 ključnih tabelah'))
story.append(B('<b>Indexes</b> - na vseh foreign key-ih in pogosto iskanih poljih'))
story.append(B('<b>Enums</b> - uporabljeni za status polja (OrderStatus, PaymentStatus)'))
story.append(H2('1.2 Multi-tenant izolacija'))
story.append(P('Naslednje tabele imajo locationId za multi-tenant izolacijo (glej ADR-004):'))
story.append(B('<b>Order</b> - naročila so vezana na lokacijo'))
story.append(B('<b>Payment</b> - plačila pripadajo naročilom na lokaciji'))
story.append(B('<b>InventoryItem</b> - zaloge so ločene po lokacijah'))
story.append(B('<b>Employee</b> - osebje je dodeljeno lokaciji'))
story.append(B('<b>Table</b> - mize so fizično na lokaciji'))
story.append(B('<b>CashRegisterShift</b> - izmene so po lokacijah'))
story.append(B('<b>AuditLog</b> - log-i vsebujejo locationId kontekst'))
story.append(B('<b>PushSubscription</b> - subscription-i so per employee/lokacija'))
story.append(H2('1.3 Optimistic locking'))
story.append(P('Tabele z `updatedAt` poljem podpirajo optimistic locking. Pri update-u se pošlje expectedUpdatedAt - če se ne ujema s trenutnim, vrne 409 Conflict.'))
story.append(CODE('''// Primer optimistic lock:
const order = await db.order.update({
  where: {
    id: orderId,
    updatedAt: expectedUpdatedAt,  // preveri, da ni bil spremenjen
  },
  data: { status: 'paid' },
})

if (!order) {
  // 409 Conflict - nekdo drug je spremenil
  return NextResponse.json(
    { error: 'OPTIMISTIC_LOCK_CONFLICT' },
    { status: 409 }
  )
}'''))
story.append(PageBreak())

# 2. MODUL 1: LOKACIJE IN NASTAVITVE
story.append(H1('2. Modul 1: Lokacije in nastavitve'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Osnovni modul za upravljanje lokacij (tenantov) in globalnih nastavitev restavracije.'))
for item in model_doc('Location', 'Fizična lokacija restavracije (tenant)', [
    ['id', 'String', '✅', 'CUID primary key'],
    ['businessId', 'String', '✅', 'Matična številka podjetja'],
    ['taxId', 'String', '✅', 'Davčna številka (za FURS)'],
    ['registerNumber', 'String', '✅', 'Register number (FURS)'],
    ['premisesId', 'String', '✅', 'FURS premises ID'],
    ['name', 'String', '✅', 'Ime lokacije'],
    ['address', 'String', '✅', 'Naslov'],
    ['fursCertPath', 'String?', '❌', 'Pot do .p12 certifikata'],
    ['fursCertPassword', 'String?', '❌', 'Geslo certifikata'],
    ['fursEnvironment', 'String?', '❌', 'test | production'],
    ['isActive', 'Boolean', '✅', 'Ali je lokacija aktivna'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko (optimistic lock)'],
]):
    story.append(item)

for item in model_doc('RestaurantSettings', 'Globalne nastavitve restavracije', [
    ['id', 'String', '✅', 'CUID'],
    ['locationId', 'String?', '❌', 'Lokacija (če je per-location)'],
    ['name', 'String', '✅', 'Ime restavracije'],
    ['currency', 'String', '✅', 'EUR (default)'],
    ['timezone', 'String', '✅', 'Europe/Ljubljana'],
    ['locale', 'String', '✅', 'sl-SI'],
    ['isActive', 'Boolean', '✅', 'Aktivne nastavitve'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

story.append(PageBreak())

# 3. MODUL 2: MENIJI IN ARTIKLI
story.append(H1('3. Modul 2: Meniji in artikli'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Modul za upravljanje menijev, artiklov, kategorij, modifikatorjev in cen.'))
for item in model_doc('Menu', 'Meni (npr. Kosilo, Večerja, Pijače)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime menija'],
    ['locationId', 'String?', '❌', 'Lokacija (če je per-location)'],
    ['isActive', 'Boolean', '✅', 'Ali je meni aktiven'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('MenuItem', 'Artikel v meniju (Pizza, Pivo, itd.)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime artikla'],
    ['nameEn', 'String?', '❌', 'Angleško ime'],
    ['price', 'Decimal', '✅', 'Cena (EUR)'],
    ['categoryId', 'String', '✅', 'FK → Category'],
    ['taxRateId', 'String', '✅', 'FK → TaxRate (DDV stopnja)'],
    ['allergens', 'String[]', '❌', 'Alergeni (gluten, milk, nuts...)'],
    ['imageUrl', 'String?', '❌', 'URL do slike'],
    ['description', 'String?', '❌', 'Opis artikla'],
    ['preparationTime', 'Int?', '❌', 'Čas priprave (minute)'],
    ['active', 'Boolean', '✅', 'Ali je artikel aktiven'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Category', 'Kategorija menija (Predjedi, Glavne jedi)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime kategorije'],
    ['menuId', 'String', '✅', 'FK → Menu'],
    ['sortOrder', 'Int', '✅', 'Vrstni red prikaza'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('ModifierGroup', 'Skupina modifikatorjev (Velikost, Dodatki)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime skupine'],
    ['isRequired', 'Boolean', '✅', 'Ali je obvezna izbira'],
    ['maxSelections', 'Int', '✅', 'Max št. izborov'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Modifier', 'Posamezni modifikator (S, M, L, Brez glutena)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime modifikatorja'],
    ['modifierGroupId', 'String', '✅', 'FK → ModifierGroup'],
    ['priceModifier', 'Decimal', '✅', 'Sprememba cene (+2.00, -0.50)'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('TaxRate', 'DDV stopnja (22%, 9.5%, 0%)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Opis (npr. "Standardna 22%")'],
    ['rate', 'Decimal', '✅', 'Stopnja (22, 9.5, 0)'],
    ['isActive', 'Boolean', '✅', 'Ali je aktivna'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

story.append(PageBreak())

# 4. MODUL 3: NAROČILA
story.append(H1('4. Modul 3: Naročila in postrežba'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Modul za upravljanje naročil, miz, artiklov v naročilu in transakcij.'))
for item in model_doc('Table', 'Miza v restavraciji', [
    ['id', 'String', '✅', 'CUID'],
    ['number', 'Int', '✅', 'Številka mize'],
    ['capacity', 'Int', '✅', 'Kapaciteta (št. oseb)'],
    ['section', 'String?', '❌', 'Sektor (Main Hall, Terrace)'],
    ['locationId', 'String', '✅', 'FK → Location (multi-tenant)'],
    ['status', 'String', '✅', 'free | occupied | reserved'],
    ['currentOrderId', 'String?', '❌', 'FK → Order (če je zasedena)'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Order', 'Naročilo (glavna entiteta)', [
    ['id', 'String', '✅', 'CUID'],
    ['number', 'String', '✅', 'Številka naročila (2025-001)'],
    ['tableId', 'String?', '❌', 'FK → Table (če je dine-in)'],
    ['tableNumber', 'Int?', '❌', 'Denormalizirano za hitrost'],
    ['employeeId', 'String', '✅', 'FK → Employee (natakar)'],
    ['locationId', 'String', '✅', 'FK → Location (multi-tenant)'],
    ['status', 'String', '✅', 'open | paid | cancelled | storno'],
    ['type', 'String', '✅', 'dine_in | takeaway | delivery'],
    ['total', 'Decimal', '✅', 'Skupni znesek'],
    ['subtotal', 'Decimal', '✅', 'Pred DDV'],
    ['taxTotal', 'Decimal', '✅', 'DDV skupaj'],
    ['items', 'OrderItem[]', '✅', 'Relacija → OrderItem'],
    ['payments', 'Payment[]', '✅', 'Relacija → Payment'],
    ['fursZoi', 'String?', '❌', 'FURS ZOI (32-znakovni MD5)'],
    ['fursEor', 'String?', '❌', 'FURS EOR (UUID)'],
    ['fursVerifiedAt', 'DateTime?', '❌', 'Datum FURS potrjevanja'],
    ['idempotencyKey', 'String?', '❌', 'Za idempotentno ustvarjanje'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko (optimistic lock)'],
]):
    story.append(item)

for item in model_doc('OrderItem', 'Posamezni artikel v naročilu', [
    ['id', 'String', '✅', 'CUID'],
    ['orderId', 'String', '✅', 'FK → Order'],
    ['menuItemId', 'String', '✅', 'FK → MenuItem'],
    ['name', 'String', '✅', 'Denormalizirano ime'],
    ['quantity', 'Int', '✅', 'Količina'],
    ['price', 'Decimal', '✅', 'Cena na artikel'],
    ['modifiers', 'String[]', '❌', 'Izbrani modifikatorji'],
    ['notes', 'String?', '❌', 'Opombe (brez čebule)'],
    ['status', 'String', '✅', 'pending | preparing | ready | served'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

story.append(PageBreak())

# 5. MODUL 4: PLAČILA
story.append(H1('5. Modul 4: Plačila'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('Payment', 'Plačilo za naročilo', [
    ['id', 'String', '✅', 'CUID'],
    ['orderId', 'String', '✅', 'FK → Order'],
    ['method', 'String', '✅', 'cash | card | gift_card'],
    ['amount', 'Decimal', '✅', 'Znesek plačila'],
    ['receivedAmount', 'Decimal?', '❌', 'Prejeto (za gotovino)'],
    ['change', 'Decimal?', '❌', 'Vračilo'],
    ['tip', 'Decimal?', '❌', 'Napitnina'],
    ['status', 'String', '✅', 'pending | completed | failed | refunded'],
    ['gateway', 'String?', '❌', 'stripe | sumup | null (cash)'],
    ['gatewayTransactionId', 'String?', '❌', 'ID transakcije pri gateway-u'],
    ['idempotencyKey', 'String?', '❌', 'Za idempotentno plačilo'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('GiftCard', 'Darilna kartica', [
    ['id', 'String', '✅', 'CUID'],
    ['code', 'String', '✅', 'Koda kartice (unique)'],
    ['initialBalance', 'Decimal', '✅', 'Začetno stanje'],
    ['currentBalance', 'Decimal', '✅', 'Trenutno stanje'],
    ['expiresAt', 'DateTime?', '❌', 'Datum poteka'],
    ['isActive', 'Boolean', '✅', 'Ali je aktivna'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('CashRegisterShift', 'Izmena blagajne (odprtje/zapiranje)', [
    ['id', 'String', '✅', 'CUID'],
    ['locationId', 'String', '✅', 'FK → Location (multi-tenant)'],
    ['employeeId', 'String', '✅', 'FK → Employee (odprl)'],
    ['openingAmount', 'Decimal', '✅', 'Začetno stanje gotovine'],
    ['closingAmount', 'Decimal?', '❌', 'Končno stanje'],
    ['countedCash', 'Decimal?', '❌', 'Prešteto stanje'],
    ['discrepancy', 'Decimal?', '❌', 'Razlika'],
    ['status', 'String', '✅', 'open | closed'],
    ['openedAt', 'DateTime', '✅', 'Čas odprtja'],
    ['closedAt', 'DateTime?', '❌', 'Čas zaprtja'],
]):
    story.append(item)

story.append(PageBreak())

# 6. MODUL 5: UPORABNIKI IN OSEBJE
story.append(H1('6. Modul 5: Uporabniki in osebje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('Employee', 'Zaposleni (natakar, kuhar, manager)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime in priimek'],
    ['pin', 'String', '✅', 'Hashed PIN (bcrypt + HMAC)'],
    ['role', 'String', '✅', 'waiter | cook | manager | admin | super_admin'],
    ['locationId', 'String', '✅', 'FK → Location (multi-tenant)'],
    ['email', 'String?', '❌', 'Email (unique)'],
    ['phone', 'String?', '❌', 'Telefon (E.164 format)'],
    ['active', 'Boolean', '✅', 'Ali je aktivni'],
    ['anonymizedAt', 'DateTime?', '❌', 'GDPR izbris (anonymize)'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Session', 'Aktivna seja uporabnika', [
    ['id', 'String', '✅', 'CUID'],
    ['employeeId', 'String', '✅', 'FK → Employee'],
    ['token', 'String', '✅', 'JWT token (unique)'],
    ['expiresAt', 'DateTime', '✅', 'Datum poteka (8h)'],
    ['ipAddress', 'String?', '❌', 'IP naslov prijave'],
    ['userAgent', 'String?', '❌', 'Browser/device info'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('PushSubscription', 'Web Push subscription', [
    ['id', 'String', '✅', 'CUID'],
    ['employeeId', 'String', '✅', 'FK → Employee'],
    ['endpoint', 'String', '✅', 'Push endpoint URL'],
    ['keysP256dh', 'String', '✅', 'P256dh key'],
    ['keysAuth', 'String', '✅', 'Auth key'],
    ['expirationTime', 'Int?', '❌', 'Expiration timestamp'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

story.append(PageBreak())

# 7. MODUL 6: FURS IN RAČUNI
story.append(H1('7. Modul 6: FURS in računi'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('Receipt', 'Račun (FURS potrjen)', [
    ['id', 'String', '✅', 'CUID'],
    ['orderId', 'String', '✅', 'FK → Order'],
    ['receiptNumber', 'String', '✅', 'Številka računa (unique)'],
    ['zoi', 'String', '✅', 'FURS ZOI (32-znakovni MD5)'],
    ['eor', 'String?', '❌', 'FURS EOR (UUID, po potrjevanju)'],
    ['fursVerifiedAt', 'DateTime?', '❌', 'Datum FURS potrjevanja'],
    ['qrCode', 'String?', '❌', 'Base64 QR koda'],
    ['pdfUrl', 'String?', '❌', 'URL do PDF računa'],
    ['stornoReceiptId', 'String?', '❌', 'FK → Receipt (če je storno)'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('ZReport', 'Z-Report (dnevno zapiranje)', [
    ['id', 'String', '✅', 'CUID'],
    ['locationId', 'String', '✅', 'FK → Location'],
    ['zReportNumber', 'String', '✅', 'Številka (Z-2025-001)'],
    ['openingAmount', 'Decimal', '✅', 'Začetno stanje'],
    ['closingAmount', 'Decimal', '✅', 'Končno stanje'],
    ['cashSales', 'Decimal', '✅', 'Gotovinska prodaja'],
    ['cardSales', 'Decimal', '✅', 'Kartična prodaja'],
    ['totalSales', 'Decimal', '✅', 'Skupna prodaja'],
    ['discrepancy', 'Decimal', '✅', 'Razlika'],
    ['closedAt', 'DateTime', '✅', 'Čas zaprtja'],
]):
    story.append(item)

for item in model_doc('AuditLog', 'Nepopravljiv audit log (chain hash)', [
    ['id', 'String', '✅', 'CUID'],
    ['timestamp', 'DateTime', '✅', 'Avtomatsko'],
    ['employeeId', 'String', '✅', 'FK → Employee'],
    ['action', 'String', '✅', 'furs.verify | payment.create | auth.login'],
    ['entityId', 'String', '✅', 'ID entitete, na katero se nanaša'],
    ['entityType', 'String', '✅', 'order | payment | employee'],
    ['ipAddress', 'String?', '❌', 'IP naslov'],
    ['metadata', 'Json?', '❌', 'Dodatni podatki'],
    ['previousHash', 'String', '✅', 'Hash prejšnje vrstice'],
    ['currentHash', 'String', '✅', 'SHA-256(previousHash + content)'],
]):
    story.append(item)

story.append(PageBreak())

# 8. MODUL 7: ZALOGE
story.append(H1('8. Modul 7: Zaloge in dobavitelji'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('InventoryItem', 'Artikel v zalogi', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime artikla'],
    ['quantity', 'Decimal', '✅', 'Trenutna količina'],
    ['unit', 'String', '✅', 'kg | l | kos | g'],
    ['minQuantity', 'Decimal', '✅', 'Minimalna količina (alert)'],
    ['maxQuantity', 'Decimal?', '❌', 'Maksimalna količina'],
    ['cost', 'Decimal', '✅', 'Cena na enoto'],
    ['locationId', 'String', '✅', 'FK → Location (multi-tenant)'],
    ['supplierId', 'String?', '❌', 'FK → Supplier'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
    ['updatedAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Supplier', 'Dobavitelj', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String', '✅', 'Ime dobavitelja'],
    ['taxId', 'String?', '❌', 'Davčna številka'],
    ['email', 'String?', '❌', 'Email'],
    ['phone', 'String?', '❌', 'Telefon'],
    ['address', 'String?', '❌', 'Naslov'],
    ['isActive', 'Boolean', '✅', 'Ali je aktiven'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('PurchaseOrder', 'Nabavni order', [
    ['id', 'String', '✅', 'CUID'],
    ['supplierId', 'String', '✅', 'FK → Supplier'],
    ['locationId', 'String', '✅', 'FK → Location'],
    ['orderNumber', 'String', '✅', 'Številka naročila'],
    ['status', 'String', '✅', 'draft | sent | received | cancelled'],
    ['total', 'Decimal', '✅', 'Skupni znesek'],
    ['orderedAt', 'DateTime', '✅', 'Datum naročila'],
    ['receivedAt', 'DateTime?', '❌', 'Datum prejema'],
]):
    story.append(item)

story.append(PageBreak())

# 9. MODUL 8: GOSTI IN LOYALTY
story.append(H1('9. Modul 8: Gosti in loyalty'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('Guest', 'Gost (stranka)', [
    ['id', 'String', '✅', 'CUID'],
    ['name', 'String?', '❌', 'Ime (če je znano)'],
    ['email', 'String?', '❌', 'Email (unique)'],
    ['phone', 'String?', '❌', 'Telefon'],
    ['locationId', 'String?', '❌', 'Primarna lokacija'],
    ['totalVisits', 'Int', '✅', 'Št. obiskov'],
    ['totalSpent', 'Decimal', '✅', 'Skupna poraba'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('LoyaltyAccount', 'Loyalty račun gosta', [
    ['id', 'String', '✅', 'CUID'],
    ['guestId', 'String', '✅', 'FK → Guest'],
    ['points', 'Int', '✅', 'Trenutno stanje točk'],
    ['tier', 'String', '✅', 'bronze | silver | gold | platinum'],
    ['joinedAt', 'DateTime', '✅', 'Datum pridružitve'],
]):
    story.append(item)

for item in model_doc('Reservation', 'Rezervacija mize', [
    ['id', 'String', '✅', 'CUID'],
    ['guestId', 'String?', '❌', 'FK → Guest (če je registriran)'],
    ['guestName', 'String', '✅', 'Ime gosta'],
    ['guestPhone', 'String', '✅', 'Telefon'],
    ['tableId', 'String?', '❌', 'FK → Table (če je dodeljena)'],
    ['locationId', 'String', '✅', 'FK → Location'],
    ['partySize', 'Int', '✅', 'Št. oseb'],
    ['reservedAt', 'DateTime', '✅', 'Datum in ura rezervacije'],
    ['status', 'String', '✅', 'pending | confirmed | seated | cancelled | no_show'],
    ['notes', 'String?', '❌', 'Opombe'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

story.append(PageBreak())

# 10. MODUL 9: RAČUNOVODSTVO
story.append(H1('10. Modul 9: Računovodstvo'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('JournalEntry', 'Računovodski vnos', [
    ['id', 'String', '✅', 'CUID'],
    ['entryNumber', 'String', '✅', 'Številka vnosa'],
    ['date', 'DateTime', '✅', 'Datum vnosa'],
    ['description', 'String', '✅', 'Opis'],
    ['reference', 'String?', '❌', 'Referenca (naročilo, račun)'],
    ['lines', 'JournalLine[]', '✅', 'Relacija → JournalLine'],
    ['status', 'String', '✅', 'draft | posted | reversed'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('JournalLine', 'Posamezna vrstica journal entry-ja', [
    ['id', 'String', '✅', 'CUID'],
    ['journalEntryId', 'String', '✅', 'FK → JournalEntry'],
    ['accountId', 'String', '✅', 'FK → ChartOfAccount'],
    ['debit', 'Decimal', '✅', 'Breme (0 če kredit)'],
    ['credit', 'Decimal', '✅', 'Kredit (0 če breme)'],
    ['description', 'String?', '❌', 'Opis vrstice'],
]):
    story.append(item)

for item in model_doc('ChartOfAccount', 'Kontni plan', [
    ['id', 'String', '✅', 'CUID'],
    ['code', 'String', '✅', 'Konto (npr. 1200 - Blagajna)'],
    ['name', 'String', '✅', 'Ime konta'],
    ['type', 'String', '✅', 'asset | liability | equity | revenue | expense'],
    ['isActive', 'Boolean', '✅', 'Ali je aktiven'],
]):
    story.append(item)

story.append(PageBreak())

# 11. MODUL 10: INTEGRACIJE IN PWA
story.append(H1('11. Modul 10: Integracije, PWA in ostalo'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
for item in model_doc('Webhook', 'Webhook endpoint (zunanji sistemi)', [
    ['id', 'String', '✅', 'CUID'],
    ['url', 'String', '✅', 'URL webhook-a'],
    ['secret', 'String', '✅', 'HMAC secret za signature'],
    ['events', 'String[]', '✅', 'Event tipi (order.created, payment.completed)'],
    ['isActive', 'Boolean', '✅', 'Ali je aktiven'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('OutboxEvent', 'Outbox pattern za async procesiranje', [
    ['id', 'String', '✅', 'CUID'],
    ['aggregateType', 'String', '✅', 'order | payment | invoice'],
    ['aggregateId', 'String', '✅', 'ID entitete'],
    ['type', 'String', '✅', 'Event tip (created, updated, deleted)'],
    ['payload', 'Json', '✅', 'Event podatki'],
    ['processedAt', 'DateTime?', '❌', 'Datum obdelave'],
    ['createdAt', 'DateTime', '✅', 'Avtomatsko'],
]):
    story.append(item)

for item in model_doc('Counter', 'Števec (za generacijo številk)', [
    ['id', 'String', '✅', 'CUID'],
    ['key', 'String', '✅', 'Tip števca (order_number, receipt_number)'],
    ['value', 'Int', '✅', 'Trenutna vrednost'],
    ['locationId', 'String?', '❌', 'Lokacija (če je per-location)'],
    ['year', 'Int', '✅', 'Leto (za reset)'],
]):
    story.append(item)

story.append(PageBreak())

# 12. RELACIJE IN ER DIAGRAM
story.append(H1('12. Ključne relacije (ER)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Pregled ključnih relacij med modeli. Order je centralna entiteta, na katero se nanaša večina drugih.'))
story.append(H2('12.1 Order relacije'))
story.append(CODE('''Order (central)
├── Table (1:N - miza ima lahko več naročil)
├── Employee (N:1 - natakar ustvari naročilo)
├── Location (N:1 - multi-tenant)
├── OrderItem (1:N - naročilo ima več artiklov)
│   └── MenuItem (N:1 - artikel iz menija)
├── Payment (1:N - lahko več plačil za split bill)
│   └── GiftCard (N:1 - če plačilo z darilno kartico)
├── Receipt (1:1 - FURS račun)
├── DeliveryInfo (1:1 - če je dostava)
└── Discount (1:N - popusti na naročilu)'''))
story.append(H2('12.2 Employee relacije'))
story.append(CODE('''Employee (osebje)
├── Location (N:1 - multi-tenant)
├── Session (1:N - aktivne seje)
├── PushSubscription (1:N - push subscriptions)
├── Order (1:N - naročila, ki jih je ustvaril)
├── CashRegisterShift (1:N - izmene, ki jih je odprl)
├── AuditLog (1:N - akcije, ki jih je izvedel)
├── EmployeeJob (N:M - posluje preko join tabele)
└── Job (M:N - vloge/posli')'''))
story.append(H2('12.3 Inventory relacije'))
story.append(CODE('''InventoryItem (zaloga)
├── Location (N:1 - multi-tenant)
├── Supplier (N:1 - dobavitelj)
├── StockTransaction (1:N - transakcije)
├── PurchaseOrderItem (1:N - v nabavnih naročilih)
├── RecipeItem (1:N - v recepturah)
└── ReorderRule (1:1 - pravilo za avtomatsko naročanje)'''))
story.append(H2('12.4 Audit log (chain hash)'))
story.append(CODE('''AuditLog (nepopravljiv)
├── Employee (N:1 - kdo je izvedel akcijo)
├── previousHash → AuditLog.currentHash (chain)
└── currentHash = SHA-256(previousHash + content)

Verifikacija:
- Rechain od genesis do zadnje vrstice
- Če se kak hash ne ujema → COMPROMISED
- Endpoint: GET /api/audit-log/verify'''))
story.append(PageBreak())

# 13. INDEKSI IN PERFORMANCE
story.append(H1('13. Indeksi in performance'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Strategija indeksov za optimalno delovanje. Vsi foreign key-i so indeksirani, prav tako pogosto iskana polja.'))
story.append(H2('13.1 Ključni indeksi'))
story.append(TBL([
    ['Tabela', 'Indeks', 'Polja', 'Namen'],
    ['Order', 'idx_orders_location_created', '(locationId, createdAt)', 'Pregled po lokaciji in datumu'],
    ['Order', 'idx_orders_status', '(status)', 'Filter po statusu (open/paid)'],
    ['Order', 'idx_orders_employee', '(employeeId)', 'Pregled po natakarju'],
    ['Payment', 'idx_payments_gateway_txid', '(gatewayTransactionId)', 'Stripe webhook lookup'],
    ['Payment', 'idx_payments_order', '(orderId)', 'Plačila za naročilo'],
    ['AuditLog', 'idx_audit_timestamp', '(timestamp)', 'Časovni pregled'],
    ['AuditLog', 'idx_audit_employee', '(employeeId)', 'Pregled po uporabniku'],
    ['InventoryItem', 'idx_inventory_location', '(locationId)', 'Multi-tenant filter'],
    ['Employee', 'idx_employees_location_active', '(locationId, active)', 'Aktivni uporabniki'],
    ['PushSubscription', 'idx_push_employee', '(employeeId)', 'Pošiljanje push'],
    ['MenuItem', 'idx_menu_category', '(categoryId)', 'Artikli po kategoriji'],
    ['Receipt', 'idx_receipt_zoi', '(zoi)', 'FURS ZOI lookup'],
], [90, 200, 130, CONTENT_W-420]))
story.append(C('Tabela 13.1: Ključni indeksi'))
story.append(H2('13.2 Query optimization primeri'))
story.append(CODE('''# ✅ PRAVILNO - z index-om:
const orders = await db.order.findMany({
  where: {
    locationId: locationId,  // index: idx_orders_location_created
    createdAt: { gte: dateFrom },
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
})

# ✅ PRAVILNO - z include (1 query, ne N+1):
const order = await db.order.findUnique({
  where: { id: orderId },
  include: {
    items: true,        // 1 query
    payments: true,     // 1 query
    table: true,        // 1 query
    employee: {         // 1 query
      select: { name: true }  // samo potrebna polja
    },
  },
})

# ❌ NAROBE - N+1 problem:
const orders = await db.order.findMany()
for (const order of orders) {
  const items = await db.orderItem.findMany({  // N query-jev!
    where: { orderId: order.id }
  })
}'''))
story.append(H2('13.3 Migracije'))
story.append(CODE('''# Ustvari migracijo iz spremembe sheme:
bun run db:migrate -- --name add_new_field

# Apply na bazo:
bun run db:push  # dev (brez migracije)
bun run db:migrate deploy  # produkcija

# Reset baze (pazi!):
bun run db:reset

# Prisma Studio (GUI za DB):
bunx prisma studio
# Odpri http://localhost:5555'''))
story.append(CALLOUT('DATABASE BEST PRACTICES','1. Vedno uporabi `include` za relacije (prepreči N+1). 2. Dodaj index na pogosto filtrirana polja. 3. Uporabi `select` za samo potrebna polja (manj podatkov). 4. Optimistic locking z `updatedAt`. 5. Multi-tenant: vedno filtriraj z locationId.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Database Schema Documentation', author='Z.ai', subject='DB schema 94 modelov', creator='Z.ai')
doc.multiBuild(story)
print(f'Schema body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
