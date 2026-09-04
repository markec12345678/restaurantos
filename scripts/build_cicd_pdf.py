#!/usr/bin/env python3
"""RestaurantOS CI/CD Pipeline & DevOps Documentation - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/cicd_body.pdf'

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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · CI/CD Pipeline & DevOps · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building CI/CD Pipeline documentation...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod v CI/CD pipeline'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS uporablja GitHub Actions za continuous integration in Vercel za continuous deployment. Pipeline je razdeljen v 4 workflow datoteke, ki avtomatsko preverjajo kvaliteto kode, buildajo aplikacijo, testirajo in deploy-ajo na produkcijo.'))
story.append(SP(6))
story.append(STATS([
    ('4', 'GitHub Actions workflow-i'),
    ('3', 'CI job-i (quality, build, test)'),
    ('2', 'cron jobs (Vercel)'),
    ('3', 'deployment environment-i'),
]))
story.append(SP(12))
story.append(H2('1.1 Pipeline pregled'))
story.append(CODE('''# GitHub Actions Pipeline (ci.yml):

Push/PR na main/master
       │
       ▼
┌──────────────────────────┐
│  Job 1: QUALITY (10 min) │
│  • Prisma validate       │
│  • Prisma generate       │
│  • ESLint                │
│  • TypeScript typecheck   │
└──────────┬───────────────┘
           │ (needs: quality)
           ▼
┌──────────────────────────┐
│  Job 2: BUILD (20 min)   │
│  • PostgreSQL 16 service  │
│  • Prisma db push         │
│  • Next.js build          │
│  • Build artifacts        │
└──────────┬───────────────┘
           │ (needs: build)
           ▼
┌──────────────────────────┐
│  Job 3: TEST (15 min)    │
│  • Unit tests (Vitest)   │
│  • Integration tests      │
│  • E2E tests (Playwright)│
│  • Coverage report        │
└──────────────────────────┘

# Vercel Deployment (avtomatsko):
Push na main → Vercel build → Preview URL → Promote to Production
Push na PR → Vercel preview deployment'''))
story.append(H2('1.2 Workflow datoteke'))
story.append(TBL([
    ['Datoteka', 'Trigger', 'Namen', 'Trajanje'],
    ['.github/workflows/ci.yml', 'Push/PR na main', 'Lint, typecheck, build, test', '~15 min'],
    ['.github/workflows/db-push.yml', 'Manual/Schedule', 'Prisma db push na staging', '~3 min'],
    ['.github/workflows/test-app.yml', 'Push na PR', 'App-level integration test-i', '~10 min'],
    ['.github/workflows/test-live.yml', 'Schedule (hourly)', 'Live production health check', '~2 min'],
], [180, 120, 200, 60]))
story.append(C('Tabela 1.1: GitHub Actions workflow datoteke'))
story.append(PageBreak())

# 2. CI PIPELINE
story.append(H1('2. CI pipeline - kvaliteta in testiranje'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('2.1 Quality job (lint + typecheck)'))
story.append(P('Prvi job v pipeline-u preverja osnovno kakovost kode. Zažene se ob vsakem push-u ali PR-ju na main/master.'))
story.append(CODE('''# .github/workflows/ci.yml (quality job)

quality:
  name: Lint & Typecheck
  runs-on: ubuntu-latest
  timeout-minutes: 10
  env:
    DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci?schema=public"
  steps:
    - uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 22
    
    - name: Install dependencies
      run: bun install --frozen-lockfile
    
    - name: Validate Prisma schema
      run: bunx prisma validate --schema prisma/schema.prisma
    
    - name: Generate Prisma client
      run: bunx prisma generate
    
    - name: ESLint
      run: bun run lint
    
    - name: TypeScript typecheck
      run: bunx tsc --noEmit'''))
story.append(H2('2.2 Build job (production build)'))
story.append(P('Drugi job build-a aplikacijo z realno PostgreSQL bazo (Docker service). Preverja, da build uspešno gre skozi.'))
story.append(CODE('''# .github/workflows/ci.yml (build job)

build:
  name: Build
  runs-on: ubuntu-latest
  timeout-minutes: 20
  needs: quality
  env:
    DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci?schema=public"
    NEXTAUTH_SECRET: "ci-test-secret-do-not-use-in-prod"
    FURS_ENV: "test"
    FURS_ALLOW_SIMULATION: "true"
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: ci
        POSTGRES_PASSWORD: ci
        POSTGRES_DB: ci
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
    - name: Install dependencies
      run: bun install --frozen-lockfile
    - name: Generate Prisma client
      run: bunx prisma generate
    - name: Push database schema
      run: bunx prisma db push
    - name: Build Next.js
      run: bun run build
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: build-output
        path: .next/
        retention-days: 7'''))
story.append(PageBreak())

# 3. VERCEL DEPLOYMENT
story.append(H1('3. Vercel deployment'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Vercel avtomatsko deploy-a aplikacijo ob vsakem push-u na GitHub. Obstajajo 3 deployment environment-i: produkcija, preview (za PR-je) in development.'))
story.append(H2('3.1 Deployment flow'))
story.append(CODE('''# Automatic deployment flow:

1. Developer push-a na feature branch
   → Vercel ustvari PREVIEW deployment
   → URL: https://restaurantos-<branch>.vercel.app
   → Uporablja STAGING environment variables

2. Developer odpre Pull Request
   → Vercel ustvari preview z PR specifičnim URL
   → Avtomatski komentar na PR z preview linkom
   → Reviewer lahko testira pred merge

3. PR je merged v main
   → Vercel build-a in deploy-a na PRODUCTION
   → URL: https://restaurantos.app (po DNS konfiguraciji)
   → Uporablja PRODUCTION environment variables
   → Sentry release tag se nastavi

4. Rollback (če nekaj gre narobe)
   → Vercel Dashboard → Deployments
   → Izberi prejšnji uspešni deployment
   → Klikni "Promote to Production"
   → Stara verzija postane aktivna v <1 min'''))
story.append(H2('3.2 Vercel konfiguracija'))
story.append(CODE('''# vercel.json

{
  "crons": [
    {
      "path": "/api/scheduled-emails/process",
      "schedule": "0 2 * * *"    // vsak dan ob 2:00
    },
    {
      "path": "/api/cron/outbox",
      "schedule": "0 3 * * *"     // vsak dan ob 3:00
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}'''))
story.append(H2('3.3 Cron jobs'))
story.append(TBL([
    ['Cron', 'Path', 'Namig', 'Namen'],
    ['0 2 * * *', '/api/scheduled-emails/process', 'Dnevno ob 2:00', 'Pošiljanje scheduled emailov (poročila, opomniki)'],
    ['0 3 * * *', '/api/cron/outbox', 'Dnevno ob 3:00', 'Procesiranje outbox queue (async eventi)'],
], [90, 200, 80, CONTENT_W-370]))
story.append(C('Tabela 3.1: Vercel cron jobs'))
story.append(H2('3.4 Environment variables'))
story.append(TBL([
    ['Spremenljivka', 'Produkcija', 'Preview', 'Development'],
    ['DATABASE_URL', 'Neon prod URL', 'Neon staging URL', 'Neon dev ali PGlite'],
    ['NEXTAUTH_SECRET', 'strong-random', 'strong-random', 'random'],
    ['FURS_ENV', 'production', 'test', 'test'],
    ['FURS_CERT_PATH', './certs/furs-prod.p12', './certs/furs-test.p12', '-'],
    ['STRIPE_SECRET_KEY', 'sk_live_...', 'sk_test_...', 'sk_test_...'],
    ['SENTRY_DSN', 'prod DSN', 'staging DSN', '-'],
    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'live key', 'test key', '-'],
], [190, 120, 120, 120]))
story.append(C('Tabela 3.2: Environment variables po environment-u'))
story.append(PageBreak())

# 4. DOCKER
story.append(H1('4. Docker setup'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('RestaurantOS ima Dockerfile za self-hosted deploy (alternative Vercel-u). Uporablja multi-stage build za manjši image in boljšo varnost.'))
story.append(H2('4.1 Multi-stage Dockerfile'))
story.append(CODE('''# Dockerfile (multi-stage, non-root)

# Stage 1: Base
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 3: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 4: Runner (production)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user (security)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]'''))
story.append(H2('4.2 Docker commands'))
story.append(CODE('''# Build image:
docker build -t restaurantos .

# Run container:
docker run -p 3000:3000 \\
  -e DATABASE_URL="postgresql://..." \\
  -e NEXTAUTH_SECRET="..." \\
  -e FURS_ENV="test" \\
  restaurantos

# Run with docker-compose:
docker-compose up -d

# Tag and push to registry:
docker tag restaurantos ghcr.io/markec12345678/restaurantos:latest
docker push ghcr.io/markec12345678/restaurantos:latest

# Pull and run on server:
docker pull ghcr.io/markec12345678/restaurantos:latest
docker run -d --name restaurantos -p 3000:3000 \\
  --env-file .env.production \\
  ghcr.io/markec12345678/restaurantos:latest'''))
story.append(H2('4.3 Docker security best practices'))
story.append(B('<b>Non-root user</b> - aplikacija teče kot `nextjs` (UID 1001), ne root'))
story.append(B('<b>Multi-stage build</b> - build artifacts ločeni od production image-a'))
story.append(B('<b>Read-only filesystem</b> - `--read-only` flag v production'))
story.append(B('<b>No secrets in image</b> - vse skozi environment variables'))
story.append(B('<b>Image scanning</b> - Trivy v CI pipeline za ranljivosti'))
story.append(B('<b>Minimal base image</b> - `node:20-alpine` (manj attack surface)'))
story.append(PageBreak())

# 5. BRANCH PROTECTION
story.append(H1('5. Branch protection in GitHub'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('GitHub branch protection rules zagotavljajo, da koda na main veji vedno prestane vse preglede in teste.'))
story.append(H2('5.1 Branch protection rules (main)'))
story.append(TBL([
    ['Pravilo', 'Nastavitev', 'Namen'],
    ['Require pull request', '✅ Enabled', 'Niž direktnih push-ov na main'],
    ['Required reviewers', 'Min 1', 'Code review pred merge'],
    ['Dismiss stale reviews', '✅ Enabled', 'Nov commit invalidira stare reviews'],
    ['Require status checks', '✅ Enabled', 'CI mora pasti pred merge'],
    ['Required CI checks', 'quality + build', 'Lint, typecheck, build'],
    ['Require branches up-to-date', '✅ Enabled', 'Merge z latest main pred merge'],
    ['Require signed commits', '❌ Disabled', 'Zaenkrat ne (lahko omogoči kasneje)'],
    ['Require linear history', '✅ Enabled', 'Squash merge (čist history)'],
    ['Allow force pushes', '❌ Disabled', 'Nikoli na main'],
    ['Allow deletions', '❌ Disabled', 'Nikoli ne briši main'],
], [200, 100, CONTENT_W-300]))
story.append(C('Tabela 5.1: Branch protection rules za main'))
story.append(H2('5.2 Konfiguracija v GitHub'))
story.append(CODE('''# GitHub Settings → Branches → Branch protection rules
# (ročno nastavi v GitHub UI)

Repository: markec12345678/restaurantos
Settings → Branches → Add rule

Branch name pattern: main
☐ Require pull request reviews before merging
   Minimum required reviewers: 1
   ☐ Dismiss stale pull request approvals when new commits are pushed
   ☐ Require review from Code Owners
☐ Require status checks to pass before merging
   ☐ Require branches to be up to date before merging
   Status checks: quality, build
☐ Require conversation resolution before merging
☐ Require linear history
☐ Do not allow bypassing the above settings'''))
story.append(PageBreak())

# 6. SECRET MANAGEMENT
story.append(H1('6. Secret management'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Tajni ključi se hranijo na 3 mestih: GitHub Secrets (CI/CD), Vercel Environment Variables (runtime) in .env (lokalni razvoj). Nikoli ne v kodi ali Git-u.'))
story.append(H2('6.1 GitHub Secrets'))
story.append(TBL([
    ['Secret', 'Namig', 'Uporabljen v'],
    ['NEON_DATABASE_URL', 'Neon production connection string', 'db-push.yml workflow'],
    ['NEON_STAGING_DATABASE_URL', 'Neon staging connection string', 'db-push.yml workflow'],
    ['VERCEL_TOKEN', 'Vercel deploy token', 'test-live.yml workflow'],
    ['SENTRY_AUTH_TOKEN', 'Sentry release token', 'ci.yml (release creation)'],
    ['STRIPE_SECRET_KEY', 'Stripe live secret', 'Samo v Vercel (ne v CI)'],
    ['FURS_CERT_PASSWORD', 'FURS cert geslo', 'Samo v Vercel (ne v CI)'],
], [200, 200, CONTENT_W-400]))
story.append(C('Tabela 6.1: GitHub Secrets'))
story.append(H2('6.2 Secret scanning'))
story.append(B('<b>gitleaks</b> - skenira kodo za tajne ključe ob vsakem commit-u'))
story.append(B('<b>GitHub Secret Scanning</b> - vgrajeno v GitHub (settings → Security → Secret scanning)'))
story.append(B('<b>Dependabot</b> - preverja odvisnosti za znane ranljivosti'))
story.append(CODE('''# gitleaks v CI (pre-commit hook):
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

# GitHub Dependabot:
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"'''))
story.append(PageBreak())

# 7. MONITORING INTEGRATION
story.append(H1('7. Monitoring in alerting integracija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('CI/CD pipeline je integriran z Sentry za error tracking in GitHub Status za deployment status.'))
story.append(H2('7.1 Sentry release tracking'))
story.append(CODE('''# Sentry release creation v CI (po uspešnem build-u):
# .github/workflows/ci.yml (dodaj v build job)

- name: Create Sentry release
  if: github.ref == 'refs/heads/main'
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  with:
    environment: production
    version: ${{ github.sha }}
    set_commits: skip
    projects: restaurantos
    
# Sentry source maps upload (za stack traces):
- name: Upload Sentry source maps
  if: github.ref == 'refs/heads/main'
  run: |
    npx sentry-cli sourcemaps upload --release=${{ github.sha }} .next/static/chunks/'''))
story.append(H2('7.2 GitHub deployment status'))
story.append(CODE('''# GitHub Deployment API (avtomatsko preko Vercel):
# Ko Vercel deploy-a, ustvari GitHub Deployment:

POST /repos/{owner}/{repo}/deployments
{
  "ref": "main",
  "environment": "production",
  "description": "Vercel deployment",
  "required_contexts": ["ci/quality", "ci/build"]
}

# Status se posodobi:
# → "pending" (build in progress)
# → "success" (deploy successful)
# → "failure" (deploy failed)
# → "error" (build error)

# Vidno v GitHub UI: Repository → Deployments'''))
story.append(H2('7.3 CI/CD metrike'))
story.append(TBL([
    ['Metrika', 'Cilj', 'Merenje', 'Alert če'],
    ['Build duration', '< 20 min', 'GitHub Actions', '> 30 min'],
    ['Test pass rate', '100%', 'CI test job', '< 95%'],
    ['Deploy frequency', 'Dnevno', 'Vercel + GitHub', 'Ni deploy-a 3 dni'],
    ['Lead time (commit → prod)', '< 1 ura', 'GitHub timestamps', '> 4 ure'],
    ['MTTR (mean time to recover)', '< 1 ura', 'Incident log', '> 4 ure'],
    ['Change failure rate', '< 10%', 'Failed deploys / total', '> 20%'],
], [200, 80, 130, 100]))
story.append(C('Tabela 7.1: CI/CD metrike in alerti'))
story.append(PageBreak())

# 8. ROLLBACK
story.append(H1('8. Rollback in recovery'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Rollback je hiter in enostaven preko Vercel dashboard-a. Vsak deployment ima svoj URL in je takoj promoviran v produkcijo.'))
story.append(H2('8.1 Rollback postopek'))
story.append(CODE('''# Rollback preko Vercel Dashboard:
1. https://vercel.com/robertpezdirc12/restaurantos/deployments
2. Poišči zadnji "Ready" deployment PRED incidentom
3. Klikni "..." → "Promote to Production"
4. Potrdi - nov production deployment = stara verzija
5. Preveri /api/health
6. Preveri Sentry (ali so errorji izginili)
7. Komuniciraj strankam (status page update)

# Rollback preko Vercel CLI:
vercel rollback <deployment-url>

# Po rollback:
- Preveri /api/health → 200 OK
- Preveri Sentry → novi errorji?
- Preveri DB → pravilni podatki?
- Komuniciraj na Slack #incidents
- Napiši post-mortem v 24h'''))
story.append(H2('8.2 Database rollback (Neon PITR)'))
story.append(CODE('''# Neon Point-in-Time Recovery:
1. Neon Console → ep-solitary-term-anhf13uv
2. Restore → Point in Time
3. Izberi časovno točko (pred incidentom)
4. Nov branch se ustvari z restored stanjem
5. Testiraj na branch-u
6. Posodobi DATABASE_URL v Vercel (promote branch to main)

# PRIPOROČILO: Pred restore naredi snapshot trenutnega stanja!'''))
story.append(PageBreak())

# 9. BEST PRACTICES
story.append(H1('9. DevOps best practices'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(H2('9.1 Commit in branch strategija'))
story.append(B('<b>Trunk-based development</b> - kratke feature branch-e (1-2 dni), pogosto merge v main'))
story.append(B('<b>Squash merge</b> - čist history, en commit per PR'))
story.append(B('<b>Conventional commits</b> - feat:, fix:, chore:, docs:, test:, refactor:'))
story.append(B('<b>PR description</b> - kaj, zakaj, kako testirati, screenshot-i'))
story.append(B('<b>Small PRs</b> - <400 vrstic za lažji review'))
story.append(H2('9.2 Testing strategija'))
story.append(B('<b>Test pyramid</b> - 70% unit, 20% integration, 10% E2E'))
story.append(B('<b>CI run-a vse teste</b> - pred vsakim merge v main'))
story.append(B('<b>Parallel test execution</b> - Playwright test-i v paralelnih runnerjih'))
story.append(B('<b>Test data</b> - seedani demo podatki v testnem okolju'))
story.append(B('<b>Flaky test management</b> - quarantine + fix v 24h'))
story.append(H2('9.3 Deployment best practices'))
story.append(B('<b>Deploy v off-peak</b> - 22:00-06:00 (manj strank aktivnih)'))
story.append(B('<b>Blue-green deploy</b> - Vercel to omogoča (instant rollback)'))
story.append(B('<b>Database migrations</b> - backward compatible (dodaj stolpec, ne briši)'))
story.append(B('<b>Feature flags</b> - za postopno rollout (LaunchDarkly ali custom)'))
story.append(B('<b>Canary releases</b> - 10% traffic → 50% → 100%'))
story.append(H2('9.4 Security best practices'))
story.append(B('<b>Least privilege</b> - CI/CD ima samo potrebne pravice'))
story.append(B('<b>Rotate secrets</b> - vsako leto (NEXTAUTH_SECRET, STRIPE keys)'))
story.append(B('<b>Audit access</b> - GitHub audit log + Vercel access log'))
story.append(B('<b>Dependency scanning</b> - Dependabot + npm audit v CI'))
story.append(B('<b>Container scanning</b> - Trivy za Docker images'))
story.append(H2('9.5 Performance best practices'))
story.append(B('<b>Build caching</b> - GitHub Actions cache + Vercel build cache'))
story.append(B('<b>Bundle analysis</b> - @next/bundle-analyzer v CI'))
story.append(B('<b>Lighthouse CI</b> - performance regression detection'))
story.append(B('<b>Bundle size limit</b> - <2MB gzipped (warning), <3MB (error)'))
story.append(CALLOUT('CI/CD ZAKLJUČEK','RestaurantOS ima robusten CI/CD pipeline z GitHub Actions (lint, typecheck, build, test) in Vercel (auto-deploy, preview, rollback). Pipeline zagotavlja kakovost kode (0 errorjev pred merge), hitro feedback zanko (~15 min) in zanesljiv deploy z instant rollback. Priporočena DORA metrika: deploy frequency dnevno, lead time <1h, MTTR <1h, change failure rate <10%.', ACCENT))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - CI/CD Pipeline & DevOps', author='Z.ai', subject='CI/CD dokumentacija', creator='Z.ai')
doc.multiBuild(story)
print(f'CI/CD body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
