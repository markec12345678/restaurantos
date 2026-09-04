#!/usr/bin/env python3
"""RestaurantOS Developer Guide - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/devguide_body.pdf'

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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Developer Guide · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building Developer Guide...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod za developerje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Ta vodič je namenjen novim developerjem, ki se pridružujejo RestaurantOS ekipi. Vsebuje vse potrebno za hitri začetek: namestitev okolja, razumevanje arhitekture, kodne standarde, testiranje, contribution workflow in deployment postopke.'))
story.append(P('Po prebiranju tega vodiča bo nov developer sposoben: (1) nastaviti lokalno razvojno okolje v 30 minutah, (2) razumeti arhitekturo in module, (3) pisati kodo v skladu s standardi, (4) poganjati testi in debug, (5) prispevati PR-je v skladu z workflow.'))
story.append(SP(6))
story.append(STATS([
    ('30', 'min do prvega build-a'),
    ('92', 'Prisma modelov'),
    ('229', 'API rutin'),
    ('659', 'React komponent'),
]))
story.append(SP(12))
story.append(H2('1.1 Predznanje'))
story.append(P('Pred začetkom dela na RestaurantOS priporočamo naslednje predznanje:'))
story.append(B('<b>TypeScript</b> - osnovno znanje (interface, type, generic, async/await)'))
story.append(B('<b>React 19</b> - hooks (useState, useEffect, useMemo), Server Components, Client Components'))
story.append(B('<b>Next.js 16</b> - App Router, API Routes, file-based routing, layouts'))
story.append(B('<b>PostgreSQL</b> - osnovni SQL, joins, indexes, transakcije'))
story.append(B('<b>Prisma ORM</b> - schema definition, queries, migrations'))
story.append(B('<b>Tailwind CSS 4</b> - utility classes, responsive design'))
story.append(B('<b>Git</b> - branching, merging, rebasing, conflict resolution'))
story.append(H2('1.2 Ključni koncepti'))
story.append(B('<b>Multi-tenant arhitektura</b> - vsaka lokacija je tenant z locationId izolacijo (glej ADR-004)'))
story.append(B('<b>FURS davčno potrjevanje</b> - ZOI, EOR, .p12 certifikat, offline queue (glej ADR-006)'))
story.append(B('<b>PWA offline</b> - Service Worker, IndexedDB, Background Sync (glej ADR-007)'))
story.append(B('<b>Optimistic locking</b> - updatedAt konflikt detection (409 Conflict)'))
story.append(B('<b>Chain hash audit log</b> - nepopravljiv SHA-256 log (glej ADR-010)'))
story.append(PageBreak())

# 2. SETUP
story.append(H1('2. Setup lokalnega okolja'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Postopek za namestitev lokalnega razvojnega okolja. Celoten setup traja ~30 minut (od clone do delujočega dev serverja).'))
story.append(H2('2.1 Predpogoji'))
story.append(TBL([
    ['Orodje', 'Verzija', 'Namig', 'Namestitev'],
    ['Node.js', '20.x LTS', 'Preveri: node --version', 'https://nodejs.org'],
    ['Bun', '1.1+', 'Preveri: bun --version', 'curl -fsSL https://bun.sh/install | bash'],
    ['Git', '2.40+', 'Preveri: git --version', 'https://git-scm.com'],
    ['VS Code', 'latest', 'Priporočeno IDE', 'https://code.visualstudio.com'],
    ['OpenSSL', '3.0+', 'Za FURS cert testing', 'sudo apt install openssl'],
    ['Playwright', 'auto', 'Za E2E testi', 'npx playwright install'],
], [120, 80, 180, CONTENT_W-380]))
story.append(C('Tabela 2.1: Predpogoji za razvoj'))
story.append(H2('2.2 Namestitev'))
story.append(CODE('''# 1. Fork & kloniraj repozitorij
git clone https://github.com/TVOJ-USERNAME/restaurantos.git
cd restaurantos

# 2. Dodaj upstream remote (za sync z glavnim repozitorijem)
git remote add upstream https://github.com/markec12345678/restaurantos.git

# 3. Namesti odvisnosti (Bun je hitrejši od npm)
bun install

# 4. Ustvari .env iz .env.example
cp .env.example .env

# 5. Nastavi environment spremenljivke v .env:
#    DATABASE_URL="postgresql://user:pass@host/db"  # Neon ali lokalni PG
#    NEXTAUTH_SECRET="random-string-32-znakov"      # bun -e "console.log(crypto.randomUUID())"
#    FURS_ENV="test"
#    FURS_ALLOW_SIMULATION="true"  # za razvoj brez cert-a

# 6. Generiraj Prisma client
bun run db:generate

# 7. Sinhroniziraj shemo z bazo
bun run db:push

# 8. (Opcija) Seed demo podatki
bun run dev
# Odpri http://localhost:3000/api/seed (kot admin)

# 9. Zaženi dev server
bun run dev

# 10. Odpri http://localhost:3000
#     Admin PIN: 1234
#     Super-admin PIN: 5555'''))
story.append(H2('2.3 VS Code priporočene razširitve'))
story.append(TBL([
    ['Razširitev', 'ID', 'Namig'],
    ['ESLint', 'dbaeumer.vscode-eslint', 'Auto-fix na save'],
    ['Prettier', 'esbenp.prettier-vscode', 'Format on save'],
    ['Prisma', 'Prisma.prisma', 'Syntax highlight za .prisma'],
    ['Tailwind CSS IntelliSense', 'bradlc.vscode-tailwindcss', 'Autocomplete za classe'],
    ['TypeScript Vue Plugin', 'Vue.volar', 'Če delaš z .vue datotekami'],
    ['Playwright Test', 'ms-playwright.playwright', 'E2E test runner'],
    ['GitLens', 'eamodio.gitlens', 'Git blame in history'],
    ['Error Lens', 'usernamehw.errorlens', 'Inline error prikaz'],
], [200, 180, CONTENT_W-380]))
story.append(C('Tabela 2.2: VS Code razširitve'))
story.append(H2('2.4 Debug setup'))
story.append(CODE('''# VS Code launch.json (.vscode/launch.json):
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: dev",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal"
    },
    {
      "name": "Playwright E2E",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "test:e2e"],
      "console": "integratedTerminal"
    }
  ]
}'''))
story.append(PageBreak())

# 3. ARHITEKTURA
story.append(H1('3. Arhitektura in struktura projekta'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS sledi modularni arhitekturi z jasno ločitvijo med frontend, backend in business logiko. Tukaj je pregled glavnih direktorijev.'))
story.append(H2('3.1 Direktorijska struktura'))
story.append(CODE('''restaurantos/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # 229 API endpointov (serverless functions)
│   │   ├── (auth)/            # Avtentikacijske strani
│   │   ├── (dashboard)/       # Admin dashboard
│   │   ├── pos/               # POS aplikacija
│   │   ├── kds/               # Kitchen Display System
│   │   ├── waiter/            # Natakar mobilni vmesnik
│   │   ├── landing/           # Javna landing page
│   │   └── layout.tsx         # Root layout
│   ├── components/            # 659 React komponent
│   │   ├── pos/               # POS moduli (orders, payments, inventory)
│   │   ├── ui/                # UI osnove (Button, Input, Modal)
│   │   ├── admin/             # Admin komponente
│   │   └── shared/            # Skupne komponente
│   ├── lib/                   # Business logika
│   │   ├── auth-middleware/   # PIN auth, session, permissions
│   │   ├── furs/              # FURS API, ZOI, EOR, certifikati
│   │   ├── offline-orders/    # IndexedDB queue za naročila
│   │   ├── offline-furs/      # FURS offline queue
│   │   ├── accounting/        # Journal entries, Trial Balance
│   │   ├── websocket-client/  # WebSocket z auto-reconnect
│   │   ├── payment-gateways/  # Stripe, SumUp integracije
│   │   ├── outbox/            # Outbox pattern za async procesiranje
│   │   ├── audit/             # Chain hash audit log
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── logger.ts          # Structured logging
│   │   └── validations/       # Zod sheme za input validacijo
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript tipi
│   └── styles/                # Globalni CSS
├── prisma/
│   ├── schema.prisma          # 92 Prisma modelov
│   ├── migrations/            # DB migracije
│   └── seed.ts                # Demo podatki
├── public/                    # Statične datoteke
│   ├── sw.js                  # Service Worker (v9)
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App ikone
├── tests/
│   ├── e2e/                   # Playwright E2E testi
│   ├── unit/                  # Vitest unit testi
│   └── setup.ts               # Test setup
├── docs/                      # Dokumentacija
├── scripts/                   # Build/utility skripte
├── .env.example               # Environment template
├── next.config.ts             # Next.js konfiguracija
├── tailwind.config.ts         # Tailwind konfiguracija
├── prisma.config.ts           # Prisma konfiguracija
└── package.json               # Odvisnosti in skripte'''))
story.append(H2('3.2 Ključni moduli'))
story.append(TBL([
    ['Modul', 'Lokacija', 'Odgovornost', 'Ključne datoteke'],
    ['Auth', 'src/lib/auth-middleware/', 'PIN auth, session, RBAC', 'requireAuth, session, permissions'],
    ['FURS', 'src/lib/furs/', 'Davčno potrjevanje', 'pkcs12-loader, zoi, verify-invoice'],
    ['Orders', 'src/app/api/orders/', 'Naročila CRUD', 'route.ts, [id]/route.ts'],
    ['Payments', 'src/app/api/payments/', 'Plačila', 'route.ts, stripe-intent'],
    ['Inventory', 'src/app/api/inventory/', 'Zaloge', 'route.ts, restock, adjust'],
    ['Audit', 'src/lib/audit/', 'Chain hash log', 'logger, verify-chain'],
    ['PWA', 'public/sw.js', 'Offline mode', 'sw.js, manifest.json'],
    ['WebSocket', 'src/lib/websocket-client/', 'Real-time', 'client, auto-reconnect'],
], [80, 180, 130, CONTENT_W-390]))
story.append(C('Tabela 3.1: Ključni moduli in njihova odgovornost'))
story.append(PageBreak())

# 4. KODNI STANDARDI
story.append(H1('4. Kodni standardi'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS sledi striktnim kodnim standardom za ohranjanje kvalitete kode. Vsi PR-ji morajo prestati lint, typecheck in teste pred merge.'))
story.append(H2('4.1 TypeScript pravila'))
story.append(B('<b>Strict mode</b> - vedno omogočen (tsconfig.json: "strict": true)'))
story.append(B('<b>Brez `any`</b> - uporabi `unknown` + type guard ali specifičen tip'))
story.append(B('<b>Brez `// @ts-ignore`</b> - uporabi `// @ts-expect-error` z razlago'))
story.append(B('<b>Imena</b> - camelCase za spremenljivke, PascalCase za komponente/tipe/interface'))
story.append(B('<b>Enums</b> - uporabi `as const` namesto `enum` (bolj tree-shakable)'))
story.append(B('<b>Async</b> - vedno `async/await`, ne `.then()/.catch()`'))
story.append(B('<b>Error handling</b> - vedno `try/catch` z typed error-ji'))
story.append(CODE('''// ✅ PRAVILNO:
type PaymentMethod = 'cash' | 'card' | 'gift_card' as const

async function createPayment(data: PaymentInput): Promise<Payment> {
  try {
    const payment = await db.payment.create({ data })
    return payment
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new PaymentError('DATABASE_ERROR', error.message)
    }
    throw error
  }
}

// ❌ NAROBE:
async function createPayment(data: any): Promise<any> {
  const payment = await db.payment.create({ data })  // brez error handling
  return payment
}'''))
story.append(H2('4.2 React komponente'))
story.append(B('<b>Server Components</b> - default (brez "use client") za statično vsebino'))
story.append(B('<b>Client Components</b> - samo za interaktivne (onClick, useState, useEffect)'))
story.append(B('<b>Props</b> - vedno typed interface, ne inline tipi'))
story.append(B('<b>Hooks</b> - custom hooks v src/hooks/, prefiks `use`'))
story.append(B('<b>State</b> - useState za lokalno, Zustand za globalno'))
story.append(B('<b>Effects</b> - useEffect samo ko nujno, raje Server Components'))
story.append(CODE('''// ✅ PRAVILNO - Server Component (default):
async function OrderList() {
  const orders = await db.order.findMany()
  return (
    <ul>
      {orders.map(o => <li key={o.id}>{o.number}</li>)}
    </ul>
  )
}

// ✅ PRAVILNO - Client Component (samo ko nujno):
'use client'
import { useState } from 'react'

interface PaymentButtonProps {
  orderId: string
  amount: number
}

export function PaymentButton({ orderId, amount }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  
  const handlePay = async () => {
    setLoading(true)
    try {
      await fetch('/api/payments', { method: 'POST', body: JSON.stringify({ orderId, amount }) })
    } finally {
      setLoading(false)
    }
  }
  
  return <button onClick={handlePay} disabled={loading}>Plačaj</button>
}'''))
story.append(H2('4.3 API Routes'))
story.append(B('<b>Vedno `requireAuth()`</b> - razen za public endpointe (login, QR meni)'))
story.append(B('<b>Zod validacija</b> - za vse inpute (body, query, params)'))
story.append(B('<b>Rate limiting</b> - za občutljive endpointe (auth, FURS)'))
story.append(B('<b>Error handling</b> - `handleApiError()` helper za konsistentnost'))
story.append(B('<b>Idempotency</b> - za kritične operacije (plačila)'))
story.append(CODE('''// ✅ PRAVILNO - API route pattern:
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateRequest, handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

const inputSchema = z.object({
  tableId: z.string().cuid(),
  items: z.array(z.object({
    menuItemId: z.string().cuid(),
    quantity: z.number().int().positive(),
  })).min(1),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // 1. Auth check
    const auth = await requireAuth(req, { permission: 'take_orders' })
    if (auth.error) return auth.error
    
    // 2. Input validation
    const { data, error } = await validateRequest(req, inputSchema, { maxBodySize: 32 * 1024 })
    if (error) return error
    
    // 3. Business logic
    const order = await createOrder(data, auth.session)
    
    // 4. Response
    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    return handleApiError(err, 'POST /api/orders', 'Napaka pri ustvarjanju naročila')
  }
}'''))
story.append(PageBreak())

# 5. TESTING
story.append(H1('5. Testiranje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS uporablja tri nivoje testiranja: unit, integration in E2E. Vsi PR-ji morajo imeti teste za novo funkcionalnost.'))
story.append(H2('5.1 Test hierarhija'))
story.append(TBL([
    ['Nivo', 'Orodje', 'Hitrost', 'Pokritost', 'Kdaj uporabiti'],
    ['Unit', 'Vitest', 'Hitro (<1s/test)', 'Posamezne funkcije', 'Business logika, helpers, utils'],
    ['Integration', 'Vitest + PGlite', 'Srednje (1-5s/test)', 'Modul interakcije', 'API routes z DB'],
    ['E2E', 'Playwright', 'Počasno (10-30s/test)', 'Uporabniške poteze', 'Kritične poteze (login, order, pay)'],
], [80, 100, 100, 130, CONTENT_W-410]))
story.append(C('Tabela 5.1: Test hierarhija'))
story.append(H2('5.2 Unit testi (Vitest)'))
story.append(CODE('''# Poganjanje:
bun run test              # vsi unit testi
bun run test:watch        # watch mode
bun run test:coverage     # s pokritostjo

# Primer unit testa:
// tests/unit/zoi.test.ts
import { describe, it, expect } from 'vitest'
import { generateZOI } from '@/lib/furs/crypto/zoi'

describe('generateZOI', () => {
  it('generira 32-znakovni MD5 hash', () => {
    const zoi = generateZOI({
      taxNumber: '12345678',
      issueDateTime: '2025-09-04T10:00:00Z',
      invoiceNumber: '001',
      businessPremiseId: 'PE1',
      electronicDeviceId: 'BLAG1',
      invoiceAmount: 49.90,
    })
    
    expect(zoi).toHaveLength(32)
    expect(zoi).toMatch(/^[a-f0-9]{32}$/)
  })
  
  it('vrne isti hash za isti input (deterministic)', () => {
    const input = { taxNumber: '12345678', /* ... */ }
    expect(generateZOI(input)).toBe(generateZOI(input))
  })
})'''))
story.append(H2('5.3 E2E testi (Playwright)'))
story.append(CODE('''# Poganjanje:
bun run test:e2e                    # vsi E2E testi
bunx playwright test --project=chromium  # samo Chrome
bunx playwright test --headed       # z browser UI
bunx playwright test --debug        # z debugger

# Primer E2E testa:
// tests/e2e/critical-path.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Ključna poteza: Order → Payment → FURS', () => {
  test('ustvari naročilo in plača z gotovino', async ({ page }) => {
    // 1. Prijava
    await page.goto('/')
    await page.fill('[data-testid=employee-id]', 'test-admin')
    await page.fill('[data-testid=pin]', '1111')
    await page.click('[data-testid=login]')
    
    // 2. Izberi mizo
    await page.click('[data-testid=table-5]')
    
    // 3. Dodaj artikel
    await page.click('[data-testid=menu-item-pizza]')
    await page.click('[data-testid=add-to-order]')
    
    // 4. Plačaj
    await page.click('[data-testid=pay]')
    await page.click('[data-testid=payment-cash]')
    await page.fill('[data-testid=received-amount]', '50')
    await page.click('[data-testid=confirm-payment]')
    
    // 5. Verificiraj
    await expect(page.locator('[data-testid=receipt]')).toBeVisible()
    await expect(page.locator('[data-testid=furs-eor]')).toBeVisible()
  })
})'''))
story.append(H2('5.4 Test pokritost cilji'))
story.append(TBL([
    ['Modul', 'Trenutna pokritost', 'Cilj', 'Prioriteta'],
    ['FURS', '85%', '95%', 'Visoka (kritično)'],
    ['Payments', '78%', '90%', 'Visoka (finančno)'],
    ['Orders', '82%', '90%', 'Visoka (osnovno)'],
    ['Auth', '92%', '95%', 'Visoka (varnost)'],
    ['Inventory', '65%', '80%', 'Srednja'],
    ['Reports', '55%', '75%', 'Srednja'],
    ['Audit log', '88%', '95%', 'Visoka (compliance)'],
], [100, 110, 70, CONTENT_W-280]))
story.append(C('Tabela 5.2: Test pokritost po modulih'))
story.append(PageBreak())

# 6. CONTRIBUTION WORKFLOW
story.append(H1('6. Contribution workflow'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Postopek za prispevanje kode v RestaurantOS. Vsi prispevki gredo preko Pull Request-ov z minimum 1 reviewer.'))
story.append(H2('6.1 Branching strategija'))
story.append(CODE('''# Branch naming:
feat/<kratki-opis>        # nova funkcionalnost
fix/<kratki-opis>         # bug fix
chore/<kratki-opis>       # maintenance, deps
docs/<kratki-opis>        # dokumentacija
refactor/<kratki-opis>    # refaktoriranje
test/<kratki-opis>        # testi
security/<kratki-opis>    # varnostni fix

# Primeri:
feat/stripe-payment-intent
fix/furs-offline-queue-sync
chore/update-nextjs-16-1
docs/api-documentation'''))
story.append(H2('6.2 Commit convention'))
story.append(CODE('''# Format:
type: kratki opis (imperative mood)

# Types:
feat:     nova funkcionalnost
fix:      bug fix
chore:    maintenance (deps, build, ci)
docs:     dokumentacija
test:     testi
refactor: refaktoriranje brez sprememb funkcionalnosti
perf:     performance izboljšava
security: varnostni fix

# Primeri:
feat: dodan Stripe PaymentIntent endpoint
fix: FURS offline queue sinhronizacija
chore: update Next.js na 16.1
docs: API dokumentacija za payments
test: E2E test za order flow
refactor: extract payment validation v helper
perf: index na orders.locationId
security: rate limit na auth endpoint'''))
story.append(H2('6.3 Pull Request postopek'))
story.append(CODE('''# 1. Ustvari feature branch
git checkout -b feat/my-feature

# 2. Delaj in commit-aj
git add .
git commit -m "feat: dodana nova funkcionalnost"

# 3. Push na fork
git push origin feat/my-feature

# 4. Odpri Pull Request na GitHub
#    - Naslov: "feat: kratki opis"
#    - Opis: kaj, zakaj, kako testirati
#    - Screenshot-i (če UI spremembe)
#    - Link na issue (če obstaja)

# 5. Čakaj na code review (1-2 dni)
#    - Addressiraj komentarje
#    - Push fix-ev na isto branch (auto-updates PR)

# 6. Po odobritvi - SQUASH & MERGE
#    - GitHub UI: "Squash and merge"
#    - Edit commit message za finalno verzijo

# 7. Izbriši feature branch
git branch -d feat/my-feature
git push origin --delete feat/my-feature'''))
story.append(H2('6.4 PR checklist'))
story.append(B('☐ Koda opravi `bun run lint` (brez errorjev)'))
story.append(B('☐ Koda opravi `bun run typecheck` (brez errorjev)'))
story.append(B('☐ Vsi testi opravijo `bun run test`'))
story.append(B('☐ E2E testi opravijo `bun run test:e2e` (za kritične spremembe)'))
story.append(B('☐ Ni `console.log` v produkciji (uporabi `logger`)'))
story.append(B('☐ Ni `any` tipov (uporabi pravilne tipe)'))
story.append(B('☐ Input validacija z Zod na novih endpointih'))
story.append(B('☐ `requireAuth()` na novih API endpointih'))
story.append(B('☐ Rate limiting na občutljivih endpointih'))
story.append(B('☐ Testi za novo funkcionalnost (unit + integration)'))
story.append(B('☐ Dokumentacija posodobljena (JSDoc, README)'))
story.append(B('☐ Ni hardcoded secretov ali API ključev'))
story.append(B('☐ Spremembe so backward compatible (ali pa major version bump)'))
story.append(PageBreak())

# 7. DEBUG IN TROUBLESHOOTING
story.append(H1('7. Debug in troubleshooting'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('7.1 Pogoste težave in rešitve'))
story.append(TBL([
    ['Težava', 'Vzrok', 'Rešitev'],
    ['Prisma client error', 'Sprememba sheme brez generate', 'bun run db:generate'],
    ['Module not found', 'Netočni import path', 'Preveri @/ alias v tsconfig.json'],
    ['Hydration mismatch', 'Server/Client razlika', 'Dodaj "use client" ali useEffect'],
    ['Type error na build', 'TypeScript strict', 'Popravi tip ali dodaj @ts-expect-error'],
    ['FURS timeout', 'Cert geslo narobe', 'Preveri FURS_CERT_PASSWORD'],
    ['Stripe webhook fail', 'Webhook secret narobe', 'Preveri STRIPE_WEBHOOK_SECRET'],
    ['DB connection exhausted', 'Preveč concurrent conn.', 'Restart Neon ali povečaj pool'],
    ['Build fail na Vercel', 'Memory limit', 'Povečaj function memory na 2048MB'],
    ['E2E test flaky', 'Race condition', 'Dodaj waitForSelector'],
], [180, 180, CONTENT_W-360]))
story.append(C('Tabela 7.1: Pogoste težave in rešitve'))
story.append(H2('7.2 Debug orodja'))
story.append(CODE('''# 1. Prisma Studio (DB GUI):
bunx prisma studio
# Odpri http://localhost:5555

# 2. React DevTools:
# Namesti Chrome razširitev "React Developer Tools"

# 3. Network tab (Chrome DevTools):
# - Preveri API klice (status, payload, timing)
# - Filter: /api/ za samo API klice

# 4. Sentry (lokalno):
# - Postavi SENTRY_DSN v .env
# - Sproži napako in preveri Sentry dashboard

# 5. Logging:
# - Uporabi `logger.info()` namesto `console.log()`
# - Logi so vidni v terminalu (dev) in Vercel dashboard (prod)

# 6. Debug mode:
DEBUG=* bun run dev  # verbose logi

# 7. Playwright debug:
bunx playwright test --debug
# - Odpri Playwright Inspector
# - Step-through debugging'''))
story.append(H2('7.3 Performance profiling'))
story.append(CODE('''# 1. Next.js bundle analyzer:
bun run build
# Preveri .next/analyze/ za bundle breakdown

# 2. React Profiler:
# - Namesti React DevTools Profiler
# - Record session in analiziraj re-renders

# 3. Lighthouse:
# - Chrome DevTools → Lighthouse
# - Run audit za Performance, Accessibility, Best Practices

# 4. Vercel Analytics:
# - Dashboard → Analytics
# - Preveri Web Vitals (LCP, FID, CLS)

# 5. Database slow queries:
# - Neon dashboard → Metrics
# - Preveri pg_stat_statements za top queries'''))
story.append(PageBreak())

# 8. DEPLOYMENT
story.append(H1('8. Deployment'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS se deploy-a na Vercel avtomatsko ob push-u na main branch. Staging environment se deploy-a ob push-u na druge branch-e.'))
story.append(H2('8.1 Environment-i'))
story.append(TBL([
    ['Environment', 'URL', 'Branch', 'DB', 'Namen'],
    ['Produkcija', 'restaurantos.app', 'main', 'Neon prod', 'Produkcijska uporaba'],
    ['Staging', 'restaurantos-staging.vercel.app', 'any branch', 'Neon staging', 'Testiranje pred prod'],
    ['Preview', '<branch>.vercel.app', 'PR branch', 'Neon staging', 'Code review test'],
    ['Lokalno', 'localhost:3000', 'working dir', 'PGlite/Neon dev', 'Razvoj'],
], [90, 170, 80, 90, CONTENT_W-430]))
story.append(C('Tabela 8.1: Environment-i'))
story.append(H2('8.2 Deploy postopek'))
story.append(CODE('''# Avtomatski deploy (main → production):
git push origin main
# Vercel avtomatsko zazna push in zaženi build
# Deploy traja 2-5 minut
# Preview na https://restaurantos-<commit>.vercel.app
# Produkcija na https://restaurantos.app (po promote)

# Ročni deploy (Vercel CLI):
vercel                    # deploy na preview
vercel --prod             # deploy na produkcijo

# Promote preview v produkcijo:
# Vercel Dashboard → Deployments → izberi → "Promote to Production"

# Rollback:
# Vercel Dashboard → Deployments → prejšnji → "Promote to Production"'''))
story.append(H2('8.3 Environment variables'))
story.append(TBL([
    ['Spremenljivka', 'Produkcija', 'Staging', 'Lokalno'],
    ['DATABASE_URL', 'Neon prod URL', 'Neon staging URL', 'Neon dev ali PGlite'],
    ['NEXTAUTH_SECRET', 'strong-random', 'strong-random', 'random'],
    ['FURS_ENV', 'production', 'test', 'test'],
    ['FURS_CERT_PATH', './certs/furs-prod.p12', './certs/furs-test.p12', '-'],
    ['FURS_ALLOW_SIMULATION', 'false', 'false', 'true'],
    ['STRIPE_SECRET_KEY', 'sk_live_...', 'sk_test_...', 'sk_test_...'],
    ['STRIPE_WEBHOOK_SECRET', 'whsec_live_...', 'whsec_test_...', '-'],
    ['SENTRY_DSN', 'production DSN', 'staging DSN', '-'],
    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'live key', 'test key', '-'],
], [190, 120, 120, CONTENT_W-430]))
story.append(C('Tabela 8.2: Environment variables po environment-u'))
story.append(H2('8.4 Pred-deploy checklist'))
story.append(B('☐ Vsi testi opravijo (unit + E2E)'))
story.append(B('☐ TypeScript build brez napak'))
story.append(B('☐ ESLint brez napak'))
story.append(B('☐ Code review odobren'))
story.append(B('☐ Migration aplicirana na staging in testirana'))
story.append(B('☐ DB backup narejen (Neon snapshot)'))
story.append(B('☐ Sentry release tag nastavljen'))
story.append(B('☐ Slack #deploys notified'))
story.append(B('☐ Deploy v off-peak uri (22:00-06:00)'))
story.append(B('☐ On-call oseba obveščena'))
story.append(PageBreak())

# 9. RESOURCES
story.append(H1('9. Viri in nadaljnje učenje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('9.1 Notranja dokumentacija'))
story.append(TBL([
    ['Dokument', 'Lokacija', 'Namen'],
    ['Architecture', 'docs/ARCHITECTURE.md', 'Sistemski diagram, moduli'],
    ['Code Review Report', 'docs/CODE-REVIEW-REPORT.md', '85 checks, 11 fixes'],
    ['Production Launch', 'docs/PRODUCTION-LAUNCH-CHECKLIST.md', 'Launch checklist'],
    ['Client Onboarding', 'docs/CLIENT-ONBOARDING-GUIDE.md', 'Stranka navodila'],
    ['ADR Zbirka', 'download/RestaurantOS-ADR-Zbirka.pdf', '12 arhitekturnih odločitev'],
    ['API Dokumentacija', 'download/RestaurantOS-API-Dokumentacija.pdf', '60+ endpointov'],
    ['OpenAPI spec', 'download/openapi.yaml', 'SDK generacija'],
    ['Production Runbook', 'download/RestaurantOS-Production-Runbook.pdf', 'Operacije'],
    ['P0 Sprint Plan', 'download/RestaurantOS-P0-Sprint-Plan.xlsx', '42 nalog'],
], [170, 220, CONTENT_W-390]))
story.append(C('Tabela 9.1: Notranja dokumentacija'))
story.append(H2('9.2 Zunanji viri'))
story.append(B('<b>Next.js 16 docs:</b> https://nextjs.org/docs'))
story.append(B('<b>React 19 docs:</b> https://react.dev'))
story.append(B('<b>Prisma docs:</b> https://www.prisma.io/docs'))
story.append(B('<b>Neon docs:</b> https://neon.tech/docs'))
story.append(B('<b>Tailwind CSS 4:</b> https://tailwindcss.com/docs'))
story.append(B('<b>Vercel docs:</b> https://vercel.com/docs'))
story.append(B('<b>Stripe docs:</b> https://stripe.com/docs'))
story.append(B('<b>FURS docs:</b> https://edavki.durs.si/Documentation'))
story.append(B('<b>Playwright docs:</b> https://playwright.dev'))
story.append(B('<b>Vitest docs:</b> https://vitest.dev'))
story.append(H2('9.3 Kontakti'))
story.append(TBL([
    ['Vloga', 'Kontakt', 'Kdaj kontaktirati'],
    ['Tech Lead', 'robert@restaurantos.app', 'Arhitekturne odločitve, blockers'],
    ['Backend Dev', 'marko@restaurantos.app', 'API, baza, FURS, Stripe'],
    ['Frontend Dev', 'ana@restaurantos.app', 'UI, PWA, komponente'],
    ['QA', 'peter@restaurantos.app', 'Testiranje, E2E, regression'],
    ['Slack #dev', 'restaurantos.slack.com/#dev', 'Hitra vprašanja, help'],
    ['Slack #incidents', 'restaurantos.slack.com/#incidents', 'Produkcijski incidenti'],
    ['GitHub Issues', 'github.com/markec12345678/restaurantos/issues', 'Bug reporti, feature requests'],
], [90, 190, CONTENT_W-280]))
story.append(C('Tabela 9.2: Kontakti za razvoj'))
story.append(CALLOUT('DOBRODOŠLI V EKIP!','Ta vodič je živ dokument - če najdeš napako ali manjkajočo sekcijo, odpri PR z popravkom. Tvoje izkušnje kot nov developer so neprecenljive za izboljšanje tega vodiča za prihodnje člane ekipe. Srečno in dobrodošli v RestaurantOS ekipi!', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Developer Guide', author='Z.ai', subject='Developer onboarding guide', creator='Z.ai')
doc.multiBuild(story)
print(f'Dev guide body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
