#!/usr/bin/env python3
"""RestaurantOS Architecture Decision Records (ADR) - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/adr_body.pdf'

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

def adr_header(adr_id, title, status, date):
    """Build ADR header block."""
    status_color = SEM_SUCCESS if status == 'Accepted' else (SEM_WARNING if status == 'Superseded' else SEM_ERROR)
    data = [
        [Paragraph(f'<b>{adr_id}</b>', ParagraphStyle('aid', fontName='SarasaMonoSC', fontSize=14, textColor=ACCENT, alignment=TA_LEFT)),
         Paragraph(f'<b>{title}</b>', ParagraphStyle('at', fontName='NotoSerifSC-Bold', fontSize=14, textColor=TEXT_PRIMARY, alignment=TA_LEFT)),
         Paragraph(f'<b>{status}</b>', ParagraphStyle('as', fontName='NotoSerifSC-Bold', fontSize=10, textColor=colors.white, alignment=TA_CENTER, backColor=status_color))],
        [Paragraph(f'<b>Datum:</b> {date}', ParagraphStyle('ad', fontName='NotoSerifSC', fontSize=9, textColor=TEXT_MUTED, alignment=TA_LEFT)), '', ''],
    ]
    t = Table(data, colWidths=[80, CONTENT_W-200, 120])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), CARD_BG),
        ('BACKGROUND', (2,0), (2,0), status_color),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('SPAN', (0,1), (2,1)),
    ]))
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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Architecture Decision Records · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building ADR collection...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod v ADR'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Architecture Decision Records (ADR) so kratki dokumenti, ki beležijo ključne tehnične odločitve v projektu. Vsak ADR odgovarja na vprašanja: zakaj smo se odločili za X in ne Y? Kaj so bile alternative? Kakšne so posledice?'))
story.append(P('Ta zbirka vsebuje <b>12 ključnih ADR-jev</b> za RestaurantOS v1.0.0. ADR-ji so razvrščeni po datumu sprejema (od najstarejšega do najnovejšega). Vsak ADR ima standardno strukturo: kontekst, odločitev, alternative, posledice.'))
story.append(H2('1.1 Struktura vsakega ADR-ja'))
story.append(B('<b>ID:</b> ADR-XXX (zaporedna številka)'))
story.append(B('<b>Naslov:</b> kratek opis odločitve'))
story.append(B('<b>Status:</b> Accepted / Superseded / Deprecated'))
story.append(B('<b>Datum:</b> kdaj je bila odločitev sprejeta'))
story.append(B('<b>Kontekst:</b> zakaj smo odločali (problem, zahteve, omejitve)'))
story.append(B('<b>Odločitev:</b> kaj smo se odločili (konkretna izbira)'))
story.append(B('<b>Alternative:</b> kaj smo zavrnili in zakaj (vsaj 2-3 alternative)'))
story.append(B('<b>Posledice:</b> good (prednosti), bad (slabosti), neutral (nevtralno)'))
story.append(H2('1.2 Seznam vseh ADR-jev'))
story.append(TBL([
    ['ID', 'Naslov', 'Status', 'Datum'],
    ['ADR-001', 'Next.js 16 + React 19 kot frontend framework', 'Accepted', '2025-01-15'],
    ['ADR-002', 'Neon PostgreSQL (serverless) kot glavna baza', 'Accepted', '2025-01-20'],
    ['ADR-003', 'Prisma ORM za databasno dostop', 'Accepted', '2025-01-22'],
    ['ADR-004', 'Multi-tenant arhitektura z locationId izolacijo', 'Accepted', '2025-02-01'],
    ['ADR-005', 'PIN-based auth namesto JWT/session', 'Accepted', '2025-02-10'],
    ['ADR-006', 'FURS modul z OpenSSL CLI + Node crypto fallback', 'Accepted', '2025-02-15'],
    ['ADR-007', 'Service Worker za offline mode (IndexedDB queue)', 'Accepted', '2025-03-01'],
    ['ADR-008', 'Cascade palette V2 za design system', 'Accepted', '2025-03-15'],
    ['ADR-009', 'Stripe kot primarni plačilni gateway', 'Accepted', '2025-04-01'],
    ['ADR-010', 'Chain hash audit log (SHA-256, nepopravljiv)', 'Accepted', '2025-04-15'],
    ['ADR-011', 'Vercel kot hosting platforma', 'Accepted', '2025-05-01'],
    ['ADR-012', 'next-intl za i18n (5 jezikov)', 'Accepted', '2025-05-15'],
], [60, CONTENT_W-220, 80, 80]))
story.append(C('Tabela 1.1: Seznam vseh 12 ADR-jev'))
story.append(PageBreak())

# ADR-001
story.append(H1('2. ADR-001: Next.js 16 + React 19'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-001', 'Next.js 16 + React 19 kot frontend framework', 'Accepted', '2025-01-15'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS potrebuje sodoben frontend framework, ki podpira: server-side rendering (SEO za landing page), API routes (backend), TypeScript, hitrost in dobro developer izkušnjo. Sistem mora delovati na tablicah (POS), mobilnih napravah (natakarji) in desktopih (admin).'))
story.append(P('Omejitve: ekipa ima izkušnje z React, projekt mora biti production-ready v 6 mesecih, hosting na Vercel (prednost za Next.js).'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Next.js 16 z React 19</b>, ki ga hostamo na Vercel. Uporabljamo App Router (ne Pages Router), Server Components za performanco in API Routes za backend.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Vue.js + Nuxt', 'Enostaven learning curve, dobra DX', 'Manjša skupnost, manj job kandidatov', 'Ekipa nima Vue izkušenj'],
    ['SvelteKit', 'Najboljša performanca, majhen bundle', 'Majhna ekosistem, manj komponent', 'Premajhna skupnost za enterprise'],
    ['Remix', 'Odlično za web standards', 'Manj integracij kot Next.js', 'Manj komponent v ekosistemu'],
    ['Angular', 'Kompleten framework, enterprise-ready', 'Strma learning curve, težji', 'Prekompleksen za našo ekipo'],
    ['Plain React (Vite)', 'Polna kontrola, enostaven', 'Brez SSR, API routes, file-based routing', 'Premalo funkcij v paketu'],
], [120, 130, 130, CONTENT_W-380]))
story.append(C('Tabela 2.1: Primerjava alternativ za ADR-001'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> SSR za SEO, API routes (en paket), Vercel integracija, velika skupnost, enostaven hiring'))
story.append(B('<b>Good:</b> Server Components zmanjšujejo bundle size, streaming SSR za hitrejši first paint'))
story.append(B('<b>Good:</b> TypeScript first-class support, ecosystem (Radix UI, Tailwind, Prisma)'))
story.append(B('<b>Bad:</b> Next.js 16 je nov (breaking changes morda), dokumentacija včasih zaostaja'))
story.append(B('<b>Bad:</b> App Router je kompleksnejši od Pages Router (caching, revalidation'))
story.append(B('<b>Neutral:</b> Zaklenjeni smo v Vercel ekosistem (lahko selimo na self-hosted, a z naporom)'))
story.append(PageBreak())

# ADR-002
story.append(H1('3. ADR-002: Neon PostgreSQL'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-002', 'Neon PostgreSQL (serverless) kot glavna baza', 'Accepted', '2025-01-20'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS potrebuje relacijsko bazo za transakcijske podatke (naročila, plačila, FURS računi). Zahtevane lastnosti: SQL (ne NoSQL), ACID transakcije, GDPR skladnost (EU hosting), avtomatski backupi, scale-to-zero za nizke stroške v začetku.'))
story.append(P('Omejitve: budget <100 EUR/mes za bazo v prvem letu, ekipa pozna PostgreSQL, prioriteta EU hosting za GDPR.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Neon PostgreSQL</b> (serverless PostgreSQL). Free plan za razvoj (0.5 GB), scale-up po potrebi. Connection pooling prek Neon pooler (port 5432). Branching za testne environmente.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Supabase', 'Auth + DB + Storage v enem', 'Lock-in, manj fleksibilnosti', 'Preveč "magic", radi imamo kontrolo'],
    ['PlanetScale (MySQL)', 'Odlično za branje, branching', 'MySQL (ne PostgreSQL), no foreign keys na free', 'No FK je deal-breaker'],
    ['AWS RDS PostgreSQL', 'Polna kontrola, enterprise', 'Drago, ni serverless, complex setup', 'Predrago za začetek'],
    ['Self-hosted PostgreSQL', 'Polna kontrola, brezplačno', 'Vzdrževanje, backup, security naša odgovornost', 'Ni dovolj časa za ops'],
    ['MongoDB Atlas', 'Fleksibilna shema, dobra za dokumente', 'NoSQL (ne ACID), transakcije šibke', 'Potrebujemo ACID za plačila'],
], [130, 130, 130, CONTENT_W-390]))
story.append(C('Tabela 3.1: Primerjava alternativ za ADR-002'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Serverless (scale-to-zero), branching za test, free plan za začetek, EU hosting (GDPR)'))
story.append(B('<b>Good:</b> Polno PostgreSQL (ACID, foreign keys, transakcije, full-text search, JSONB)'))
story.append(B('<b>Good:</b> Avtomatski backupi (PITR 7 dni na free planu)'))
story.append(B('<b>Bad:</b> Free plan omejen (0.5 GB storage, 100 compute hours/mes) - bo treba upgrade pri rasti'))
story.append(B('<b>Bad:</b> Cold start (prva query po idle lahko traja 1-2s) - mitigiramo z keep-alive'))
story.append(B('<b>Bad:</b> Vendor lock-in (Neon specifične funkcije)'))
story.append(B('<b>Neutral:</b> Connection pooler je Poseganje (ne native PG), a deluje dobro'))
story.append(PageBreak())

# ADR-003
story.append(H1('4. ADR-003: Prisma ORM'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-003', 'Prisma ORM za databasno dostop', 'Accepted', '2025-01-22'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('Potreben je ORM za dostop do PostgreSQL iz Next.js. Zahteve: TypeScript-first, type safety, migracije, query builder, dobra dokumentacija. Ekipa ima izkušnje z raw SQL in Sequelize.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Prisma ORM</b>. 92 modelov v schema.prisma, migracije prek prisma migrate, type-safe queries prek Prisma Client.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Drizzle ORM', 'Najboljša performanca, minimal', 'Manj funkcij, manj dokumentacije', 'Premalo zrelo (2025)'],
    ['TypeORM', 'Popular, decorated entities', 'Težek, bug-ovit, slaba DX', 'Slabe izkušnje v preteklosti'],
    ['Sequelize', 'Zrel, popularen', 'TypeScript šibek, počasen', 'Slaba TypeScript podpora'],
    ['Raw SQL (pg)', 'Polna kontrola, hitro', 'Brez type safety, ročne migracije', 'Preveč ročno za 92 modelov'],
    ['Kysely', 'Type-safe query builder', 'Brez migracij, brez generatorja', 'Manj funkcij kot Prisma'],
], [120, 130, 130, CONTENT_W-380]))
story.append(C('Tabela 4.1: Primerjava alternativ za ADR-003'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Type-safe queries (TypeScript inferira tipe iz sheme), avtomatske migracije, odlična DX'))
story.append(B('<b>Good:</b> Prisma Studio za debug, Prisma Client je lightweight, dobra dokumentacija'))
story.append(B('<b>Good:</b> 92 modelov z relacijami brez ročnega SQL - ogromna prihranek časa'))
story.append(B('<b>Bad:</b> Prisma Client dodaja ~3MB bundle size (server-side, a vseeno)'))
story.append(B('<b>Bad:</b> N+1 query problem (mitigiramo z include/select)'))
story.append(B('<b>Bad:</b> Prisma migrate ima bug-e z neon teknologijo (workaround: prisma db push)'))
story.append(PageBreak())

# ADR-004
story.append(H1('5. ADR-004: Multi-tenant arhitektura'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-004', 'Multi-tenant arhitektura z locationId izolacijo', 'Accepted', '2025-02-01'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS mora podpirati verige restavracij z več lokacijami (npr. 5 lokacij = 5 tenantov). Vsaka lokacija mora imeti ločene podatke (naročila, zaloge, osebje), a skupne konfiguracije (meni, cene). Super-admin (PIN 5555) mora videti vse lokacije.'))
story.append(P('Zahteve: stroga izolacija podatkov, skupna koda, enostavno dodajanje novih lokacij, audit log za cross-branch operacije.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo "shared database, shared schema" multi-tenant arhitekturo</b>. Vseh 8 ključnih tabel (orders, payments, inventory, employees, itd.) ima locationId stolpec. Aplikacijska plast (requireAuth + middleware) vsako query samodejno filtrira z locationId.'))
story.append(CODE('''// Prisma query z avtomatsko filtracijo:
const orders = await db.order.findMany({
  where: {
    locationId: authResult.session.locationId, // iz session-a
    // ... drugi pogoji
  },
});

// Super-admin (PIN 5555) lahko izpusti locationId:
if (authResult.session.role === 'super_admin') {
  // query brez locationId filtra
}'''))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Database-per-tenant', 'Najboljša izolacija', 'Drago, kompleksno za migracije', 'Predrago za naš model'],
    ['Schema-per-tenant', 'Dobra izolacija, ena baza', 'Kompleksne migracije, connection pooling', 'Preveč kompleksno'],
    ['Row-level security (RLS)', 'DB-level izolacija', 'Težko debug, Neon podpira šibko', 'Premalo zrelo na Neon'],
    ['Single-tenant (ločena instanca)', 'Enostavno', 'Drago, težko upravljati', 'Ne ustreza SaaS modelu'],
], [140, 130, 130, CONTENT_W-400]))
story.append(C('Tabela 5.1: Primerjava multi-tenant strategij'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Enostavno dodajanje novih lokacij (samo nov Location zapis), nizki stroški (ena baza)'))
story.append(B('<b>Good:</b> Skupna koda in shema, enostavne migracije'))
story.append(B('<b>Good:</b> Super-admin lahko vidi vse lokacije (cross-branch poročila, audit log)'))
story.append(B('<b>Bad:</b> Aplikacijska plast mora VEDNO dodati locationId filter (rizenje za bug-e)'))
story.append(B('<b>Bad:</b> Eventualna izolacijska napaka če developer pozabi filter (mitigiramo z requireAuth middleware)'))
story.append(B('<b>Bad:</b> Težje za analytics (agregacija čez tenant-e zahteva skrbne query-je)'))
story.append(PageBreak())

# ADR-005
story.append(H1('6. ADR-005: PIN-based auth'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-005', 'PIN-based auth namesto JWT/session', 'Accepted', '2025-02-10'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('Restavracijsko osebje (natakarji, kuharji) se mora hitro prijaviti v POS. Uporaba email+geslo je prepočasna (45+ sekund na začetku izmene). PIN (4 številke) je hitro vnesti na tablici. Vendar PIN šibek za varnost.'))
story.append(P('Zahteve: hitra prijava (<5 sekund), varnost (PIN ne sme biti raw v bazi), podpora za offline (PIN veljaven tudi brez interneta), enostavno upravljanje (admin lahko resetira PIN).'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo PIN-based auth z bcrypt + HMAC-SHA256 hashiranjem</b>. PIN (4 številke) se hashira z bcrypt (10 rounds) in dodatno zaščiti z HMAC-SHA256. Session token (JWT-like) se generira po prijavi in velja 8 ur.'))
story.append(CODE('''// PIN hashiranje (pri ustvarjanju uporabnika):
const saltRounds = 10;
const hmacKey = process.env.PIN_HMAC_KEY;
const hmacPin = crypto.createHmac('sha256', hmacKey).update(pin).digest('hex');
const hashedPin = await bcrypt.hash(hmacPin, saltRounds);

// PIN verifikacija (pri prijavi):
const hmacPin = crypto.createHmac('sha256', hmacKey).update(inputPin).digest('hex');
const valid = await bcrypt.compare(hmacPin, storedHashedPin);

// Session generacija (po uspešni prijavi):
const token = jwt.sign(
  { employeeId, role, locationId },
  process.env.NEXTAUTH_SECRET,
  { expiresIn: '8h' }
);'''))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Email + geslo', 'Standard, varno', 'Počasno (45s), keyboard potrebno', 'Prepočasno za POS'],
    ['Biometric (FaceID)', 'Hitro, varno', 'Hardware zahteva, draga implementacija', 'Premalo tablic s FaceID'],
    ['RFID kartica', 'Hitro (tap)', 'Hardware, kartice se izgubijo', 'Dodaten strošek hardware'],
    ['Magic link (email)', 'Brez gesla', 'Potreben email, počasno', 'Ni ustreza za POS'],
    ['SSO (Google/Microsoft)', 'Varno, enostavno', 'Vsak uporabnik rabi Google račun', 'Neprimerno za natakarje'],
], [130, 110, 140, CONTENT_W-380]))
story.append(C('Tabela 6.1: Primerjava auth alternativ'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Hitra prijava (<5s), enostavno za osebje, deluje offline (PIN se preverja lokalno)'))
story.append(B('<b>Good:</b> PIN je hashiran (bcrypt + HMAC), ne moremo ga dehashirati'))
story.append(B('<b>Good:</b> Admin lahko resetira PIN kadarkoli'))
story.append(B('<b>Bad:</b> PIN je šibek (10.000 kombinacij) - mitigiramo z rate limiting (5 poskusov/15 min)'))
story.append(B('<b>Bad:</b> Če PIN-HMAC-Key pušča, so vsi PIN-i kompromitirani (rotate ob incidentu)'))
story.append(B('<b>Bad:</b> Session poteče po 8h (delovna izmena je lahko daljša - mitigiramo z refresh token)'))
story.append(PageBreak())

# ADR-006
story.append(H1('7. ADR-006: FURS OpenSSL CLI + Node crypto'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-006', 'FURS modul z OpenSSL CLI + Node crypto fallback', 'Accepted', '2025-02-15'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('FURS (slovenski davčni sistem) zahteva PKCS12 certifikate za davčno potrjevanje računov. Node.js crypto modul v standalone načinu ne podpira polnega PKCS12 parsing-a (posebej za FURS specifične certifikate). Potreben je zanesljiv način za ekstrakcijo privatnega ključa iz .p12 datoteke.'))
story.append(P('Zahteve: zanesljiva ekstrakcija privatnega ključa, podpora za FURS certifikate, varno geslo handling, delovanje na Vercel (serverless).'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo hibridni pristop: OpenSSL CLI kot primarna metoda + Node.js crypto kot fallback</b>. OpenSSL CLI je najbolj zanesljiv za FURS certifikate, Node crypto pa deluje kjer CLI ni na voljo.'))
story.append(CODE('''// Primarna metoda: OpenSSL CLI
const pemKey = execFileSync('openssl', [
  'pkcs12', '-in', certPath, '-nocerts', '-nodes',
  '-passin', `pass:${password}`,
], { encoding: 'utf8', timeout: 10000 }).trim();

// Fallback: Node.js crypto (če OpenSSL ni na voljo)
if (!pemKey || !pemKey.includes('BEGIN')) {
  return tryNodeCryptoPKCS12(certPath, password);
}'''))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Samo Node.js crypto', 'Brez zunanjih deps', 'Ne deluje za vse FURS cert-e', 'Nezanesljivo'],
    ['Samo OpenSSL CLI', 'Najbolj zanesljivo', 'Zahteva openssl v PATH (Vercel?)', 'Vercel ima openssl, a fallback vseeno'],
    ['forge (pure JS)', 'Brez zunanjih deps', 'Počasen, bug-i z nekaterimi cert-i', 'Nezanesljivo za FURS'],
    ['Cloud function (AWS Lambda)', 'Polna kontrola', 'Dodaten cloud, latenco', 'Predrago in kompleksno'],
], [150, 130, 130, CONTENT_W-410]))
story.append(C('Tabela 7.1: Primerjava PKCS12 parsing strategij'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Zanesljiva ekstrakcija ključa za vse FURS certifikate (OpenSSL je standard)'))
story.append(B('<b>Good:</b> Fallback omogoča delovanje tudi brez OpenSSL (Node crypto)'))
story.append(B('<b>Good:</b> execFileSync preprečuje shell injection (argumenti so array, ne string)'))
story.append(B('<b>Bad:</b> Odvisnost od openssl v PATH (Vercel ima, a self-host bi bil problem)'))
story.append(B('<b>Bad:</b> 10s timeout (lahko zablokira request) - mitigiramo z cacheanjem ključa'))
story.append(B('<b>Bad:</b> Dve kodi path-a za vzdrževanje (CLI + Node crypto)'))
story.append(PageBreak())

# ADR-007
story.append(H1('8. ADR-007: Service Worker offline'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-007', 'Service Worker za offline mode (IndexedDB queue)', 'Accepted', '2025-03-01'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('Restavracije imajo pogosto nestabilen internet. Natakarji morajo lahko sprejemati naročila tudi brez interneta. Ko povezava povrne, se naročila sinhronizirajo. FURS dovoli 48h zamik pri potrjevanju.'))
story.append(P('Zahteve: offline naročila, offline plačila (gotovina), offline FURS queue, avtomatska sinhronizacija, delovanje na iOS in Android.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Service Worker (PWA) z IndexedDB queue in Background Sync API</b>. Service Worker (sw.js v9) cach-a statiko (cache-first) in API (network-first z fallback). Naročila se shranjujejo v IndexedDB in sinhronizirajo prek Background Sync.'))
story.append(CODE('''// Service Worker cache strategije:
// 1. Static assets (/ , manifest.json, icons) → cache-first
// 2. API (/api/menus, /api/tables) → network-first, fallback na cache
// 3. Občutljivi API (/api/orders/*/pay, /api/furs) → NIKOLI cache

// Offline orders queue (IndexedDB):
async function queueOrder(order) {
  const db = await openDB('restaurantos', 1);
  await db.add('orders', { ...order, status: 'pending', createdAt: Date.now() });
}

// Background Sync (ko povezava povrne):
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});'''))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Native app (iOS/Android)', 'Najboljša offline izkušnja', '2 kodi bazi, drag razvoj', 'Predrago in počasno'],
    ['React Native', 'Ena koda, native perf', 'Še vedno 2 build-a, kompleksno', 'Prekompleksno za našo ekipo'],
    ['Local SQLite (Capacitor)', 'Močna offline baza', 'Capacitor setup, še vedno "native"', 'Ne uporabljamo Capacitor'],
    ['Samo cache (brez queue)', 'Enostavno', 'Ne deluje za write operacije', 'Ne zadostuje za naročila'],
    ['No offline (online-only)', 'Enostavno', 'Ne deluje brez interneta', 'Ne sprejemljivo za restavracije'],
], [150, 130, 130, CONTENT_W-410]))
story.append(C('Tabela 8.1: Primerjava offline strategij'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Deluje na vseh platformah (iOS Safari 16.4+, Android Chrome, desktop)'))
story.append(B('<b>Good:</b> Ena koda (spletna), brez native app store procesa'))
story.append(B('<b>Good:</b> IndexedDB je močna (lahko shranimo tisoče naročil)'))
story.append(B('<b>Good:</b> Background Sync avtomatsko sinhronizira (tudi ko je app zaprta)'))
story.append(B('<b>Bad:</b> iOS < 16.4 ne podpira push notifications (mitigiramo z SMS fallback)'))
story.append(B('<b>Bad:</b> Service Worker cache lahko povzroči "stale data" (mitigiramo z versioning v10)'))
story.append(B('<b>Bad:</b> Debugging Service Worker je težko (DevTools je edino orodje)'))
story.append(PageBreak())

# ADR-008
story.append(H1('9. ADR-008: Cascade palette V2'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-008', 'Cascade palette V2 za design system', 'Accepted', '2025-03-15'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS potrebuje dosledno barvno paleto, ki: (1) ustreza restavracijski tematiki (topla, vabljiva), (2) je dosledna čez vse komponente, (3) je harmonična (ne random barve), (4) je dostopna (WCAG AA contrast).'))
story.append(P('Zahteve: 60-30-10 razmerje (background-surface-accent), nizka saturacija za velike površine, visoka saturacija samo za accents, matematično harmonična.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Cascade palette V2</b> z 5 nivoji (XL, L, M, S, XS) glede na saturacijo in area. Generirana z design_engine.py palette.cascade.'))
story.append(TBL([
    ['Tier', 'Area', 'Saturacija', 'Barva', 'Uporaba'],
    ['XL', '>50%', 'S ≤ 0.08', '#f3f2f1 (kremna)', 'Page background'],
    ['L', '20-50%', 'S ≤ 0.15', '#eeedea (svetla)', 'Cards, surfaces'],
    ['M', '5-20%', 'S ≤ 0.30', '#685f46 (zemeljska)', 'Headers, structural fills'],
    ['S', '1-5%', 'S ≤ 0.50', '#d1c9b3 (peščena)', 'Borders, icons'],
    ['XS', '<1%', 'S ≤ 0.75', '#86702b (zlata)', 'Accents, badges, emphasis'],
], [40, 80, 100, 130, CONTENT_W-350]))
story.append(C('Tabela 9.1: Cascade palette V2 nivoji'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Tailwind default palette', 'Enostavno, znano', 'Niso harmonične, random saturacija', 'Ne dosledno'],
    ['Material Design palette', 'Zrelo, dobra dokumentacija', "Preveč 'tech', ne restavracijska", 'Ne ustreza tematiki'],
    ['Custom hand-picked', 'Polna kontrola', 'Težko harmonično, subjectivno', 'Ne matematično'],
    ['Monochrome (siva)', 'Minimalistično', 'Dolgočasno, brez "osebnosti"', 'Ne primerno za restavracije'],
    ['Brand-led (logo barve)', 'Skladno z brand', 'Limitira izbire, ne harmonično', 'Premalo fleksibilno'],
], [140, 120, 130, CONTENT_W-390]))
story.append(C('Tabela 9.2: Primerjava paletnih strategij'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Matematično harmonična (HSL-bazirana), dosledna čez vse komponente'))
story.append(B('<b>Good:</b> Topla zemeljska paleta ustreza restavracijski tematiki (razlikuje od tekmovalcev)'))
story.append(B('<b>Good:</b> 60-30-10 razmerje preprečuje prekomerno uporabo accent barv'))
story.append(B('<b>Good:</b> Generirana avtomatsko (palette.cascade) - reproducibilna'))
story.append(B('<b>Bad:</b> Topla paleta je manj "korporativna" (lahko je izziv za enterprise segment)'))
story.append(B('<b>Bad:</b> Design system ni formalno dokumentiran (Storybook manjka - P1 prioriteta)'))
story.append(PageBreak())

# ADR-009
story.append(H1('10. ADR-009: Stripe plačilni gateway'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-009', 'Stripe kot primarni plačilni gateway', 'Accepted', '2025-04-01'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS potrebuje integriran plačilni gateway za kartična plačila v POS. Zahteve: PCI compliance (ne shranjujemo kartičnih podatkov), podpora za EU kartice (3-D Secure/SCA), webhook za asinhrona potrdila, refund support, dobra dokumentacija.'))
story.append(P('Omejitve: slovenski trg (EUR valuta), ekipa pozna Stripe, budget za transakcijske provizije.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Stripe kot primarni plačilni gateway</b>. Uporabljamo Stripe Elements (PCI-compliant), PaymentIntent API, webhook za event processing. Implementirana je StripeGateway class (286 vrstic) z authorize/capture/refund.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['SumUp', 'EU friendly, fizični terminali', 'Šibkejši API, manj funkcij', 'Manj funkcij kot Stripe'],
    ['Braintree (PayPal)', 'PayPal + kartice', 'PayPal lock-in, šibkejši EU', 'Slabša EU podpora'],
    ['Adyen', 'Enterprise, multi-currency', 'Drago, kompleksno setup', 'Predrago za začetek'],
    ['PayPal direct', 'Znana blagovna znamka', 'Slab UX, PayPal-only stranke', 'Ne dovolj fleksibilno'],
    ['Local SI processor (NLB)', 'Lokalno, brez provizije', 'Stara API-ja, brez webhooks', 'Neprimerno za sodoben POS'],
], [140, 130, 130, CONTENT_W-400]))
story.append(C('Tabela 10.1: Primerjava plačilnih gatewayov'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> PCI-compliant (kartice nikoli ne pridejo na naš server - Stripe Elements)'))
story.append(B('<b>Good:</b> Odlična dokumentacija, dobra EU podpora, 3-D Secure (SCA) built-in'))
story.append(B('<b>Good:</b> Webhook za asinhrona potrdila (payment_intent.succeeded, itd.)'))
story.append(B('<b>Good:</b> Enostaven refund (delni in polni), dober dashboard'))
story.append(B('<b>Bad:</b> Transakcijska provizija 1.5% + 0.18 EUR (višja od lokalnih)'))
story.append(B('<b>Bad:</b> Vendor lock-in (Stripe API je specifičen)'))
story.append(B('<b>Bad:</b> Disputes se obračunavajo po Stripe pravilih (lahko 7 dni čaka)'))
story.append(PageBreak())

# ADR-010
story.append(H1('11. ADR-010: Chain hash audit log'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-010', 'Chain hash audit log (SHA-256, nepopravljiv)', 'Accepted', '2025-04-15'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS mora imeti nepopravljiv audit log za: FURS operacije (zakonska zahteva), plačilne operacije (PCI audit), admin operacije (security). Auditorji morajo lahko preverili, da log ni bil popravljem.'))
story.append(P('Zahteve: nepopravljiv (chain hash), časovno sledljiv, varčen pred DB izgubo, enostaven za verificirati.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo chain hash audit log</b>. Vsaka log vrstica vsebuje: prejšnji hash, vsebino, trenutni hash (SHA-256 prejšnji + vsebina). Prva vrstica (genesis) ima fixed hash. Verifikacija: rechain od genesis do zadnje vrstice.'))
story.append(CODE('''// AuditLog model (Prisma):
model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  employeeId  String
  action      String   // "furs.verify", "payment.create", itd.
  entityId    String
  ipAddress   String?
  metadata    Json?
  previousHash String
  currentHash  String  // SHA-256(previousHash + content)
  
  @@index([timestamp])
  @@index([employeeId])
}

// Generacija hash:
const content = JSON.stringify({ timestamp, employeeId, action, entityId, metadata });
const currentHash = crypto.createHash('sha256')
  .update(previousHash + content)
  .digest('hex');

// Verifikacija (rechain):
let prevHash = GENESIS_HASH;
const logs = await db.auditLog.findMany({ orderBy: { timestamp: 'asc' } });
for (const log of logs) {
  const expectedHash = crypto.createHash('sha256')
    .update(prevHash + log.content)
    .digest('hex');
  if (log.currentHash !== expectedHash) {
    throw new Error(`Audit log compromised at ${log.id}`);
  }
  prevHash = log.currentHash;
}'''))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Simple DB tabela', 'Enostavno', 'Popravljivo (admin lahko uredi)', 'Ne nepopravljivo'],
    ['Append-only DB', 'DB-level zaščita', 'Težko implementirati na Neon', 'Ne podprto na Neon'],
    ['Blockchain (Ethereum)', 'Decentralizirano', 'Predrago, počasno, overkill', 'Excessive'],
    ['External service (Splunk)', 'Profesionalno', 'Drago, dodaten cloud', 'Predrago za našo skalo'],
    ['File-based log (JSON)', 'Enostavno', 'Popravljivo, težko query', 'Ne queryable'],
], [140, 120, 140, CONTENT_W-400]))
story.append(C('Tabela 11.1: Primerjava audit log strategij'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Nepopravljiv (vsak popravek prekine chain - detekcija)'))
story.append(B('<b>Good:</b> Verifiable (kdorkoli lahko rechain in preveri integriteto)'))
story.append(B('<b>Good:</b> Združljivo z GDPR (log je metadata, ne osebni podatki)'))
story.append(B('<b>Good:</b> Enostavno za implementirati (crypto modul v Node.js)'))
story.append(B('<b>Bad:</b> Verifikacija je O(n) (počasno za milijone vrstic) - mitigiramo z batch verify'))
story.append(B('<b>Bad:</b> Če ena vrstica izgine, chain prekinjen (mitigiramo z backup)'))
story.append(B('<b>Bad:</b> Storage raste (vsaka vrstica ~500 bytes) - mitigiramo z arhiviranjem'))
story.append(PageBreak())

# ADR-011
story.append(H1('12. ADR-011: Vercel hosting'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-011', 'Vercel kot hosting platforma', 'Accepted', '2025-05-01'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS potrebuje hosting za Next.js aplikacijo. Zahteve: avtomatski deploy iz Git, EU hosting (GDPR), serverless functions, edge caching, enostaven rollback, dobra observability.'))
story.append(P('Omejitve: budget <50 EUR/mes v prvem letu, ekipa brez DevOps izkušenj, prioriteta enostavnost.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo Vercel kot hosting platformo</b>. Pro plan (20 USD/mes) za produkcijo, avtomatski deploy iz GitHub main branch, EU region (Frankfurt), serverless functions za API.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['Netlify', 'Enostavno, dobra DX', 'Šibkejši za Next.js, manj funkcij', 'Vercel je Next.js creator'],
    ['AWS Amplify', 'AWS ekosistem', 'Kompleksno, drago, slaba DX', 'Prekompleksno'],
    ['Self-hosted (Docker + VPS)', 'Polna kontrola, ceneje', 'Vzdrževanje, scaling naša odgovornost', 'Ni dovolj časa za ops'],
    ['Railway', 'Enostavno, ceneje', 'Manj funkcij, šibkejši za Next.js', 'Manj zrelo'],
    ['Cloudflare Pages', "Hitro, ceneje", 'Šibkejši za Next.js App Router', 'Kompatibilnost vprašljiva'],
], [140, 120, 140, CONTENT_W-400]))
story.append(C('Tabela 12.1: Primerjava hosting platform'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Avtomatski deploy iz Git (push na main = deploy), preview deployments za PR'))
story.append(B('<b>Good:</b> EU region (Frankfurt) za GDPR skladnost'))
story.append(B('<b>Good:</b> Enostaven rollback (vsak deployment ima URL, promote to production)'))
story.append(B('<b>Good:</b> Serverless functions (auto-scale, pay-per-use)'))
story.append(B('<b>Good:</b> Built-in analytics, logs, observability'))
story.append(B('<b>Bad:</b> Vendor lock-in (Next.js specifične funkcije)'))
story.append(B('<b>Bad:</b> Function execution limit (10s na free, 60s na Pro) - problem za dolge operacije'))
story.append(B('<b>Bad:</b> Bandwidth limit (100 GB/mes na Pro) - bomo morali upgrade pri rasti'))
story.append(PageBreak())

# ADR-012
story.append(H1('13. ADR-012: next-intl za i18n'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(adr_header('ADR-012', 'next-intl za i18n (5 jezikov)', 'Accepted', '2025-05-15'))
story.append(SP(10))
story.append(H2('Kontekst'))
story.append(P('RestaurantOS mora podpirati 5 jezikov: slovenščina (primarni), angleščina, italijanščina, hrvaščina, nemščina. Zahteve: prevodi v JSON datotekah, lazy loading, formatiranje številk/datumov/valut, RTL podpora (za arabščino v prihodnosti).'))
story.append(P('Omejitve: integracija z Next.js App Router, dober TypeScript support, enostaven upload novih prevodov.'))
story.append(H2('Odločitev'))
story.append(P('<b>Izbrali smo next-intl</b> za internacionalizacijo. Prevodi v src/messages/{sl,en,it,hr,de}.json. Locale detection iz URL-ja (/sl, /en, itd.) ali cookie.'))
story.append(H2('Alternative'))
story.append(TBL([
    ['Alternativa', 'Pros', 'Cons', 'Zakaj zavrnjena'],
    ['react-intl (FormatJS)', "Zrel, popularen", 'Šibek Next.js App Router support', 'Slaba App Router integracija'],
    ['i18next', 'Najbolj popularen', 'Kompleksen setup, šibek TS', 'Prekompleksno za naše potrebe'],
    ['Lingui', 'Compile-time, hitro', 'Manj popularen, manj docs', 'Premajhna skupnost'],
    ['Custom solution', 'Polna kontrola', 'Veliko dela, bug-i', 'Preveč ročno'],
    ['react-i18next', 'Zrel, popularen', 'Kompleksen, šibek App Router', 'Enako kot i18next'],
], [140, 120, 140, CONTENT_W-400]))
story.append(C('Tabela 13.1: Primerjava i18n knjižnic'))
story.append(H2('Posledice'))
story.append(B('<b>Good:</b> Enostavna integracija z Next.js App Router (server in client components)'))
story.append(B('<b>Good:</b> TypeScript support (tipi za prevode)'))
story.append(B('<b>Good:</b> Lazy loading prevodov (samo aktivni jezik se naloži)'))
story.append(B('<b>Good:</b> Formatiranje številk, datumov, valut (ICU MessageFormat)'))
story.append(B('<b>Bad:</b> next-intl je relativno nov (manj skupnost kot react-intl)'))
story.append(B('<b>Bad:</b> RTL podpora je šibka (če bomo dodali arabščino)'))
story.append(B('<b>Bad:</b> Translation management ni vgrajen (uporabljamo Lokalise ali Crowdin)'))
story.append(PageBreak())

# 14. SKUPNE POSLEDICE
story.append(H1('14. Skupne posledice in naslednji koraki'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Ta sekca povzema skupne posledice vseh 12 ADR-jev in identificira področja, ki jih je treba ponovno pretehtati.'))
story.append(H2('14.1 Skupne prednosti'))
story.append(B('<b>Modern stack:</b> Next.js 16 + React 19 + TypeScript + Prisma + Neon = sodobna, hitra, scalable arhitektura'))
story.append(B('<b>EU/GDPR skladnost:</b> Vercel EU + Neon EU + chain hash audit log = GDPR ready'))
story.append(B('<b>Multi-tenant SaaS:</b> Ena koda, več strank, nizki stroški (Neon serverless)'))
story.append(B('<b>Offline-first:</b> Service Worker + IndexedDB = deluje brez interneta'))
story.append(B('<b>Security:</b> PIN bcrypt + HMAC, PCI-compliant Stripe, audit log'))
story.append(B('<b>DX:</b> TypeScript + Prisma + Next.js = odlična developer izkušnja'))
story.append(H2('14.2 Skupne slabosti'))
story.append(B('<b>Vendor lock-in:</b> Vercel + Neon + Stripe = težko selimo na alternativne'))
story.append(B('<b>Šibka mobilna izkušnja:</b> PWA (ne native) - omejitve na iOS < 16.4'))
story.append(B('<b>Multi-tenant risk:</b> Aplikacijska plast mora VEDNO dodati locationId filter'))
story.append(B('<b>Function execution limit:</b> Vercel 60s timeout za dolge operacije'))
story.append(B('<b>Brez formalnega design sistema:</b> Storybook manjka (P1 prioriteta)'))
story.append(H2('14.3 ADR-ji za ponovno pretehtavanje'))
story.append(TBL([
    ['ADR', 'Zakaj ponovno pretehtati', 'Kdaj', 'Mogoča sprememba'],
    ['ADR-005 (PIN auth)', 'Šibka varnost (10k kombinacij)', 'Ko se pojavi fraud incident', 'Dodaj 2FA za admin'],
    ['ADR-007 (Service Worker)', 'iOS < 16.4 omejitev', 'Q1 2026 (iOS update)', 'Native app za iOS'],
    ['ADR-009 (Stripe)', 'Visoke provizije za velike stranke', 'Ko >1M EUR letni volumen', 'Negociate z Adyen'],
    ['ADR-011 (Vercel)', 'Bandwidth/function limit', 'Ko presežemo 100GB/mes', 'Self-hosted z Docker'],
    ['ADR-012 (next-intl)', 'RTL podpora šibka', 'Če dodamo arabščino', 'Migration na react-intl'],
], [120, 200, 100, CONTENT_W-420]))
story.append(C('Tabela 14.1: ADR-ji za ponovno pretehtavanje'))
story.append(H2('14.4 Postopek za nove ADR-je'))
story.append(P('Ko se pojavi nova ključna tehnična odločitev, se ustvari nov ADR:'))
story.append(B('1. Identificiraj problem (zakaj odločamo)'))
story.append(B('2. Zapiši kontekst (zahteve, omejitve)'))
story.append(B('3. Razmisli o alternativah (vsaj 3)'))
story.append(B('4. Izberi in utemelji (zakaj ta, ne druga)'))
story.append(B('5. Zapiši posledice (good/bad/neutral)'))
story.append(B('6. Daj na review (Tech Lead + 1 developer)'))
story.append(B('7. Po odobritvi - dodaj v to zbirko (ADR-XXX)'))
story.append(B('8. Če se odločitev spremeni - označi star ADR kot "Superseded by ADR-YYY"'))
story.append(CALLOUT('ADR KULTURA','ADR-ji niso birokracija - so neprecenljivo znanje. Nov član ekipe lahko v 1 uri razume "zakaj" za vsako ključno odločitev. Brez ADR-jev se znanje izgubi ko člani odidejo. Piši ADR za vsako odločitev, ki bi jo lahko preklical v prihodnosti.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Architecture Decision Records', author='Z.ai', subject='ADR zbirka', creator='Z.ai')
doc.multiBuild(story)
print(f'ADR body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
