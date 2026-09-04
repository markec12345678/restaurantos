#!/usr/bin/env python3
"""RestaurantOS Go-to-Market Strategy - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/gtm_body.pdf'

h1_style=ParagraphStyle('H1',fontName='NotoSerifSC-Bold',fontSize=20,leading=26,textColor=HEADER_FILL,spaceBefore=14,spaceAfter=10,alignment=TA_LEFT)
h2_style=ParagraphStyle('H2',fontName='NotoSerifSC-Bold',fontSize=14,leading=20,textColor=ACCENT,spaceBefore=12,spaceAfter=6,alignment=TA_LEFT)
h3_style=ParagraphStyle('H3',fontName='NotoSerifSC-Bold',fontSize=11.5,leading=16,textColor=TEXT_PRIMARY,spaceBefore=8,spaceAfter=4,alignment=TA_LEFT)
body_style=ParagraphStyle('Body',fontName='NotoSerifSC',fontSize=10.5,leading=16,textColor=TEXT_PRIMARY,spaceAfter=8,alignment=TA_LEFT,wordWrap='CJK')
bullet_style=ParagraphStyle('Bullet',fontName='NotoSerifSC',fontSize=10.5,leading=15,textColor=TEXT_PRIMARY,leftIndent=14,spaceAfter=4,alignment=TA_LEFT,wordWrap='CJK')
caption_style=ParagraphStyle('Caption',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER,spaceBefore=4,spaceAfter=14)
callout_t=ParagraphStyle('CT',fontName='NotoSerifSC-Bold',fontSize=11,leading=15,textColor=colors.white)
callout_b=ParagraphStyle('CB',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=colors.white,wordWrap='CJK')
th_style=ParagraphStyle('TH',fontName='NotoSerifSC-Bold',fontSize=9,leading=12,textColor=colors.white,alignment=TA_CENTER)
tc_style=ParagraphStyle('TC',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_PRIMARY,alignment=TA_LEFT,wordWrap='CJK')
toc1=ParagraphStyle('T1',fontName='NotoSerifSC-Bold',fontSize=11,leading=18,textColor=TEXT_PRIMARY,spaceBefore=4)
toc2=ParagraphStyle('T2',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=TEXT_PRIMARY,leftIndent=18,spaceBefore=2)
stat_n=ParagraphStyle('SN',fontName='NotoSerifSC-Bold',fontSize=22,leading=26,textColor=ACCENT,alignment=TA_CENTER)
stat_l=ParagraphStyle('SL',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER)
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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Go-to-Market Strategy · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building Go-to-Market Strategy...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. POVZETEK
story.append(H1('1. Izvršilni povzetek'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS vstopa na slovenski trg restavracijskih POS sistemov z edinstveno vrednostno ponudbo: moderni Next.js POS z FURS certifikacijo, multi-tenant arhitekturo in ceno 49 EUR/mesec - 4x ceneje od vodilnega Toast (165 EUR). Cilj: 200 aktivnih lokacij v 12 mesecih, 1.000 EUR MRR do konca 2026.'))
story.append(SP(6))
story.append(STATS([
    ('200', 'lokacij v 12 mesecih'),
    ('49€', 'osnovni paket/mes'),
    ('10k', 'EUR MRR v 12 mesecih'),
    ('4x', 'ceneje od Toast'),
]))
story.append(SP(12))
story.append(H2('1.1 Strateški cilji (12 mesecev)'))
story.append(TBL([
    ['Cilj', 'Meritev', 'Rok', 'Status'],
    ['200 aktivnih lokacij', 'Št. plačljivih strank', 'Sep 2026', 'Načrtovano'],
    ['10.000 EUR MRR', 'Monthly Recurring Revenue', 'Sep 2026', 'Načrtovano'],
    ['50 EU lokacij', 'Hrvaška + Italija', 'Sep 2026', 'Načrtovano'],
    ['<5% churn rate', 'Mesečni churn', 'Kontinuirno', 'Načrtovano'],
    ['4.2/5 satisfaction', 'NPS score', 'Kontinuirno', 'Načrtovano'],
    ['3 partnerstva', 'Distributerji/računovodje', 'Q2 2026', 'Načrtovano'],
], [200, 180, 80, 80]))
story.append(C('Tabela 1.1: Strateški cilji za 12 mesecev'))
story.append(H2('1.2 investicijska zahteva'))
story.append(TBL([
    ['Postavka', 'Znesek (EUR)', 'Opis'],
    ['Razvoj (1.5 FTE, 12 mesecev)', '120.000', '1 FTE fullstack + 0.3 FTE designer + 0.2 FTE QA'],
    ['Marketing in sales', '30.000', 'Google Ads, LinkedIn, content, events'],
    ['Infrastruktura (Vercel + Neon + Sentry)', '6.000', '500 EUR/mes × 12'],
    ['Legal in compliance', '5.000', 'Pogodbe, DPA, trademark'],
    ['Rezerva (10%)', '16.000', 'Nepredvideni stroški'],
    ['SKUPNO', '177.000', 'Investicija za 12 mesecev'],
], [250, 100, CONTENT_W-350]))
story.append(C('Tabela 1.2: Investicijska zahteva'))
story.append(CALLOUT('ROI PROJEKCIJA','Pri 200 strankah × 49 EUR = 9.800 EUR/mes MRR. Break-even pri 180 strankah (8.820 EUR/mes pokrije 1.5 FTE ekipo). ROI v 18 mesecih. Do konca 2026: 350 strank × 49 EUR = 17.150 EUR/mes MRR = 206k EUR letni prihodek.', ACCENT))
story.append(PageBreak())

# 2. TRŽNA ANALIZA
story.append(H1('2. Tržna analiza in ciljni segment'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Slovenski trg restavracijskih POS sistemov je v preobrazbi. Tradicionalni ponudniki (EdiPlug, IRIS) imajo zastarelo tehnologijo, globalni (Toast, Square) nimajo FURS. RestaurantOS zaseda belo liso: moderni cloud POS z lokalno FURS podporo.'))
story.append(H2('2.1 Velikost trga (TAM/SAM/SOM)'))
story.append(TBL([
    ['Nivo', 'Opis', 'Velikost', 'RestaurantOS cilj'],
    ['TAM', 'Globalni POS trg (2025)', '18,7 Mrd USD', 'Dolgoročno (EU širitev)'],
    ['SAM', 'EU restavracijski POS', '5,2 Mrd EUR', 'Srednjeoročno (SI + HR + IT)'],
    ['SOM', 'Slovenski trg (25k restavracij)', '15 M EUR/leto', 'Kratkoročno (200 strank = 120k EUR)'],
], [60, 200, 120, CONTENT_W-380]))
story.append(C('Tabela 2.1: TAM/SAM/SOM analiza'))
story.append(H2('2.2 Ciljni segmenti (ICP - Ideal Customer Profile)'))
story.append(TBL([
    ['Segment', 'Profil', 'Velikost', 'Prioriteta', 'Cena'],
    ['Neodvisne restavracije', '1-3 lokacije, 20-100 sedežev, nezadovoljne z EdiPlug/IRIS', '8.000 v SI', 'P0 (primarni)', '49 EUR/mes'],
    ['Manjše verige', '4-10 lokacij, potrebujejo multi-tenant', '2.500 v SI', 'P1 (sekundarni)', '99 EUR/mes'],
    ['Nove restavracije', 'Startup, še brez POS, iščejo modern solution', '1.500/leto novih', 'P0 (lahko dosegljiv)', '49 EUR/mes'],
    ['Kavarne in bistroji', 'Manjši obseg, enostavne potrebe', '5.000 v SI', 'P2', '49 EUR/mes'],
    ['Fast food / food trucks', 'Hitra prodaja, mobilnost', '3.000 v SI', 'P2', '49 EUR/mes'],
    ['Fine dining', 'Kompleksne potrebe, višji budget', '500 v SI', 'P3 (enterprise)', 'Po dogovoru'],
], [130, 200, 80, 100, 80]))
story.append(C('Tabela 2.2: Ciljni segmenti in ICP'))
story.append(H2('2.3 Konkurenčna prednost'))
story.append(B('<b>Edini moderni FURS Next.js POS</b> - noben slovenski tekmec nima sodobne arhitekture'))
story.append(B('<b>4x ceneje od Toast</b> - 49 EUR vs 165 EUR, enaka funkcionalnost'))
story.append(B('<b>5 jezikov</b> - sl/en/it/hr/de, tekmeci imajo samo slovenščino ali angleščino'))
story.append(B('<b>A++ varnost</b> - 0 XSS/SQLi, GDPR compliant, PCI-DSS SAQ-A'))
story.append(B('<b>Multi-tenant</b> - edini v ceni pod 100 EUR z resnično multi-tenant arhitekturo'))
story.append(B('<b>Offline-first PWA</b> - deluje brez interneta, brez native app zahtev'))
story.append(PageBreak())

# 3. CENOVA STRATEGIJA
story.append(H1('3. Cenovna strategija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS uporablja "penetration pricing" strategijo - nizka cena za hitro pridobivanje tržnega deleža, kasneje premium paketi za višjo ARPU.'))
story.append(H2('3.1 Paketi in cene'))
story.append(TBL([
    ['Paket', 'Cena/mes', 'Setup', 'Lokacije', 'Vključeno', 'Ciljna stranka'],
    ['Starter', '29 EUR', '0', '1', 'POS, FURS, offline, 1 jezik', 'Kavarne, food trucks'],
    ['Basic', '49 EUR', '0', '1', 'Starter + 5 jezikov + QR meni + poročila', 'Neodvisne restavracije'],
    ['Pro', '99 EUR', '0', '3', 'Basic + Stripe + KDS + loyalty + API', 'Manjše verige'],
    ['Enterprise', '199 EUR', '500', 'Neomejeno', 'Pro + white-label + SLA + dedicated support', 'Srednje verige'],
    ['Custom', 'Po dogovoru', '1000+', 'Neomejeno', 'Enterprise + custom integracije + on-premise', 'Velike verige, franšize'],
], [80, 70, 50, 60, 200, CONTENT_W-460]))
story.append(C('Tabela 3.1: Paketi in cene'))
story.append(H2('3.2 Transakcijske provizije'))
story.append(TBL([
    ['Način plačila', 'Provizija', 'RestaurantOS delež', 'Stripe delež', 'Opomba'],
    ['Kartica (Stripe)', '1.5% + 0.18 EUR', '0% (margin v paketu)', '100%', 'Konkurenčno SumUp'],
    ['Gotovina', '0%', '-', '-', 'Brez provizije'],
    ['Darilna kartica', '0%', '-', '-', 'V paketu'],
    ['Online naročilo', '2.9% + 0.30 EUR', '0%', '100%', 'Stripe standard'],
], [130, 100, 120, 80, CONTENT_W-430]))
story.append(C('Tabela 3.2: Transakcijske provizije'))
story.append(H2('3.3 ARPU analiza'))
story.append(TBL([
    ['Leto', 'Št. strank', 'ARPU/mes', 'MRR', 'ARR', 'Rast'],
    ['Leto 1 (Sep 2025 - Sep 2026)', '200', '49 EUR', '9.800 EUR', '118k EUR', '-'],
    ['Leto 2 (Sep 2026 - Sep 2027)', '500', '55 EUR', '27.500 EUR', '330k EUR', '+180%'],
    ['Leto 3 (Sep 2027 - Sep 2028)', '1.200', '65 EUR', '78.000 EUR', '936k EUR', '+184%'],
], [200, 70, 70, 80, 80, 60]))
story.append(C('Tabela 3.3: ARPU in prihodkovna projekcija'))
story.append(PageBreak())

# 4. KANALI
story.append(H1('4. Prodajni in marketinški kanali'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('4.1 Kanal matrika'))
story.append(TBL([
    ['Kanal', 'Tip', 'CAC (EUR)', 'Konverzija', 'Prioriteta', 'Faza'],
    ['Direct sales (outbound)', 'Telefon + email', '150', '15%', 'P0', 'Sep-Dec 2025'],
    ['Google Ads', 'PPC', '80', '5%', 'P0', 'Sep 2025+'],
    ['LinkedIn outreach', 'Social', '100', '8%', 'P1', 'Okt 2025+'],
    ['Partnerstva (računovodje)', 'B2B2C', '50', '20%', 'P1', 'Q1 2026'],
    ['Content marketing', 'Inbound', '40', '3%', 'P2', 'Kontinuirno'],
    ['Industry events', 'Offline', '300', '10%', 'P2', 'Q1-Q2 2026'],
    ['Referral program', 'Word of mouth', '30', '25%', 'P1', 'Q2 2026'],
    ['SEO (restaurantos.app)', 'Organic', '20', '2%', 'P2', 'Kontinuirno'],
], [160, 100, 60, 60, 60, 100]))
story.append(C('Tabela 4.1: Prodajni in marketinški kanali'))
story.append(H2('4.2 Direct sales postopek'))
story.append(P('Outbound prodaja je primarni kanal za prvih 50 strank. Postopek:'))
story.append(CODE('''# Direct sales funnel (50 strank v 4 mesecih):

1. LEAD GENERATION (500 leadov/mes)
   - Cold outreach na Google Maps restavracije
   - LinkedIn iskanje lastnikov
   - Referral od znancev v industriji

2. FIRST CONTACT (200 klicev/mes)
   - Telefon: 15 min discovery call
   - Email: personaliziran pitch
   - Conversion: 40% (200 → 80 zainteresiranih)

3. DEMO (80 dem/mes)
   - Zoom: 45 min demo s staging environment
   - Custom scenariji za vsako stranko
   - Conversion: 35% (80 → 28 v pogajanja)

4. PROPOSAL (28 ponudb/mes)
   - PDF proposal s paketom in ceno
   - 14-dnevno brezplačno trial
   - Conversion: 60% (28 → 17 novih strank)

5. CLOSE (17 strank/mes)
   - Pogodba + setup + onboarding
   - Avg. cycle: 3 tedne od demo do close

TARGET: 17 strank/mes × 3 meseci = 50 strank do Dec 2025'''))
story.append(H2('4.3 B2B2C partnerstva'))
story.append(P('Partnerstva z računovodskimi službami in IT distributerji so ključna za scale nad 50 strankami.'))
story.append(TBL([
    ['Partner tip', 'Vrednost za partner', 'Vrednost za ROS', 'Revshare', 'Cilj'],
    ['Računovodske službe', '20% revshare, vrednost za stranke', 'Dostop do 100+ restavracij', '20% mesečno', '5 partnerjev'],
    ['IT distributerji', 'Margin na hardware + setup', 'Dostop do 500+ strank', '15% mesečno', '3 partnerje'],
    ['Spletni meniji (GloriaFood)', 'Cross-promotion', 'Dopolnitev ponudbe', '10% revshare', '2 partnerja'],
    ['FURS svetovalci', 'Consulting fee', 'Trust signal', '0% (referral)', '3 svetovalce'],
], [130, 180, 130, 70, 80]))
story.append(C('Tabela 4.2: B2B2C partnerstva'))
story.append(PageBreak())

# 5. SALES FUNNEL
story.append(H1('5. Sales funnel in konverzija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('5.1 Funnel Architecture'))
story.append(CODE('''# Sales Funnel (mesečni):

AWARENESS (5.000 ljudi)
├── Google Ads (2.000)
├── LinkedIn (1.000)
├── Organic/SEO (1.000)
└── Referral/Events (1.000)
       │
       ▼ 20% konverzija
INTEREST (1.000 leadov)
├── Newsletter signups (400)
├── Demo requests (300)
├── Content downloads (200)
└── Direct inquiries (100)
       │
       ▼ 30% konverzija
CONSIDERATION (300 dem-ov)
├── Zoom demos (200)
├── In-person demos (50)
├── Trial signups (50)
       │
       ▼ 40% konverzija
DECISION (120 v pogajanja)
├── Proposal sent (80)
├── Trial active (30)
├── Negotiation (10)
       │
       ▼ 60% konverzija
ACTION (72 novih strank/mes)
├── Contract signed (50)
├── Setup complete (15)
└── Go-live (7)

TARGET: 50 novih strank/mes × 12 = 600 strank/leto
(prvi mesec: 10, rast 20%/mes)'''))
story.append(H2('5.2 Konverzijske metrike'))
story.append(TBL([
    ['Faza', 'Št. (mesečno)', 'Konverzija', 'CAC (EUR)', 'Opomba'],
    ['Awareness', '5.000', '20%', '4', 'CPC ~0.80 EUR'],
    ['Interest', '1.000', '30%', '20', 'Lead gen'],
    ['Consideration', '300', '40%', '67', 'Demo (45 min)'],
    ['Decision', '120', '60%', '167', 'Proposal + trial'],
    ['Action', '72', '-', '278', 'Close + onboarding'],
    ['Retention', '65/72', '90%', '-', '3/72 churn'],
], [120, 100, 80, 80, CONTENT_W-380]))
story.append(C('Tabela 5.1: Konverzijske metrike po funnel fazah'))
story.append(H2('5.3 Trial-to-paid konverzija'))
story.append(P('14-dnevno brezplačno trial je ključno za konverzijo. Strategija:'))
story.append(B('<b>Day 1:</b> Setup klic (30 min) - pomoč pri FURS cert in konfiguraciji'))
story.append(B('<b>Day 3:</b> Follow-up email - how-to guide za meni in mize'))
story.append(B('<b>Day 7:</b> Mid-trial klic - feedback, ali vse deluje'))
story.append(B('<b>Day 10:</b> Demo novih funkcij (Stripe, PWA)'))
story.append(B('<b>Day 13:</b> Conversion klic - predlagaj prehod na plačljiv paket'))
story.append(B('<b>Day 14:</b> Trial expires - če ni konvertiral, email z incentive (10% popust 3 mesece)'))
story.append(PageBreak())

# 6. MARKETING IN CONTENT
story.append(H1('6. Marketing in content strategija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('6.1 Content koledar (prvi 3 meseci)'))
story.append(TBL([
    ['Teden', 'Blog post', 'Social media', 'Email', 'Video'],
    ['Teden 1', 'Zakaj RestaurantOS? (launch)', '3x LinkedIn, 5x Twitter', 'Launch announcement', 'Product demo (5 min)'],
    ['Teden 2', 'FURS certifikacija: vodič', '3x LinkedIn, 5x Twitter', 'Tutorial: FURS setup', 'FURS setup (10 min)'],
    ['Teden 3', 'Toast vs RestaurantOS primerjava', '3x LinkedIn, 5x Twitter', 'Case study template', 'Price comparison'],
    ['Teden 4', 'Kako zmanjšati stroške POS za 75%', '3x LinkedIn, 5x Twitter', 'Monthly newsletter', 'Cost savings calc'],
    ['Teden 5', 'Multi-tenant POS: zakaj pomembno', '3x LinkedIn, 5x Twitter', 'Feature highlight', 'Multi-tenant demo'],
    ['Teden 6', 'GDPR in restavracije: vodič', '3x LinkedIn, 5x Twitter', 'Compliance guide', 'Security overview'],
    ['Teden 7', 'Stripe integracija: kako deluje', '3x LinkedIn, 5x Twitter', 'Payment setup', 'Stripe demo'],
    ['Teden 8', 'PWA vs native app: zakaj PWA', '3x LinkedIn, 5x Twitter', 'Tech comparison', 'PWA demo'],
    ['Teden 9', 'Offline POS: zakaj nujno', '3x LinkedIn, 5x Twitter', 'Reliability guide', 'Offline demo'],
    ['Teden 10', '5 jezikov v POS: zakaj pomembno', '3x LinkedIn, 5x Twitter', 'i18n highlight', 'Language switcher'],
    ['Teden 11', 'Prvi customer story (interview)', '3x LinkedIn, 5x Twitter', 'Case study email', 'Customer interview'],
    ['Teden 12', 'Letni pregled in načrti 2026', '3x LinkedIn, 5x Twitter', 'Year-end newsletter', 'Year in review'],
], [50, 160, 130, 100, 80]))
story.append(C('Tabela 6.1: Content koledar za prvih 12 tednov'))
story.append(H2('6.2 SEO strategija'))
story.append(B('<b>Primary keywords:</b> "POS sistem restavracija", "FURS POS", "restavracijski software Slovenija"'))
story.append(B('<b>Long-tail:</b> "ceneji POS od Toast", "moderni FURS POS", "multi-tenant restavracija"'))
story.append(B('<b>Blog:</b> 2 tedensko (24 postov/leto), 1500+ besed vsak'))
story.append(B('<b>Landing pages:</b> 5-10 (po paketih, po use-case)'))
story.append(B('<b>Backlinks:</b> guest post na SLO tech blogih (RTV SLO, 24ur, Slo-Tech)'))
story.append(H2('6.3 Social media strategija'))
story.append(TBL([
    ['Platforma', 'Frekvenca', 'Tip vsebine', 'Cilj', 'Budget/mes'],
    ['LinkedIn', '3x/teden', 'B2B content, case studies, industry news', 'Lead gen, authority', '200 EUR (Ads)'],
    ['Twitter/X', '5x/teden', 'Tech tips, product updates, engagement', 'Brand awareness', '100 EUR'],
    ['Instagram', '3x/teden', 'Behind scenes, customer stories, UI screenshots', 'Brand humanization', '100 EUR'],
    ['YouTube', '1x/mesec', 'Tutorial videos, product demos, webinars', 'SEO, education', '300 EUR (production)'],
    ['Facebook', '2x/teden', 'Community, events, promotions', 'Local reach', '100 EUR (Ads)'],
], [100, 80, 200, 100, 70]))
story.append(C('Tabela 6.2: Social media strategija'))
story.append(PageBreak())

# 7. KPI
story.append(H1('7. KPI in metrike uspeha'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('7.1 Poslovni KPI'))
story.append(TBL([
    ['KPI', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    ['Aktivne stranke', '50', '100', '150', '200', '300'],
    ['MRR (EUR)', '2.450', '4.900', '7.350', '9.800', '14.700'],
    ['ARR (EUR)', '29.400', '58.800', '88.200', '117.600', '176.400'],
    ['Novih strank/mes', '17', '20', '20', '17', '30'],
    ['Churn rate', '0%', '5%', '5%', '5%', '4%'],
    ['ARPU (EUR/mes)', '49', '49', '49', '49', '49'],
    ['CAC (EUR)', '278', '200', '150', '120', '100'],
    ['LTV (EUR)', '1.176', '980', '980', '1.176', '1.470'],
    ['LTV:CAC ratio', '4.2', '4.9', '6.5', '9.8', '14.7'],
], [120, 70, 70, 70, 70, 70]))
story.append(C('Tabela 7.1: Poslovni KPI po četrtletjih'))
story.append(H2('7.2 Product KPI'))
story.append(TBL([
    ['KPI', 'Cilj', 'Trenutno', 'Merenje'],
    ['Daily Active Users (DAU)', '>500', '0', 'Mixpanel/PostHog'],
    ['Naročila/dan (vsi)', '>2.000', '0', 'DB count'],
    ['FURS uspešnost', '>99%', 'N/A', 'Custom metric'],
    ['Stripe plačila/dan', '>500', '0', 'Stripe API'],
    ['App load time (p95)', '<2s', '1.2s', 'Sentry Performance'],
    ['Uptime', '>99.5%', '99.9%', 'UptimeRobot'],
    ['Error rate', '<0.5%', '0.1%', 'Sentry'],
    ['NPS score', '>50', 'N/A', 'Kvartalni survey'],
    ['CSAT', '>4.5/5', 'N/A', 'Po onboarding'],
], [200, 80, 80, CONTENT_W-360]))
story.append(C('Tabela 7.2: Product KPI'))
story.append(H2('7.3 Marketing KPI'))
story.append(TBL([
    ['KPI', 'Cilj', 'Merenje'],
    ['Website visitors/mes', '5.000', 'Google Analytics'],
    ['Demo requests/mes', '80', 'CRM (HubSpot)'],
    ['Trial signups/mes', '50', 'DB count'],
    ['Trial-to-paid rate', '>40%', 'DB analysis'],
    ['Email open rate', '>30%', 'Mailchimp'],
    ['Email CTR', '>5%', 'Mailchimp'],
    ['LinkedIn followers', '2.000', 'LinkedIn Analytics'],
    ['Google Ads CTR', '>3%', 'Google Ads'],
    ['Google Ads CPL', '<80 EUR', 'Google Ads'],
], [200, 100, CONTENT_W-300]))
story.append(C('Tabela 7.3: Marketing KPI'))
story.append(PageBreak())

# 8. RISKS IN MITIGACIJE
story.append(H1('8. Tveganja in mitigacije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(TBL([
    ['Tveganje', 'Verjetnost', 'Vpliv', 'Mitigacija'],
    ['Toast vstop v EU (2026)', 'Srednja', 'Visok', 'Hitra širitev, 200 strank pred njihovim vstopom'],
    ['FURS spremembe zakonodaje', 'Srednja', 'Srednji', 'Agilen razvoj, 2 tedni lead time za adaptacijo'],
    ['Nezadostna ekipa za scale', 'Visoka', 'Visok', 'Hiring Q1 2026 (2. FTE developer)'],
    ['Nizka konverzija (cold outreach)', 'Srednja', 'Visok', 'A/B testiranje, inbound kanal (SEO/content)'],
    ['Churn > 10%', 'Nizka', 'Visok', 'Customer success program, QBR, proactive support'],
    ['Stripe provizije previsoke', 'Nizka', 'Srednji', 'Negotiate volume discount, SumUp backup'],
    ['Vercel/Neon downtime', 'Nizka', 'Visok', 'Multi-region, backup plan (self-host)'],
    ['Competitor copy features', 'Visoka', 'Nizki', 'Hitra iteracija, brand loyalty, switching costs'],
    ['Ekonomska recesija', 'Srednja', 'Srednji', 'Cenovno agresivno (49 EUR), freemium tier'],
    ['Talent drain (ključni ljudje)', 'Nizka', 'Visok', 'Equity, documentation, knowledge sharing'],
], [180, 70, 60, CONTENT_W-310]))
story.append(C('Tabela 8.1: Tveganja in mitigacije'))
story.append(PageBreak())

# 9. TIMELINE
story.append(H1('9. Timeline in milniki'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(TBL([
    ['Mesec', 'Milnik', 'Rezultat', 'Status'],
    ['Sep 2025', 'P0 implementacija začne', 'FURS + Stripe + PWA development', 'Načrtovano'],
    ['Okt 2025', 'Prvih 10 strank (beta)', 'Beta testing, feedback loop', 'Načrtovano'],
    ['Nov 2025', 'P0 končan, produkcija-ready', 'FURS cert + Stripe live + PWA', 'Načrtovano'],
    ['Dec 2025', '50 strank, 2.450 EUR MRR', 'Product-market fit validation', 'Načrtovano'],
    ['Jan 2026', 'EU širitev začne (HR)', 'Prva stranka izven SI', 'Načrtovano'],
    ['Feb 2026', '100 strank, 4.900 EUR MRR', 'Scale-up začne', 'Načrtovano'],
    ['Mar 2026', 'Partner program launch', '5 B2B2C partnerjev', 'Načrtovano'],
    ['Apr 2026', 'IT širitev (Italija)', 'Prva IT stranka, IVA integracija', 'Načrtovano'],
    ['Maj 2026', '150 strank, 7.350 EUR MRR', 'Series A priprava', 'Načrtovano'],
    ['Jun 2026', 'Series A fundraising', '500k-1M EUR raise', 'Načrtovano'],
    ['Jul 2026', 'Hiring (2. FTE, marketing)', 'Ekipa raste na 4 ljudi', 'Načrtovano'],
    ['Avg 2026', '200 strank, 9.800 EUR MRR', 'Break-even blizu', 'Načrtovano'],
    ['Sep 2026', 'Leto 1 obletnica, 300 strank', '14.700 EUR MRR, 176k ARR', 'Načrtovano'],
], [60, 200, 180, 80]))
story.append(C('Tabela 9.1: Timeline in milniki za 12 mesecev'))
story.append(CALLOUT('STRATEŠKI ZAKLJUČEK','RestaurantOS ima jasno priložnost na slovenskem trgu: edini moderni FURS-certificiran POS z multi-tenant arhitekturo in ceno 49 EUR. S 177k EUR investicijo v 12 mesecih lahko dosežemo 200 strank, 9.800 EUR MRR in break-even v 18 mesecih. Ključni uspešni faktorji: (1) hitra P0 implementacija do novembra, (2) agresiven direct sales (50 strank do decembra), (3) EU širitev v Q1 2026. Tveganja so znana in mitigirana.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Go-to-Market Strategy', author='Z.ai', subject='GTM strategija za komercialni launch', creator='Z.ai')
doc.multiBuild(story)
print(f'GTM body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
