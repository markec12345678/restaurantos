#!/usr/bin/env python3
"""RestaurantOS Client Onboarding Checklist - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/onboarding_body.pdf'

h1_style=ParagraphStyle('H1',fontName='NotoSerifSC-Bold',fontSize=20,leading=26,textColor=HEADER_FILL,spaceBefore=14,spaceAfter=10,alignment=TA_LEFT)
h2_style=ParagraphStyle('H2',fontName='NotoSerifSC-Bold',fontSize=14,leading=20,textColor=ACCENT,spaceBefore=12,spaceAfter=6,alignment=TA_LEFT)
h3_style=ParagraphStyle('H3',fontName='NotoSerifSC-Bold',fontSize=11.5,leading=16,textColor=TEXT_PRIMARY,spaceBefore=8,spaceAfter=4,alignment=TA_LEFT)
body_style=ParagraphStyle('Body',fontName='NotoSerifSC',fontSize=10.5,leading=16,textColor=TEXT_PRIMARY,spaceAfter=8,alignment=TA_LEFT,wordWrap='CJK')
bullet_style=ParagraphStyle('Bullet',fontName='NotoSerifSC',fontSize=10.5,leading=15,textColor=TEXT_PRIMARY,leftIndent=14,spaceAfter=4,alignment=TA_LEFT,wordWrap='CJK')
caption_style=ParagraphStyle('Caption',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_MUTED,alignment=TA_CENTER,spaceBefore=4,spaceAfter=14)
callout_t=ParagraphStyle('CT',fontName='NotoSerifSC-Bold',fontSize=11,leading=15,textColor=colors.white)
callout_b=ParagraphStyle('CB',fontName='NotoSerifSC',fontSize=10,leading=15,textColor=colors.white,wordWrap='CJK')
th_style=ParagraphStyle('TH',fontName='NotoSerifSC-Bold',fontSize=9.5,leading=12,textColor=colors.white,alignment=TA_CENTER)
tc_style=ParagraphStyle('TC',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_PRIMARY,alignment=TA_LEFT,wordWrap='CJK')
tcc_style=ParagraphStyle('TCC',fontName='NotoSerifSC',fontSize=9,leading=12,textColor=TEXT_PRIMARY,alignment=TA_CENTER,wordWrap='CJK')
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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Client Onboarding Checklist · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building Client Onboarding Checklist...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. POVZETEK
story.append(H1('1. Povzetek in časovni okvir'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Ta dokument vsebuje popoln postopek onboarding-a nove stranke v RestaurantOS. Namenjen je sales ekipi (Tech Lead + Account Manager) in stranki sami. Postopeek je razdeljen v 5 faz: (1) prvi stik in demo, (2) pogodba in setup, (3) tehnična konfiguracija, (4) usposabljanje osebja, (5) go-live in podpora.'))
story.append(P('Celoten postopek traja <b>3-4 tedne</b> od podpisa pogodbe do go-live. Kritična odvisnost je pridobitev FURS certifikata s strani stranke (2 tedna lead time prek ToZS portala). Brez FURS certifikata ni mogoče začeti prodajati računov slovenskim restavracijam.'))
story.append(SP(6))
story.append(STATS([
    ('5', 'faz onboarding-a'),
    ('3-4', 'tedne do go-live'),
    ('49', 'EUR/mesec osnovni paket'),
    ('2', 'tedna FURS lead time'),
]))
story.append(SP(12))
story.append(H2('1.1 Časovni okvir po fazah'))
story.append(TBL([
    ['Faza', 'Trajanje', 'Odgovornost', 'Rezultat'],
    ['1. Prvi stik in demo', '1-3 dni', 'Sales', 'Stranka zainteresirana, demo opravljen'],
    ['2. Pogodba in setup', '3-5 dni', 'Sales + Tech Lead', 'Pogodba podpisana, račun ustvarjen'],
    ['3. Tehnična konfiguracija', '7-14 dni', 'Tech Lead + stranka', 'FURS cert, Stripe, meni konfiguriran'],
    ['4. Usposabljanje osebja', '2-3 dni', 'Tech Lead + stranka', 'Osebje usposobljeno za POS'],
    ['5. Go-live in podpora', '1 dan + ongoing', 'Tech Lead', 'Produkcijska uporaba, support aktiven'],
], [120, 70, 130, CONTENT_W-320]))
story.append(C('Tabela 1.1: Časovni okvir onboarding faz'))
story.append(CALLOUT('KRITIČNA ODPORNOST','FURS certifikat! Stranka mora pridobiti FURS certifikat (.p12) prek ToZS portala (https://edavki.durs.si). Ta postopek traja 10-14 delovnih dni. Brez certifikata RestaurantOS ne more potrjevati računov - kar je blokator za go-live. Priporočamo, da se stranka s postopkom začne ŽE PRED podpisom pogodbe.', SEM_ERROR))
story.append(PageBreak())

# 2. FAZA 1: PRVI STIK
story.append(H1('2. Faza 1: Prvi stik in demo (1-3 dni)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Prvi stik s potencialno stranko. Cilj: razumeti potrebe stranke, predstaviti RestaurantOS in dogovoriti se za demo.'))
story.append(H2('2.1 Kontroli seznam za prvi klic (30 min)'))
story.append(B('☐ <b>Razumevanje poslovanja</b> - vrsta restavracije (fine dining, fast food, kavarna), št. lokacij, št. zaposlenih, dnevni obseg'))
story.append(B('☐ <b>Trenutni sistem</b> - kateri POS uporabljajo, zadovoljstvo, pain points'))
story.append(B('☐ <b>FURS status</b> - ali imajo veljaven FURS certifikat, kdaj poteče'))
story.append(B('☐ <b>Plačilne potrebe</b> - ali sprejemajo kartice, kateri terminal, dnevni obseg kartic'))
story.append(B('☐ <b>Budget</b> - koliko so pripravljeni plačati mesečno, enkratni setup budget'))
story.append(B('☐ <b>Časovni okvir</b> - kdaj želijo go-live, ali imajo rok (npr. odprtje nove lokacije)'))
story.append(B('☐ <b>Odločevalci</b> - kdo odloča (lastnik, manager, IT), kdo bo uporabljal sistem'))
story.append(B('☐ <b>Konkurenca</b> - katere druge POS rešitve preverjajo'))
story.append(H2('2.2 Demo priprava'))
story.append(P('Demo se izvede preko Zoom/Google Meet (45-60 minut). Uporablja se staging environment s seedanimi demo podatki.'))
story.append(CODE('''# Demo URL (staging):
https://restaurantos-staging.vercel.app

# Demo PIN kode:
Admin: 1234 (vsi moduli, konfiguracija)
Super-admin: 5555 (cross-branch, audit)
Natakar: 0000 (naročila, plačila)

# Demo scenarij (45 min):
1. (5 min) Predstavitev - kdo smo, kaj rešujemo, cena
2. (10 min) POS - nova naročila, mize, modifikatorji
3. (5 min) Plačilo - gotovina + kartica (Stripe demo)
4. (5 min) FURS - ZOI, EOR, QR koda na računu
5. (5 min) Kuhinja - KDS (če implementirano) ali papirni boni
6. (5 min) Admin - poročila, zaloge, uporabniki
7. (5 min) Mobile - PWA na tablici, offline mode
8. (5 min) Q&A in naslednji koraki'''))
story.append(H2('2.3 Po demo-u'))
story.append(B('☐ Pošlji "hvala" email z povzetkom demo-a in link do PDF poročila'))
story.append(B('☐ Pošlji predlog pogodbe (glej Phase 2)'))
story.append(B('☐ Dogovori se za follow-up klic v 3-5 dneh'))
story.append(B('☐ Dodaj stranko v CRM (HubSpot/Notion) z statusom "Demo opravljeno"'))
story.append(B('☐ Če stranka odloži - dodaj v "nurture" sekvenco (email vsakih 14 dni)'))
story.append(PageBreak())

# 3. FAZA 2: POGODBA
story.append(H1('3. Faza 2: Pogodba in setup (3-5 dni)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Po dogovoru o sodelovanju sledi podpis pogodbe in tehnični setup računa.'))
story.append(H2('3.1 Paketi in cene'))
story.append(TBL([
    ['Paket', 'Mesečna cena', 'Setup', 'Vključeno', 'Brezplačno obdobje'],
    ['Basic', '49 EUR/mes', '0 EUR', 'POS, FURS, offline, 1 lokacija, 5 jezikov', '14 dni'],
    ['Pro', '99 EUR/mes', '0 EUR', 'Basic + Stripe, KDS, loyalty, 3 lokacije', '14 dni'],
    ['Enterprise', 'Po dogovoru', '500-2000 EUR', 'Pro + neomejene lokacije, white-label, SLA', '30 dni'],
    ['Add-on: Stripe', '0 EUR', '0 EUR', 'Transakcijska provizija 1.5% + 0.18 EUR', '-'],
    ['Add-on: Custom integracija', 'Po dogovoru', '500-2000 EUR', 'QuickBooks, Panora, custom API', '-'],
], [90, 80, 70, CONTENT_W-340, 80]))
story.append(C('Tabela 3.1: Paketi in cene (september 2025)'))
story.append(H2('3.2 Pogodba - ključne klavzule'))
story.append(B('<b>Predmet pogodbe:</b> mesečna licenca za RestaurantOS SaaS storitev'))
story.append(B('<b>Trajanje:</b> 12 mesecev, nato mesečna podaljšanja (brez lock-in)'))
story.append(B('<b>Cancel policy:</b> 30-dnevni odpovedni rok, brez penalov'))
story.append(B('<b>Plačilo:</b> mesečno predračunno (TRR ali kartica)'))
story.append(B('<b>SLA:</b> 99.5% uptime, odzivni čas 4h (delovni čas), 24h (SEV-1)'))
story.append(B('<b>Podatki:</b> GDPR skladnost, lastništvo podatkov pri stranki, izvoz na zahtevo'))
story.append(B('<b>Support:</b> email (24h odziv), telefon (delovni čas), Slack channel (Pro+)'))
story.append(B('<b>Poslovna tajnost:</b> NDA velja za obdobje pogodbe + 3 leta po'))
story.append(H2('3.3 Setup računa'))
story.append(P('Po podpisu pogodbe Tech Lead ustvari račun za stranko:'))
story.append(CODE('''# Setup postopek (1 dan):
1. Ustvari Location v bazi (admin UI → Locations → Add)
2. Ustvari admin uporabnika za stranko (PIN, ime, email)
3. Konfiguriraj RestaurantSettings:
   - Ime restavracije, naslov, matična številka
   - Davčna številka (za FURS)
   - Register number, premises ID
4. Nastavi environment:
   - Vercel: ustvari environment variables za to stranko
   - Stripe: dodaj stranko v Stripe customer (če Pro paket)
5. Pošlji dobrodošli email z:
   - URL do aplikacije
   - Admin PIN kodo
   - Link do onboarding guide
   - Kontakt za support'''))
story.append(H2('3.4 Dobrodošli email predloga'))
story.append(CODE('''Subject: Dobrodošli v RestaurantOS! 🎉

Spoštovani/a [Ime],

Dobrodošli v RestaurantOS! Veselimo se sodelovanja z [Ime restavracije].

Vaš račun je pripravljen:
- URL: https://restaurantos.app
- Admin PIN: [PIN] (zaženite setup v aplikaciji)
- Paket: [Basic/Pro/Enterprise]

Naslednji koraki:
1. Prijavite se z admin PIN kodo
2. Konfigurirajte restavracijo (Settings → Restaurant)
3. Pridobite FURS certifikat (čim prej - 2 tedna lead time!)
   Navodila: https://edavki.durs.si
4. Upload certifikata v aplikacijo (Settings → FURS)
5. Konfigurirajte meni in mize

Podpora:
- Email: support@restaurantos.app (24h odziv)
- Telefon: +386 1 XXX XXX (pon-pet 9-17h)
- Dokumentacija: github.com/markec12345678/restaurantos

Naslednji sestanek: [datum] ob [ura] (Zoom)
Namen: tehnična konfiguracija in FURS setup

Lep pozdrav,
Robert Pezdirc
Tech Lead, RestaurantOS'''))
story.append(PageBreak())

# 4. FAZA 3: TEHNIČNA KONFIGURACIJA
story.append(H1('4. Faza 3: Tehnična konfiguracija (7-14 dni)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Najdaljša faza - vključuje pridobitev FURS certifikata, Stripe setup in konfiguracijo menija/miz. Teh Lead vodi proces, stranka zagotovi potrebne dokumente.'))
story.append(H2('4.1 FURS certifikat (KRITIČNO - 10-14 dni)'))
story.append(P('FURS certifikat je obvezen za davčno potrjevanje računov v Sloveniji. Brez njega RestaurantOS ne more delovati v produkciji.'))
story.append(H3('Postopek pridobivanja (stranka)'))
story.append(B('<b>Korak 1:</b> Stranka se prijavi na https://edavki.durs.si z davčno številko'))
story.append(B('<b>Korak 2:</b> Navigira na "eDavki → Digitalna potrdila"'))
story.append(B('<b>Korak 3:</b> Izbere "Zahtevek za certifikat za davčno potrjevanje računov"'))
story.append(B('<b>Korak 4:</b> Izpolni obrazec (podatki o podjetju, premises ID)'))
story.append(B('<b>Korak 5:</b> FURS obdela zahtevek (5-10 delovnih dni)'))
story.append(B('<b>Korak 6:</b> Stranka prejme .p12 datoteko z geslom prek eDavki portala'))
story.append(B('<b>Korak 7:</b> Stranka posreduje .p12 + geslo Tech Lead-u (varno!)'))
story.append(H3('Upload certifikata (Tech Lead)'))
story.append(CODE('''# Upload prek Admin UI:
1. Prijavi se kot admin
2. Settings → FURS → Upload certifikat
3. Izberi .p12 datoteko
4. Vnesi geslo
5. Izberi okolje: "test" (za začetek)
6. Klikni "Naloži"

# Testiranje v FURS TEST okolju:
1. Ustvari testno naročilo (1 EUR)
2. Preveri, ali se ZOI generira
3. Preveri, ali FURS vrne EOR
4. Preveri cert-status API

# Po uspešnem testu → preklop na PRODUKCIJO:
1. Stranka pridobi PRODUKCIJSKI certifikat (isti postopek)
2. Upload produkcijski .p12
3. Izberi okolje: "production"
4. Izdaj testni račun 1 EUR v produkciji
5. Preveri na FURS eDavki portalu, ali je račun viden'''))
story.append(H2('4.2 Stripe setup (če Pro paket)'))
story.append(P('Stripe integracija omogoča kartična plačila neposredno v POS. Stranka mora ustvariti Stripe račun.'))
story.append(H3('Postopek Stripe registracije (stranka)'))
story.append(B('<b>Korak 1:</b> Stranka obišče https://dashboard.stripe.com/register'))
story.append(B('<b>Korak 2:</b> Izpolni podatke o podjetju (naziv, davčna številka, naslov)'))
story.append(B('<b>Korak 3:</b> Doda bančni račun za izplacila (IBAN)'))
story.append(B('<b>Korak 4:</b> KYC verifikacija (1-3 delovne dni) - upload dokumentov'))
story.append(B('<b>Korak 5:</b> Po odobritvi - pridobi API ključe:'))
story.append(B('   - Secret key: sk_live_... (strogo zaupno!)'))
story.append(B('   - Publishable key: pk_live_... (client-side)'))
story.append(B('   - Webhook secret: whsec_... (po dodajanju webhook endpointa)'))
story.append(H3('Stripe konfiguracija (Tech Lead)'))
story.append(CODE('''# 1. Dodaj Stripe ključe v Vercel environment:
# Vercel → Settings → Environment Variables
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 2. Registriraj webhook endpoint:
# Stripe Dashboard → Developers → Webhooks → Add endpoint
# URL: https://restaurantos.app/api/payment-gateways/webhook
# Events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded

# 3. Testiranje:
# - Uporabi Stripe test kartico 4242 4242 4242 4242
# - Izvedi testno plačilo 0.50 EUR
# - Preveri, ali je Payment.status="completed" v DB
# - Preveri Sentry za webhook events'''))
story.append(H2('4.3 Konfiguracija menija in miz'))
story.append(P('Stranka konfigurira svoj meni, mize in cene. To lahko traja 1-3 dni, odvisno od velikosti menija.'))
story.append(TBL([
    ['Komponenta', 'Kdo naredi', 'Trajanje', 'Opis'],
    ['Restaurant Settings', 'Tech Lead', '15 min', 'Ime, naslov, davčna številka, register number'],
    ['Tax Rates (DDV)', 'Tech Lead', '10 min', '22% standardna, 9.5% znižana, 0% oproščena'],
    ['Kategorije menija', 'Stranka', '30 min', 'Predjedi, glavne jedi, pijače, sladice'],
    ['Artikli', 'Stranka', '2-4 ure', 'Ime, cena, DDV, alergeni, slika (optional)'],
    ['Modifikatorji', 'Stranka', '1-2 uri', 'Velikost (S/M/L), dodatki, brez (gluten, laktoza)'],
    ['Mize', 'Stranka', '30 min', 'Številka, kapaciteta, sektorji'],
    ['Uporabniki (osebje)', 'Tech Lead + stranka', '30 min', 'PIN kode, vloge (natakar, kuhar, manager)'],
    ['Printer setup', 'Tech Lead', '30 min', 'Tiskalnik računov + tiskalnik kuhinjskih bonov'],
], [120, 110, 70, CONTENT_W-300]))
story.append(C('Tabela 4.1: Konfiguracijski task-i'))
story.append(H2('4.4 Hardware priporočila'))
story.append(TBL([
    ['Komponenta', 'Priporočilo', 'Cena', 'Kje kupiti'],
    ['Tablica (POS)', 'iPad 10.2" 64GB ali Samsung Galaxy Tab A8', '300-400 EUR', 'Mimovrste, Big Bang'],
    ['Tablica (natakar)', 'iPad Mini 6 ali Android 8"', '250-350 EUR', 'Mimovrste, Big Bang'],
    ['Tiskalnik računov', 'Epson TM-m30 (Bluetooth) ali Star TSP143', '200-300 EUR', 'Farnell, RS Components'],
    ['Tiskalnik bonov', 'Epson TM-T20 (USB) ali Star TSP100', '150-250 EUR', 'Farnell, RS Components'],
    ['Kartični terminal', 'Stripe Terminal (Sunmi P2) ali SumUp Air', '99-200 EUR', 'stripe.com/terminal, sumup.si'],
    ['Silver drawer', 'POS Microcash ali custom', '50-100 EUR', 'Mimovrste'],
    ['Mize QR kode', 'Print na domu ali tiskarna', '10-30 EUR', 'Custom'],
], [120, 200, 80, CONTENT_W-400]))
story.append(C('Tabela 4.2: Hardware priporočila'))
story.append(PageBreak())

# 5. FAZA 4: USPOSABLJANJE
story.append(H1('5. Faza 4: Usposabljanje osebja (2-3 dni)'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Usposabljanje osebja stranke za vsakdanjo uporabo RestaurantOS. Izvede se na lokaciji stranke (ali prek Zoom-a za oddaljene stranke).'))
story.append(H2('5.1 Dan 1: Admin usposabljanje (3 ure)'))
story.append(P('Usposabljanje za lastnika/managerja - admin funkcionalnosti.'))
story.append(TBL([
    ['Ura', 'Tema', 'Aktivnost'],
    ['0:00-0:15', 'Uvod in prijava', 'Pregled sistema, admin PIN, navigacija'],
    ['0:15-0:45', 'POS osnove', 'Nova naročila, mize, modifikatorji, split bill'],
    ['0:45-1:15', 'Plačila', 'Gotovina, kartica (Stripe), napitnina, storno'],
    ['1:15-1:30', 'Odmor', '-'],
    ['1:30-2:00', 'FURS in računi', 'ZOI, EOR, QR koda, storno račun, e-invoice book'],
    ['2:00-2:30', 'Zaloge', 'Artikli, dobavitelji, inventura, recepture'],
    ['2:30-3:00', 'Poročila in admin', 'Dnevna prodaja, Z-report, uporabniki, nastavitve'],
], [50, 130, CONTENT_W-180]))
story.append(C('Tabela 5.1: Dan 1 - Admin usposabljanje'))
story.append(H2('5.2 Dan 2: Osebje usposabljanje (2 uri)'))
story.append(P('Usposabljanje za natakarje in kuharje - vsakodnevne operacije.'))
story.append(TBL([
    ['Ura', 'Tema', 'Aktivnost'],
    ['0:00-0:20', 'Prijava in navigacija', 'Natakar PIN, izbira mize, iskanje artiklov'],
    ['0:20-0:50', 'Naročanje', 'Dodajanje artiklov, modifikatorji, pošiljanje v kuhinjo'],
    ['0:50-1:00', 'Odmor', '-'],
    ['1:00-1:30', 'Plačila', 'Gotovina, kartica, split bill, napitnina'],
    ['1:30-2:00', 'Situacije', 'Storno, povratna blaga, discount, complaint handling'],
], [50, 130, CONTENT_W-180]))
story.append(C('Tabela 5.2: Dan 2 - Osebje usposabljanje'))
story.append(H2('5.3 Dan 3: Testni dan (soft opening)'))
story.append(P('Stranka izvede "soft opening" - testni dan z majhnim številom gostov (npr. samo prijatelji in družina). Tech Lead je na voljo za support.'))
story.append(B('☐ Odpri izmeno (Cash Register → Odpri)'))
story.append(B('☐ Sprejmi 5-10 testnih naročil'))
story.append(B('☐ Izvedi 5 testnih plačil (gotovina + kartica)'))
story.append(B('☐ Preveri FURS potrjevanje (EOR prejet za vse račune)'))
story.append(B('☐ Preveri tiskanje računov in kuhinjskih bonov'))
story.append(B('☐ Zapri izmeno (Z-Report)'))
story.append(B('☐ Preglej poročila (dnevna prodaja, FURS report)'))
story.append(B('☐ Identificiraj pain points in jih zapiši'))
story.append(B('☐ Tech Lead na voljo za support (telefon + Slack)'))
story.append(PageBreak())

# 6. FAZA 5: GO-LIVE
story.append(H1('6. Faza 5: Go-live in podpora'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Uradni začetek produkcijske uporabe. Tech Lead je na voljo prvi teden za intenzivno podporo.'))
story.append(H2('6.1 Go-live checklist'))
story.append(B('☐ FURS produkcija certifikat naložen (preverjeno z GET /api/furs/cert-status)'))
story.append(B('☐ FURS_ENV=production v Vercel environment'))
story.append(B('☐ Stripe live keys konfigurirani (sk_live_..., pk_live_...)'))
story.append(B('☐ Stripe webhook endpoint registriran in testiran'))
story.append(B('☐ Vse mize konfigurirane s pravilnimi številkami'))
story.append(B('☐ Vsi artikli imajo pravilno DDV stopnjo (22%, 9.5%, 0%)'))
story.append(B('☐ Vsi natakarji imajo svoje PIN kode in vloge'))
story.append(B('☐ Tiskalniki povezani in testirani (računi + kuhinjski boni)'))
story.append(B('☐ Hardware na lokaciji nameščen (tablice, terminali)'))
story.append(B('☐ Osebje usposobljeno (vsaj 1 dan treninga)'))
story.append(B('☐ Sentry monitoring aktiven'))
story.append(B('☐ UptimeRobot monitoring aktiven na /api/health'))
story.append(B('☐ Slack channel s stranko odprt (za hitro komunikacijo)'))
story.append(B('☐ Backup strategija aktivna (Neon daily snapshot)'))
story.append(B('☐ Support kontakti poslani stranki (email, telefon)'))
story.append(H2('6.2 Prvi teden podpora (intenzivna)'))
story.append(P('Tech Lead je na voljo 24/7 v prvem tednu po go-live za kritične incidente.'))
story.append(TBL([
    ['Dan', 'Aktivnost', 'Odgovornost'],
    ['Dan 1 (go-live)', 'Na lokaciji ali na voljo telefon', 'Tech Lead + stranka'],
    ['Dan 2', 'Follow-up klic, pregled napak', 'Tech Lead'],
    ['Dan 3', 'Pregled Sentry, optimizacija', 'Tech Lead'],
    ['Dan 4', 'Pregled poslovanja, poročila', 'Stranka'],
    ['Dan 5', 'Zaključni sestanek, feedback', 'Tech Lead + stranka'],
    ['Dan 7', 'Prehod na normalni support model', 'Tech Lead'],
], [120, 200, CONTENT_W-320]))
story.append(C('Tabela 6.1: Prvi teden po go-live'))
story.append(H2('6.3 Support model (po prvem tednu)'))
story.append(TBL([
    ['Kanal', 'Odzivni čas', 'Namen', 'Cena'],
    ['Email (support@restaurantos.app)', '24h (delovni čas)', 'Splošna vprašanja, ne-urgent', 'Vključeno'],
    ['Telefon (+386 1 XXX)', '2h (pon-pet 9-17h)', 'Urgent težave, blokada dela', 'Vključeno'],
    ['Slack channel', '1h (delovni čas)', 'Hitra komunikacija, screenshot-i', 'Pro+ paket'],
    ['24/7 on-call', '15 min (SEV-1)', 'Kritični incidenti (FURS ne deluje)', 'Enterprise'],
    ['On-site obisk', 'Po dogovoru', 'Hardware setup, trening', '200 EUR/obisk'],
], [180, 100, 150, 80]))
story.append(C('Tabela 6.2: Support kanali in odzivni časi'))
story.append(PageBreak())

# 7. DNEVNO DELO STRANKE
story.append(H1('7. Dnevno delo stranke'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Priročnik za vsakodnevno uporabo RestaurantOS. Ta sekcija je namenjena direktno stranki - izpisana naj bo in prilepljena ob POS terminalu.'))
story.append(H2('7.1 Odprtje izmene (zjutraj)'))
story.append(CODE('''1. Prijavi se z admin PIN (1234)
2. Pojdi v Cash Register
3. Preveri datum in uro
4. Vnesi začetno stanje gotovine (npr. 200 EUR)
5. Klikni "Odpri izmeno"
6. Preveri, ali so vse mize proste
7. Aktiviraj natakarje (vsak se prijavi s svojim PIN)'''))
story.append(H2('7.2 Sprejemanje naročil'))
story.append(CODE('''1. Natakar se prijavi s svojim PIN
2. Izbere mizo (klik na mizo na tlorisu)
3. Klikne "Novo naročilo"
4. Dodaja artikle (klik na artikel v meniju)
5. Doda modifikatorje (brez glutena, dodatki, velikost)
6. Potrdi naročilo → kuhinjski bon se natisne
7. Ko je hrana pripravljena, kuhar označi "Pripravljeno"
8. Natakar postreže'''))
story.append(H2('7.3 Plačilo'))
story.append(CODE('''1. Natakar klikne mizo → "Plačaj"
2. Izbere način plačila:
   a) Gotovina: vnese znesek, sistem izračuna vračilo
   b) Kartica: klikne "Kartica", vnese podatke v Stripe terminal
   c) Deljeno: razdeli račun na več načinov
3. Klikne "Potrdi plačilo"
4. Račun se natisne (z ZOI in QR kodo)
5. FURS avtomatsko potrjen (EOR prejet)
6. Miza se sprosti'''))
story.append(H2('7.4 Zapiranje izmene (zvečer)'))
story.append(CODE('''1. Vsi natakarji se odjavijo
2. Admin se prijavi
3. Pojdi v Cash Register → "Zapri izmeno"
4. Preveri:
   - Število računov
   - Skupni promet
   - Gotovina (preštej blagajno)
   - Kartice (preveri s Stripe dashboard)
5. Vnesi dejansko stanje gotovine
6. Klikni "Zapri izmeno"
7. Natisni Z-Report (dnevno poročilo)
8. Pošlji Z-Report na email (za računovodstvo)'''))
story.append(H2('7.5 Tedenske naloge (ponedeljek zjutraj)'))
story.append(B('☐ Preglej tedensko poročilo prodaje'))
story.append(B('☐ Preveri zaloge (naroči potrebne artikle)'))
story.append(B('☐ Preveri FURS report (ali so vsi računi potrjeni)'))
story.append(B('☐ Backup podatkov (če ima local install)'))
story.append(B('☐ Posodobi meni (če so nove cene/artikli)'))
story.append(B('☐ Preveri Sentry (ali so bile napake v preteklem tednu)'))
story.append(PageBreak())

# 8. FAQ IN TROUBLESHOOTING
story.append(H1('8. FAQ in troubleshooting'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Pogosta vprašanja strank in rešitve za najpogostejše težave.'))
story.append(H2('8.1 Pogosta vprašanja'))
story.append(H3('Q: Kaj če izgubim internet?'))
story.append(P('<b>A:</b> RestaurantOS deluje v offline mode. Naročila se shranjujejo lokalno (IndexedDB) in sinhronizirajo, ko se povezava povrne. FURS zahtevki se pošljejo z zamikom (FURS dovoli 48h). Natakarji lahko normalno sprejemajo naročila in plačila (gotovina). Kartična plačila ne delujejo brez interneta.'))
story.append(H3('Q: Kaj če FURS ne deluje?'))
story.append(P('<b>A:</b> RestaurantOS avtomatsko preklopi v offline FURS mode. Računi se izdajo z začasnim EOR-om in se sinhronizirajo kasneje. Če FURS ne deluje več kot 24h, kontaktiraj support (telefon). Preveri tudi veljavnost certifikata (Settings → FURS → Status).'))
story.append(H3('Q: Kaj če tiskalnik ne deluje?'))
story.append(P('<b>A:</b> 1) Preveri, ali je tiskalnik priključen in vklopljen. 2) Preveri Bluetooth/USB povezavo. 3) Restart tablice. 4) Restart tiskalnika. 5) Če ne deluje, račun lahko pošlješ na email gostu. 6) Kontaktiraj support, če problem persistent.'))
story.append(H3('Q: Kaj če Stripe plačilo ne uspe?'))
story.append(P('<b>A:</b> 1) Preveri, ali je kartica veljavna (datum, sredstva). 2) Preveri internet povezavo. 3) Poskusi ponovno. 4) Če ne uspe, predlagaj gotovino ali drugo kartico. 5) Preveri Stripe Dashboard za podrobnosti. 6) Če je problem v sistemu, kontaktiraj support.'))
story.append(H3('Q: Kako spremenim ceno artikla?'))
story.append(P('<b>A:</b> Admin → Menu → Items → izberi artikel → spremeni ceno → shrani. Sprememba je takoj aktivna. Če spremeniš DDV stopnjo, se spremeni za vse prihodnje račune (predhodni ostanejo nespremenjeni).'))
story.append(H3('Q: Kako dodam novega natakarja?'))
story.append(P('<b>A:</b> Admin → Users → Add user → izpolni ime, PIN, vlogo (natakar) → shrani. Natakar se lahko takoj prijavi s svojim PIN. PIN mora biti 4-mesten in unikaten.'))
story.append(H3('Q: Kako natisnem dnevno poročilo?'))
story.append(P('<b>A:</b> Admin → Reports → Daily Report → izberi datum → klikni "Print". Poročilo vsebuje: št. računov, skupni promet, razčlenitev po DDV, razčlenitev po načinu plačila, top artikli.'))
story.append(H2('8.2 Kontakti za podporo'))
story.append(TBL([
    ['Tip težave', 'Kontaktiraj', 'Odzivni čas'],
    ['Splošno vprašanje', 'support@restaurantos.app', '24h'],
    ['Urgent (blokada dela)', '+386 1 XXX XXX (telefon)', '2h (delovni čas)'],
    ['Kritično (FURS/Stripe ne deluje)', '+386 41 XXX XXX (on-call)', '15 min (24/7)'],
    ['Hardware težava', 'support@restaurantos.app', '24h'],
    ['Billing vprašanja', 'finance@restaurantos.app', '48h'],
    ['Feature request', 'product@restaurantos.app', '1 teden'],
], [200, 200, 100]))
story.append(C('Tabela 8.1: Kontakti za podporo'))
story.append(PageBreak())

# 9. ONBOARDING MATRIKA
story.append(H1('9. Onboarding matrika - kontrolni seznam'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Popoln kontrolni seznam vseh onboarding korakov. Uporablja se za sledenje napredka vsake stranke.'))
story.append(H2('9.1 Skupni kontrolni seznam (40 točk)'))
story.append(TBL([
    ['#', 'Faza', 'Korak', 'Odgovornost', 'Status'],
    ['1', 'Faza 1', 'Prvi klic opravljen', 'Sales', '☐'],
    ['2', 'Faza 1', 'Demo opravljen', 'Sales', '☐'],
    ['3', 'Faza 1', 'Follow-up email poslan', 'Sales', '☐'],
    ['4', 'Faza 1', 'Stranka dodana v CRM', 'Sales', '☐'],
    ['5', 'Faza 2', 'Predloga pogodbe poslana', 'Sales', '☐'],
    ['6', 'Faza 2', 'Pogodba podpisana', 'Sales + stranka', '☐'],
    ['7', 'Faza 2', 'Račun ustvarjen (Vercel)', 'Tech Lead', '☐'],
    ['8', 'Faza 2', 'Location v bazi ustvarjena', 'Tech Lead', '☐'],
    ['9', 'Faza 2', 'Admin uporabnik ustvarjen', 'Tech Lead', '☐'],
    ['10', 'Faza 2', 'Dobrodošli email poslan', 'Tech Lead', '☐'],
    ['11', 'Faza 3', 'FURS certifikat - zahtevek oddan', 'Stranka', '☐'],
    ['12', 'Faza 3', 'FURS certifikat prejet (.p12)', 'Stranka', '☐'],
    ['13', 'Faza 3', 'FURS test certifikat naložen', 'Tech Lead', '☐'],
    ['14', 'Faza 3', 'FURS testno okolje validirano', 'Tech Lead', '☐'],
    ['15', 'Faza 3', 'FURS produkcija cert naložen', 'Tech Lead', '☐'],
    ['16', 'Faza 3', 'FURS produkcija testiran (1 EUR)', 'Tech Lead', '☐'],
    ['17', 'Faza 3', 'Stripe račun registriran', 'Stranka', '☐'],
    ['18', 'Faza 3', 'Stripe KYC odobren', 'Stranka', '☐'],
    ['19', 'Faza 3', 'Stripe API ključi pridobljeni', 'Stranka', '☐'],
    ['20', 'Faza 3', 'Stripe ključi v Vercel env', 'Tech Lead', '☐'],
    ['21', 'Faza 3', 'Stripe webhook registriran', 'Tech Lead', '☐'],
    ['22', 'Faza 3', 'Stripe test plačilo (0.50 EUR)', 'Tech Lead', '☐'],
    ['23', 'Faza 3', 'Restaurant Settings konfigurirani', 'Tech Lead', '☐'],
    ['24', 'Faza 3', 'DDV stopnje nastavljene', 'Tech Lead', '☐'],
    ['25', 'Faza 3', 'Kategorije menija ustvarjene', 'Stranka', '☐'],
    ['26', 'Faza 3', 'Artikli vnešeni', 'Stranka', '☐'],
    ['27', 'Faza 3', 'Mize konfigurirane', 'Stranka', '☐'],
    ['28', 'Faza 3', 'Uporabniki (osebje) ustvarjeni', 'Tech Lead', '☐'],
    ['29', 'Faza 3', 'Tiskalniki povezani', 'Tech Lead', '☐'],
    ['30', 'Faza 4', 'Admin usposabljanje (3 ure)', 'Tech Lead', '☐'],
    ['31', 'Faza 4', 'Osebje usposabljanje (2 uri)', 'Tech Lead', '☐'],
    ['32', 'Faza 4', 'Soft opening (testni dan)', 'Stranka + Tech Lead', '☐'],
    ['33', 'Faza 5', 'Go-live checklist - vse ✅', 'Tech Lead', '☐'],
    ['34', 'Faza 5', 'Sentry monitoring aktiven', 'Tech Lead', '☐'],
    ['35', 'Faza 5', 'UptimeRobot aktiven', 'Tech Lead', '☐'],
    ['36', 'Faza 5', 'Slack channel odprt', 'Tech Lead', '☐'],
    ['37', 'Faza 5', 'Prvi delovni dan (go-live)', 'Stranka', '☐'],
    ['38', 'Faza 5', 'Dan 2 follow-up klic', 'Tech Lead', '☐'],
    ['39', 'Faza 5', 'Dan 5 zaključni sestanek', 'Tech Lead + stranka', '☐'],
    ['40', 'Faza 5', 'Prehod na normalni support', 'Tech Lead', '☐'],
], [25, 50, 200, 110, 50]))
story.append(C('Tabela 9.1: Onboarding kontrolni seznam (40 točk)'))
story.append(CALLOUT('DEFINITION OF DONE','Onboarding je zaključen, ko so vse 40 točk označene kot ✅. Stranka je nato v "active" statusu in preide na normalni support model. Mesečno se izvede QBR (Quarterly Business Review) za pregled zadovoljstva in priložnosti za širitev.', SEM_SUCCESS))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Client Onboarding Checklist', author='Z.ai', subject='Sales onboarding guide', creator='Z.ai')
doc.multiBuild(story)
print(f'Onboarding body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
