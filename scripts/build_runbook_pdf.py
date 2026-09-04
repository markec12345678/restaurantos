#!/usr/bin/env python3
"""RestaurantOS Production Runbook - PDF builder."""
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
OUTPUT_BODY='/home/z/my-project/scripts/runbook_body.pdf'

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
        c.drawString(MARGIN,MARGIN-18,'RestaurantOS · Production Runbook · 2025')
        c.drawRightString(PAGE_W-MARGIN,MARGIN-18,f'Stran {d.page}'); c.restoreState()
    def afterFlowable(self,f):
        if hasattr(f,'bookmark_name'):
            self.notify('TOCEntry',(getattr(f,'bookmark_level',0),getattr(f,'bookmark_text',''),self.page,getattr(f,'bookmark_key','')))

print('Building Production Runbook...')
story=[]

# TOC
toc=TableOfContents(); toc.levelStyles=[toc1,toc2]
story.append(Paragraph('<b>Kazalo vsebine</b>',h1_style))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=14)); story.append(toc); story.append(PageBreak())

# 1. UVOD
story.append(H1('1. Uvod in kontakti'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Ta runbook vsebuje operativna navodila za vzdrževanje RestaurantOS v produkciji. Namenjen je Tech Lead-u (Robert Pezdirc), Backend/Frontend developerjem in on-call osebam. Dokument pokriva: dnevne operacije, monitoring, incident response, postopke za rollback, backup/restore in kontaktne informacije.'))
story.append(H2('1.1 Kontaktne informacije'))
story.append(TBL([
    ['Vloga', 'Ime', 'Kontakt', 'Odgovornost'],
    ['Tech Lead', 'Robert Pezdirc', 'robert@restaurantos.app / +386 41 XXX XXX', 'Končne odločitve, deploy odobritev'],
    ['Backend Dev', 'Marko Kos', 'marko@restaurantos.app / +386 31 XXX XXX', 'API, baza, FURS, Stripe backend'],
    ['Frontend Dev', 'Ana Horvat', 'ana@restaurantos.app / +386 51 XXX XXX', 'UI, PWA, Stripe Elements'],
    ['QA', 'Peter Leban', 'peter@restaurantos.app / +386 70 XXX XXX', 'Testiranje, E2E, regression'],
    ['On-call (24/7)', 'Rotacija ekipe', 'oncall@restaurantos.app', 'Kritični incidenti izven delovnega časa'],
    ['Stranka (FURS)', 'Info FURS', '+386 1 478 3000', 'Vprašanja glede certifikatov in davkov'],
    ['Stranka (Stripe)', 'Stripe Support', 'support.stripe.com', 'Plačilni disputi, webhook issues'],
], [80, 110, 180, CONTENT_W-370]))
story.append(C('Tabela 1.1: Kontaktne informacije'))
story.append(H2('1.2 Kritične informacije'))
story.append(CALLOUT('PRODUKCIJSKI URL-JI',
    'Produkcija: https://restaurantos.app (po DNS konfiguraciji)\n'
    'Staging: https://restaurantos-staging.vercel.app\n'
    'Vercel Dashboard: https://vercel.com/robertpezdirc12/restaurantos\n'
    'Neon DB: https://console.neon.tech (project: ep-solitary-term-anhf13uv)\n'
    'Sentry: https://sentry.io/organizations/restaurantos\n'
    'Stripe Dashboard: https://dashboard.stripe.com',
    SEM_INFO))
story.append(H2('1.3 SLO (Service Level Objectives)'))
story.append(TBL([
    ['Metrika', 'Cilj', 'Kritično', 'Meritev'],
    ['Uptime', '99.5%', '99.0%', 'Vercel + UptimeRobot'],
    ['API odzivni čas (p95)', '<500ms', '<2s', 'Sentry Performance'],
    ['API odzivni čas (p99)', '<2s', '<5s', 'Sentry Performance'],
    ['FURS zahtevek uspešnost', '>99%', '>95%', 'Custom metric v Sentry'],
    ['Stripe plačilo uspešnost', '>99.5%', '>98%', 'Stripe Dashboard'],
    ['Error rate', '<0.5%', '<2%', 'Sentry'],
    ['DB query time (p95)', '<100ms', '<500ms', 'Neon metrics'],
], [180, 80, 80, CONTENT_W-340]))
story.append(C('Tabela 1.2: SLO metrike'))
story.append(PageBreak())

# 2. DNEVNE OPERACIJE
story.append(H1('2. Dnevne operacije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Dnevne rutine za ohranjanje zdravja sistema. Te operacije naj bi Tech Lead ali on-call oseba izvedla vsak dan (zjutraj, pred obremenitvami).'))
story.append(H2('2.1 Jutranji pregled (9:00)'))
story.append(B('<b>Sentry dashboard</b> - preveri nove napake v zadnjih 24h; če so kritične, obravnavaj takoj'))
story.append(B('<b>Vercel dashboard</b> - preveri deploy status, function duration, bandwidth'))
story.append(B('<b>Neon DB</b> - preveri connection count, slow queries, storage usage'))
story.append(B('<b>Stripe dashboard</b> - preveri failed payments, disputes, webhook delivery'))
story.append(B('<b>UptimeRobot</b> - preveri uptime v zadnjih 24h; če <99.5%, raziskuj'))
story.append(B('<b>FURS cert-status</b> - preveri veljavnost certifikata (GET /api/furs/cert-status)'))
story.append(CODE('''# Hitri health check (zjutraj)
curl https://restaurantos.app/api/health
# Pričakovan: { status: "ok", db: "connected", sentry: "configured" }

# Sentry recent errors (zadnjih 24h)
# https://sentry.io/organizations/restaurantos/issues/?statsPeriod=24h

# Vercel function logs
# https://vercel.com/robertpezdirc12/restaurantos/_logs'''))
story.append(H2('2.2 Tedenski pregled (ponedeljek)'))
story.append(B('<b>Sentry trends</b> - preveri trende napak (upadanje/rast)'))
story.append(B('<b>Performance</b> - preveri p95/p99 trende; če raste, optimiziraj'))
story.append(B('<b>DB storage</b> - preveri rast baze; če >80% kapacitete, čisti stare loge'))
story.append(B('<b>Stripe volume</b> - preveri tedenski volumen plačil in provizije'))
story.append(B('<b>FURS cert veljavnost</b> - preveri datum poteka; če <60 dni, obvesti stranko'))
story.append(B('<b>Backup verification</b> - preveri, da so Neon backupi uspešni (daily)'))
story.append(B('<b>Dependencies update</b> - preveri `bun outdated`, načrtuj update'))
story.append(H2('2.3 Mesečni pregled (1. v mesecu)'))
story.append(B('<b>Sentry plan</b> - preveri porabo eventov (free plan = 5000/mes)'))
story.append(B('<b>Vercel plan</b> - preveri bandwidth in function execution'))
story.append(B('<b>Neon plan</b> - preveri storage in compute hours'))
story.append(B('<b>Stripe izpave</b> - preveri monthly statement, provizije'))
story.append(B('<b>Security audit</b> - preveri nove Sentry alerts, dependency vulnerabilities'))
story.append(B('<b>KPI review</b> - št. aktivnih strank, MRR, churn rate'))
story.append(PageBreak())

# 3. MONITORING
story.append(H1('3. Monitoring in alerting'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Sistem monitoring je razdeljen na 4 plasti: uptime, aplikacijske napake, performance in business metrike.'))
story.append(H2('3.1 Uptime monitoring (UptimeRobot)'))
story.append(P('UptimeRobot brezplačno spremlja /api/health endpoint vsakih 5 minut. Če endpoint ne odgovori v 30 sekundah, se sproži email/SMS alert.'))
story.append(CODE('''# Setup UptimeRobot:
# 1. https://uptimerobot.com → Register
# 2. Add Monitor → HTTP(s)
# 3. URL: https://restaurantos.app/api/health
# 4. Interval: 5 minutes
# 5. Alert contacts: oncall@restaurantos.app + SMS

# Health endpoint response (200 OK):
{
  "status": "ok",
  "timestamp": "2025-09-04T10:30:00Z",
  "db": "connected",
  "sentry": "configured",
  "version": "1.0.0"
}'''))
story.append(H2('3.2 Sentry - napake in performance'))
story.append(P('RestaurantOS uporablja Sentry za error tracking, performance monitoring in session replay. Konfiguracija je v sentry.client.config.ts, sentry.server.config.ts in sentry.edge.config.ts.'))
story.append(TBL([
    ['Komponenta', 'Sample rate', 'Namig', 'Kdaj povečati'],
    ['Errors', '100% (vsi)', 'Vsi errorji se capture-ajo', 'Vedno 100%'],
    ['Performance (traces)', '10%', '10% zahtevkov se spremlja', 'Pri performance issue → 25%'],
    ['Session Replay', '1%', '1% sejev se snema', 'Pri UX bug → 10%'],
    ['Profiles', 'Off', 'CPU profiling', 'Pri CPU spikes'],
], [150, 80, 150, CONTENT_W-380]))
story.append(C('Tabela 3.1: Sentry sample rates'))
story.append(H3('Sentry alert rules'))
story.append(B('<b>Critical error</b> - vsak new issue z level=error → email + Slack takoj'))
story.append(B('<b>Error rate >2%</b> - v 5-minutnem oknu → email + SMS'))
story.append(B('<b>p95 >2s</b> - v 10-minutnem oknu → email'))
story.append(B('<b>FURS failure rate >5%</b> - custom metric → email + SMS'))
story.append(H2('3.3 Neon DB monitoring'))
story.append(P('Neon dashboard prikazuje: active connections, slow queries, storage usage, compute hours. Free plan vključuje 0.5 GB storage in 100 compute hours/mes.'))
story.append(CODE('''# Preveri DB health:
# 1. Neon Console → ep-solitary-term-anhf13uv
# 2. Metrics tab:
#    - Active connections (should be < 10)
#    - Query latency (p95 < 100ms)
#    - Storage usage (alert at 80%)
#    - Compute hours (alert at 80% of monthly limit)

# Slow queries (run v Neon SQL editor):
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;'''))
story.append(H2('3.4 Business metrike'))
story.append(P('Business metrike se spremljajo preko custom dashboarda v Sentry ali v aplikaciji sami (/admin/dashboard).'))
story.append(TBL([
    ['Metrika', 'Cilj', 'Alert če', 'Vir'],
    ['Aktivne stranke (mesečno)', 'Rast 10%/mes', 'Padec 5%', 'DB - User count'],
    ['Naročila na dan', '>100/dan', '<50/dan', 'DB - Order count'],
    ['FURS uspešnost', '>99%', '<95%', 'DB - Order.fursEor not null'],
    ['Stripe volumen (mesečno)', '>10k EUR', '<5k EUR', 'Stripe Dashboard'],
    ['Stripe provizije', '<2.5% volumena', '>3%', 'Stripe Dashboard'],
    ['Churn rate (mesečno)', '<5%', '>10%', 'DB - canceled subscriptions'],
], [180, 100, 90, CONTENT_W-370]))
story.append(C('Tabela 3.2: Business metrike in alerti'))
story.append(PageBreak())

# 4. INCIDENT RESPONSE
story.append(H1('4. Incident response'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Postopek za obravnavo produkcijskih incidentov. Cilj: minimalni downtime, hitra komunikacija s strankami, root cause analiza po incidentu.'))
story.append(CALLOUT('SEVERITY LEVELS',
    'SEV-1 (Kritično): Aplikacija nedosegljiva, FURS ne deluje, plačila ne delujejo → response v 15 min\n'
    'SEV-2 (Visoko): Del funkcionalnosti ne deluje, vpliva na več strank → response v 1h\n'
    'SEV-3 (Srednje): Posamezna stranka ima problem, workaround obstaja → response v 4h\n'
    'SEV-4 (Nizko): Kozmetične napake, ni vpliva na poslovanje → response v 24h',
    SEM_ERROR))
story.append(H2('4.1 SEV-1 postopek (kritični incident)'))
story.append(H3('Koraki ob prejemu alerta'))
story.append(B('<b>1. Potrdi incident</b> (5 min) - reproduciraj, preveri Sentry in uptime'))
story.append(B('<b>2. Obvesti ekipo</b> (5 min) - Slack #incidents, klic on-call osebam'))
story.append(B('<b>3. Komuniciraj strankam</b> (10 min) - status.restaurantos.app, email'))
story.append(B('<b>4. Identificiraj root cause</b> (15 min) - Sentry logs, Vercel logs, DB'))
story.append(B('<b>5. Odloči: fix forward ali rollback</b> (5 min)'))
story.append(B('<b>6. Implementiraj fix</b> (15-60 min) - hotfix branch, test, deploy'))
story.append(B('<b>7. Verificiraj</b> (10 min) - preveri, da incident rešen'))
story.append(B('<b>8. Komuniciraj razrešitev</b> (5 min) - update status page'))
story.append(B('<b>9. Post-mortem</b> (24h) - root cause analysis, preventivni ukrepi'))
story.append(H3('Komunikacijska predloga'))
story.append(CODE('''# Status page update (SEV-1):
Title: [SEV-1] <kratek opis incidenta>
Status: Investigating / Identified / Monitoring / Resolved
Impact: <kdo je prizadet, kaj ne deluje>
Started: <timestamp>
Updates:
  - <time>: Investigating - preverjamo obseg incidenta
  - <time>: Identified - root cause: <opis>
  - <time>: Monitoring - fix deployed, spremljamo
  - <time>: Resolved - incident resolved. Post-mortem sledi v 24h.

# Email strankam (samo SEV-1 z dolgotrajnim vplivom):
Subject: [RestaurantOS] Incident - <kratek opis>
Body: Spoštovani, prihajamo do obvestila o incidentu, ki je
potekal od <start> do <end>. <Opis kaj je bilo prizadeto>.
Opravičujemo se za nevšečnosti. V kolikor imate vprašanja,
kontaktirajte support@restaurantos.app.'''))
story.append(H2('4.2 Pogosti incidenti in rešitve'))
story.append(TBL([
    ['Incident', 'Simptomi', 'Hitra rešitev', 'Root cause preiskava'],
    ['Aplikacija nedosegljiva', '502/503 na /api/health', 'Vercel redeploy iz zadnjega good commit', 'Vercel logs, function timeout'],
    ['DB connection exhausted', '500 na API klicih', 'Restart Neon, povečaj pool', 'Neon active connections'],
    ['FURS timeout', 'Order creation ne konča', 'Preklopi v offline mode (avtomatsko)', 'FURS API status, cert validnost'],
    ['Stripe webhook fail', 'Payment.status stuck "pending"', 'Replay webhook iz Stripe dashboard', 'Stripe webhook logs'],
    ['Memory leak', 'Vercel OOM error', 'Redeploy (restart)', 'Heap snapshot analysis'],
    ['DDoS napad', 'Visok traffic, 429 errors', 'Vercel firewall, rate limit', 'Vercel attack logs'],
], [150, 130, 150, CONTENT_W-430]))
story.append(C('Tabela 4.1: Pogosti incidenti in hitre rešitve'))
story.append(H2('4.3 Rollback postopek'))
story.append(P('Rollback se izvede preko Vercel dashboard-a. Vsak deploy ustvari "deployment URL", na katerega se lahko vrneš.'))
story.append(CODE('''# Rollback preko Vercel dashboard:
# 1. https://vercel.com/robertpezdirc12/restaurantos/deployments
# 2. Poišči zadnji "Ready" deployment pred incidentom
# 3. Klikni "..." → "Promote to Production"
# 4. Potrdi - nov production deployment = stara verzija

# Preko Vercel CLI:
vercel rollback <deployment-url>

# Po rollback:
# - Preveri /api/health
# - Preveri Sentry (ali so errorji izginili)
# - Komuniciraj strankam (status page update)'''))
story.append(PageBreak())

# 5. BACKUP IN RESTORE
story.append(H1('5. Backup in restore'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Strategija backup-a za podatkovno bazo in kritične datoteke. RestaurantOS uporablja Neon PostgreSQL, ki ima vgrajen point-in-time recovery.'))
story.append(H2('5.1 Neon DB backup'))
story.append(TBL([
    ['Komponenta', 'Frekvenca', 'Retencija', 'Restore postopek'],
    ['Neon automatic PITR', 'Continuouly', '7 days (free plan)', 'Neon Console → Restore'],
    ['Neon branch snapshot', 'Manual', 'Unlimited', 'Neon Console → Branches'],
    ['Code (Git)', 'Every commit', 'Forever (GitHub)', 'git checkout <commit>'],
    ['Env variables (Vercel)', 'Manual export', 'Forever', 'Vercel → Settings → Environment Variables'],
    ['FURS cert (.p12)', 'On upload', 'Forever (filesystem)', 'Restore from ./certs/ ali re-upload'],
    ['Sentry events', 'Real-time', '30 days (free)', 'Sentry dashboard'],
], [150, 100, 130, CONTENT_W-380]))
story.append(C('Tabela 5.1: Backup komponente'))
story.append(H2('5.2 DB restore postopek'))
story.append(CODE('''# Neon Point-in-Time Recovery (PITR):
# 1. Neon Console → ep-solitary-term-anhf13uv
# 2. Restore → Point in Time
# 3. Izberi časovno točko (pred incidentom)
# 4. Nov branch se ustvari z restored stanjem
# 5. Testiraj na branch-u
# 6. Promote branch to main (ALI posodobi DATABASE_URL)

# Restore posamezne tabele (manual SQL export/import):
# 1. Export iz backup branch:
psql $BACKUP_URL -c "\\copy orders TO '/tmp/orders.csv' CSV HEADER"

# 2. Import v produkcijo:
psql $PROD_URL -c "\\copy orders FROM '/tmp/orders.csv' CSV HEADER"

# PRIPOROČILO: Pred restore naredi snapshot trenutnega stanja!'''))
story.append(H2('5.3 Disaster recovery (DR)'))
story.append(P('V primeru katastrofalne okvare (izguba baze, Vercel nedosegljiv):'))
story.append(B('<b>RTO (Recovery Time Objective):</b> 4 ure (čas do obnovitve)'))
story.append(B('<b>RPO (Recovery Point Objective):</b> 1 ura (največja izguba podatkov)'))
story.append(B('<b>DR postopek:</b>'))
story.append(B('1. Kreiraj nov Neon project (če celoten project nedosegljiv)'))
story.append(B('2. Restore iz zadnjega backup-a (PITR do 7 dni nazaj)'))
story.append(B('3. Posodobi DATABASE_URL v Vercel environment variables'))
story.append(B('4. Redeploy aplikacijo na Vercel'))
story.append(B('5. Verificiraj /api/health in kritične poti'))
story.append(B('6. Obvesti stranke o obnovitvi'))
story.append(PageBreak())

# 6. FURS OPERACIJE
story.append(H1('6. FURS operacije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Operativna navodila za FURS modul. FURS (Finančna uprava RS) zahteva strogo skladnost - napake lahko privedejo do glob.'))
story.append(H2('6.1 FURS certifikat management'))
story.append(B('<b>Veljavnost:</b> FURS certifikati potečejo po 5 letih'))
story.append(B('<b>Renewal:</b> Stranka pridobi nov certifikat prek ToZS portala 60 dni pred potekom'))
story.append(B('<b>Monitoring:</b> cert-status API opozarja 90 dni pred potekom'))
story.append(B('<b>Rotacija:</b> FURS rotira signing certifikate občasno (zadnja rotacija 15. sep 2025)'))
story.append(CALLOUT('FURS CERT RENEWAL PROCES',
    '1. 90 dni pred potekom: cert-status API pošlje alert\n'
    '2. Tech Lead obvesti stranko (email + telefon)\n'
    '3. Stranka pridobi nov certifikat na ToZS portalu (2-3 tedni)\n'
    '4. Stranka upload-a nov .p12 prek Admin UI\n'
    '5. Test v FURS test okolju\n'
    '6. Preklop na produkcijo\n'
    '7. Stari certifikat se arhivira (./certs/archive/)',
    SEM_WARNING))
story.append(H2('6.2 FURS offline mode'))
story.append(P('Če FURS API ni dosegljiv, RestaurantOS avtomatsko preklopi v offline mode. FURS zahtevki se shranjujejo v queue in pošljejo, ko povezava povrne. FURS dovoli 48h zamik pri potrjevanju.'))
story.append(CODE('''# Preveri offline queue status:
curl https://restaurantos.app/api/furs/offline-queue
# Response: { count: 5, oldest: "2025-09-04T10:00:00Z" }

# Ročno sinhroniziraj queue:
curl -X POST https://restaurantos.app/api/furs/sync \\
  -H "Authorization: Bearer <admin-token>"

# Če queue ne izprazni po 24h:
# 1. Preveri FURS API status (https://edavki.durs.si)
# 2. Preveri certifikat veljavnost
# 3. Preveri Sentry za napake
# 4. Kontaktiraj FURS support če problem persistent'''))
story.append(H2('6.3 FURS zakonodaja'))
story.append(B('<b>ZDDV-1</b> - Zakon o davku na dodano vrednost (zahteva davčno potrjevanje)'))
story.append(B('<b>ZKnjG-1</b> - Zakon o knjigovodskih listinah (zahteva 8-letno hrambo)'))
story.append(B('<b>GIEN</b> - Pravilnik o davčnem potrjevanju računov (tehnične specifikacije)'))
story.append(B('<b>Hramba računov:</b> 8 let v elektronski obliki (FURS e-invoice book)'))
story.append(PageBreak())

# 7. STRIPE OPERACIJE
story.append(H1('7. Stripe operacije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Operativna navodila za Stripe plačilni modul. Stripe zahteva aktivno monitoring zaradi disputov in chargeback-ov.'))
story.append(H2('7.1 Dnevni Stripe pregled'))
story.append(B('<b>Failed payments</b> - preveri razloge (card declined, insufficient funds, fraud)'))
story.append(B('<b>Disputes</b> - novi disputi v zadnjih 24h; odgovori v 7 dneh'))
story.append(B('<b>Webhook delivery</b> - preveri, da vsi webhooki uspešno dostavljeni'))
story.append(B('<b>Balance</b> - preveri daily payout in bank transfer'))
story.append(B('<b>Stripe logs</b> - preveri API errors in rate limiting'))
story.append(H2('7.2 Disput management'))
story.append(CODE('''# Disput postopek:
# 1. Prejmi email od Stripe o novem disputu
# 2. Prijavi v Sentry kot "Stripe Dispute" (custom event)
# 3. Odpri Stripe Dashboard → Disputes
# 4. Zberi dokaze:
#    - Order details (iz RestaurantOS DB)
#    - Payment Intent details (Stripe API)
#    - FURS račun (PDF)
#    - Korespondenca s stranko (če obstaja)
# 5. Oddaj evidence v 7 dneh
# 6. Sledi statusu (won/lost)
# 7. Če izgubljen - refund stranki in zapiši kot loss'''))
story.append(H2('7.3 Webhook troubleshooting'))
story.append(P('Če Stripe webhooki ne pridejo do aplikacije:'))
story.append(CODE('''# 1. Preveri Stripe Dashboard → Developers → Webhooks
#    - Endpoint: https://restaurantos.app/api/payment-gateways/webhook
#    - Status: Enabled
#    - Recent deliveries: ali so "Succeeded" ali "Failed"

# 2. Če "Failed" - preveri Sentry za napake v webhook handlerju

# 3. Replay failed webhook:
#    Stripe Dashboard → Webhook → "...": → "Resend"

# 4. Test lokalno z Stripe CLI:
stripe listen --forward-to localhost:3000/api/payment-gateways/webhook
stripe trigger payment_intent.succeeded

# 5. Preveri signature verification:
#    - STRIPE_WEBHOOK_SECRET pravilno nastavljen?
#    - stripe-signature header prisoten?
#    - tolerance (5 min) ni presežena?'''))
story.append(PageBreak())

# 8. SECURITY OPERACIJE
story.append(H1('8. Security operacije'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Varnostne rutine za ohranjanje A+++ varnostne ocene. Vključuje: dependency scanning, secret rotation, audit log review in incident response.'))
story.append(H2('8.1 Dependency scanning'))
story.append(CODE('''# Tedensko preveri ranljivosti:
bun audit          # Next.js built-in audit
npx audit-ci       # CI/CD integration

# Za kritične ranljivosti (CVE):
# 1. Ocenitev severity (low/medium/high/critical)
# 2. Če critical - patch v 24h
# 3. Če high - patch v 7 dneh
# 4. Če medium/low - načrtuj v naslednjem sprintu

# GitHub Dependabot:
# Settings → Security & analysis → Dependabot alerts → Enabled
# Avtomatski PR-ji za security updates'''))
story.append(H2('8.2 Secret rotation'))
story.append(TBL([
    ['Secret', 'Frekvenca rotacije', 'Postopek', 'Odvisnosti'],
    ['NEXTAUTH_SECRET', 'Letno', 'Generate new, update Vercel, redeploy', 'Vse session se invalidirajo'],
    ['SENTRY_DSN', 'Ne (stabilen)', 'Samo pri kompromisu', 'Vse Sentry integracije'],
    ['STRIPE_SECRET_KEY', 'Letno', 'Stripe Dashboard → API Keys → Roll', 'Webhook secret se ne spremeni'],
    ['FURS_CERT_PASSWORD', 'Ob renewalu', 'Re-upload z novim geslom', 'Certifikat delovanje'],
    ['DATABASE_URL', 'Ne (Neon upravlja)', 'Samo pri incidentu', 'App restart'],
    ['VAPID ključi', 'Ne (stabilni)', 'Samo pri kompromisu', 'Vse push subscriptions se invalidirajo'],
], [140, 110, 180, CONTENT_W-430]))
story.append(C('Tabela 8.1: Secret rotation schedule'))
story.append(H2('8.3 Audit log review'))
story.append(P('RestaurantOS ima chain hash audit log (SHA-256, nepopravljiv). Pregled naj se izvede mesečno.'))
story.append(CODE('''# Mesečni audit log review:
# 1. GET /api/audit-log?from=2025-09-01&to=2025-09-30
# 2. Preveri:
#    - Število FURS operacij (verify, storno)
#    - Število plačilnih operacij (create, refund)
#    - Admin login aktivnosti
#    - Spremembe konfiguracije (FURS cert upload)
# 3. Verificiraj chain hash:
#    - Hash vrstic[n] = SHA256(hash_vrstic[n-1] + content_vrstic[n])
#    - Če se ne ujema - potential tampering!
# 4. Arhiviraj v ./audit-archive/2025-09.json'''))
story.append(H2('8.4 Security incident response'))
story.append(CALLOUT('SECURITY INCIDENT PROCEDURE',
    '1. Izoliraj sistem (disable affected user/account)\n'
    '2. Zberi dokaze (Sentry, audit log, Vercel logs)\n'
    '3. Oceni obseg (katere stranke prizadete)\n'
    '4. Obvesti prizadete stranke v 72h (GDPR)\n'
    '5. Patch ranljivost\n'
    '6. Rotate prizadete secrets\n'
    '7. Post-mortem in preventivni ukrepi\n'
    '8. Prijavi GDPR oblasti če osebni podatki prizadeti',
    SEM_ERROR))
story.append(PageBreak())

# 9. PERFORMANCE OPTIMIZATION
story.append(H1('9. Performance optimization'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Navodila za ohranjanje hitre aplikacije. Performance metrike: API p95 <500ms, DB query p95 <100ms, page load <2s.'))
story.append(H2('9.1 DB optimizacija'))
story.append(CODE('''# Identificiraj slow queries (Neon SQL editor):
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- >100ms
ORDER BY mean_exec_time DESC
LIMIT 20;

# Dodaj indexe za pogoste poizvedbe:
CREATE INDEX CONCURRENTLY idx_orders_location_created
  ON orders (locationId, createdAt DESC);

CREATE INDEX CONCURRENTLY idx_payments_gateway_txid
  ON payments (gatewayTransactionId)
  WHERE gateway = 'stripe';

# VACUUM in ANALYZE (mesečno):
VACUUM ANALYZE orders;
VACUUM ANALYZE payments;
VACUUM ANALYZE audit_log;

# Preveri index usage:
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- unused indexes
ORDER BY idx_tup_read DESC;'''))
story.append(H2('9.2 Next.js optimizacija'))
story.append(B('<b>Bundle analysis</b> - `bun analyze` za velikost bundle-jev'))
story.append(B('<b>Dynamic imports</b> - za redko uporabljene komponente'))
story.append(B('<b>Image optimization</b> - next/image z WebP format'))
story.append(B('<b>API route caching</b> - `Cache-Control` headers za statične podatke'))
story.append(B('<b>Database connection pooling</b> - Neon pooler mode (port 5432)'))
story.append(H2('9.3 Vercel optimizacija'))
story.append(B('<b>Edge Functions</b> - za geografsko občutljive endpointe'))
story.append(B('<b>Function memory</b> - povečaj iz 1024MB na 2048MB za memory-intensive tasks'))
story.append(B('<b>Cron jobs</b> - Vercel Cron za dnevne task-e (FURS cert check, backup)'))
story.append(B('<b>HSTS in CSP</b> - že konfigurirano (security headers)'))
story.append(PageBreak())

# 10. ON-CALL
story.append(H1('10. On-call rotacija'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('On-call razpored za kritične incidente izven delovnega časa (18:00-9:00 in vikendi). Rotacija med Tech Lead, Backend in Frontend dev.'))
story.append(H2('10.1 Razpored (Q4 2025)'))
story.append(TBL([
    ['Teden', 'Primarni on-call', 'Sekundarni on-call', 'Slack status'],
    ['Teden 40 (29. sep - 5. okt)', 'Robert (Tech Lead)', 'Marko (Backend)', '#oncall-w40'],
    ['Teden 41 (6. - 12. okt)', 'Marko (Backend)', 'Ana (Frontend)', '#oncall-w41'],
    ['Teden 42 (13. - 19. okt)', 'Ana (Frontend)', 'Peter (QA)', '#oncall-w42'],
    ['Teden 43 (20. - 26. okt)', 'Peter (QA)', 'Robert (Tech Lead)', '#oncall-w43'],
    ['Teden 44 (27. okt - 2. nov)', 'Robert (Tech Lead)', 'Marko (Backend)', '#oncall-w44'],
    ['Teden 45 (3. - 9. nov)', 'Marko (Backend)', 'Ana (Frontend)', '#oncall-w45'],
    ['Teden 46 (10. - 16. nov)', 'Ana (Frontend)', 'Peter (QA)', '#oncall-w46'],
    ['Teden 47 (17. - 23. nov)', 'Peter (QA)', 'Robert (Tech Lead)', '#oncall-w47'],
], [180, 130, 130, 100]))
story.append(C('Tabela 10.1: On-call razpored Q4 2025'))
story.append(H2('10.2 On-call pripravljenost'))
story.append(B('<b>Telefon:</b> vklopljen 24/7, SMS in klici od Sentry/UptimeRobot'))
story.append(B('<b>Laptop:</b> dostop do VPN in SSH (v primeru DB debug)'))
story.append(B('<b>Vercel CLI:</b> nameščen in authenticated (`vercel login`)'))
story.append(B('<b>Stripe CLI:</b> nameščen za webhook testing'))
story.append(B('<b>Slack mobile app:</b> vklopljen z notifikacijami za #incidents'))
story.append(B('<b>Backup kontakt:</b> sekundarni on-call oseba (če primarna ne odgovara 15 min)'))
story.append(H2('10.3 On-call kompenzacija'))
story.append(P('On-call teden = 1 dopustni dan kompenzacije (po zakonu). Če je bilo več kot 3 incidente v tednu, dodatna kompenzacija po dogovoru z managementom.'))
story.append(PageBreak())

# 11. POST-MORTEM PREDLOGA
story.append(H1('11. Post-mortem predloga'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Po vsakem SEV-1 ali SEV-2 incidentu se napiše post-mortem v 24-48h. Namen: root cause analiza in preventivni ukrepi.'))
story.append(CODE('''# Post-Mortem: <naslov incidenta>

**Incident ID:** INC-2025-001
**Severity:** SEV-1
**Datum:** 2025-MM-DD
**Trajanje:** HH:MM - HH:MM (X ur Y minut)
**Affected:** <št. strank / št. uporabnikov>
**Downtime:** <čas, ko je bila aplikacija nedosegljiva>

## Povzetek
<kratek opis kaj se je zgodilo, brez tehničnih podrobnosti>

## Timeline (UTC+1)
- HH:MM - Prvi alert (Sentry/UptimeRobot)
- HH:MM - On-call potrjen incident
- HH:MM - Obvestitev strank (status page)
- HH:MM - Root cause identificiran
- HH:MM - Fix deployed
- HH:MM - Verificirano, incident resolved
- HH:MM - Status page update "Resolved"

## Root Cause
<podroben tehnični opis kaj je šlo naravnost>

## Impact
- <št. naročil, ki so failala>
- <št. strank, ki so bile prizadete>
- <financial impact, če znano>

## What went well
- <kaj je delovalo dobro (npr. alerting hitro, komunikacija)>

## What went wrong
- <kaj je šlo narobe (npr. fix predolg, slaba komunikacija)>

## Action items
- [ ] <ukrep 1> (lastnik, rok)
- [ ] <ukrep 2> (lastnik, rok)
- [ ] <ukrep 3> (lastnik, rok)

## Lessons learned
<kaj smo se naučili za prihodnost>

## Attachments
- Sentry issue link
- Vercel deployment link
- Slack thread link
- Status page updates'''))
story.append(H2('11.1 Post-mortem kultura'))
story.append(B('<b>Blameless</b> - post-mortem ni za iskanje krivcev, ampak za izboljšave'))
story.append(B('<b>Timeline-based</b> - dogodki v časovnem zaporedju'))
story.append(B('<b>Action-oriented</b> - vsak incident mora imeti vsaj 3 action item-e'))
story.append(B('<b>Shared</b> - post-mortem se deli s celotno ekipo (Slack + Notion)'))
story.append(B('<b>Reviewed</b> - action item-i se sledijo do zaključka (Jira/Linear)'))
story.append(PageBreak())

# 12. KONTROLNI SEZNAM
story.append(H1('12. Pred-deploy kontrolni seznam'))
story.append(HR(th=1.5,c=ACCENT,sb=2,sa=12))
story.append(P('Kontrolni seznam, ki ga mora Tech Lead preveriti PRED vsakim produkcijskim deploy-em. Brez vseh ✅ se deploy ne odobri.'))
story.append(H2('12.1 Koda in testi'))
story.append(B('☐ Vse E2E testi PASS (P0-kritični minimum 21/21)'))
story.append(B('☐ Unit testi PASS (bun test)'))
story.append(B('☐ TypeScript build brez napak (bun run build)'))
story.append(B('☐ ESLint brez napak (bun run lint)'))
story.append(B('☐ Code review odobren (1 reviewer minimum)'))
story.append(B('☐ Branch merged v main (squash merge)'))
story.append(H2('12.2 Baza in migracije'))
story.append(B('☐ Prisma migration aplicirana na staging (bun run db:migrate)'))
story.append(B('☐ DB backup narejen (Neon snapshot pred deploy)'))
story.append(B('☐ Migration testirana na stagingu'))
story.append(B('☐ Rollback migration pripravljena (če potrebna)'))
story.append(H2('12.3 Environment'))
story.append(B('☐ Vse env spremenljivke nastavljene v Vercel (Production environment)'))
story.append(B('☐ NEXT_PUBLIC_ spremenljivke verificirane (client-side)'))
story.append(B('☐ Stripe webhook secret aktualen'))
story.append(B('☐ FURS cert valid (GET /api/furs/cert-status)'))
story.append(B('☐ Sentry DSN pravilen'))
story.append(H2('12.4 Monitoring'))
story.append(B('☐ Sentry release tag nastavljen (SENTRY_RELEASE env)'))
story.append(B('☐ UptimeRobot aktiven na /api/health'))
story.append(B('☐ Slack #deploys notified (pred deploy)'))
story.append(B('☐ Deploy v off-peak uri (22:00-06:00)'))
story.append(B('☐ On-call oseba obveščena'))
story.append(H2('12.5 Post-deploy (v 30 min)'))
story.append(B('☐ /api/health vrne 200 OK'))
story.append(B('☐ Sentry brez novih napak (15 min spremljanje)'))
story.append(B('☐ Stripe test payment 0.50 EUR uspešen'))
story.append(B('☐ FURS test račun 1 EUR uspešen'))
story.append(B('☐ Slack #deploys notified (po uspešnem deploy)'))
story.append(B('☐ Status page brez incidenta'))
story.append(CALLOUT('DEPLOY GATE','Brez vseh ✅ v kontrolnem seznamu se deploy NE ODOBRI. Edina izjema: critical security patch (lahko preskoči ne-kritične korake z odobritvijo Tech Lead-a).', SEM_ERROR))

# BUILD
doc = TocDoc(OUTPUT_BODY, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
             title='RestaurantOS - Production Runbook', author='Z.ai', subject='Operativna navodila za produkcijo', creator='Z.ai')
doc.multiBuild(story)
print(f'Runbook body PDF: {OUTPUT_BODY} ({os.path.getsize(OUTPUT_BODY)/1024:.1f} KB)')
