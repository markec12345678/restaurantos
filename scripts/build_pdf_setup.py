#!/usr/bin/env python3
"""RestaurantOS - Tekmovalna analiza PDF builder (regenerated for github sync)."""
import os, sys, hashlib, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Image, KeepTogether, CondPageBreak, Flowable)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame

sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')
from pdf import install_font_fallback

# FONTS
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')
install_font_fallback()

# PALETTE
PAGE_BG       = colors.HexColor('#f3f2f1')
SECTION_BG    = colors.HexColor('#ececeb')
CARD_BG       = colors.HexColor('#eeedea')
TABLE_STRIPE  = colors.HexColor('#f0efed')
HEADER_FILL   = colors.HexColor('#685f46')
COVER_BLOCK   = colors.HexColor('#7d7354')
BORDER        = colors.HexColor('#d1c9b3')
ICON          = colors.HexColor('#9f8e5c')
ACCENT        = colors.HexColor('#86702b')
ACCENT_2      = colors.HexColor('#613ecc')
TEXT_PRIMARY  = colors.HexColor('#1d1c1a')
TEXT_MUTED    = colors.HexColor('#8a8881')
SEM_SUCCESS   = colors.HexColor('#3c7a50')
SEM_WARNING   = colors.HexColor('#a98846')
SEM_ERROR     = colors.HexColor('#9b4a43')
SEM_INFO      = colors.HexColor('#426990')
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# PAGE
PAGE_W, PAGE_H = A4
MARGIN_L = MARGIN_R = 22 * mm
MARGIN_T = 22 * mm
MARGIN_B = 22 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

OUTPUT_BODY = '/home/z/my-project/scripts/body.pdf'
CHARTS_DIR = '/home/z/my-project/scripts/charts'

# STYLES
h1_style = ParagraphStyle('H1', fontName='NotoSerifSC-Bold', fontSize=20, leading=26, textColor=HEADER_FILL, spaceBefore=14, spaceAfter=10, alignment=TA_LEFT)
h2_style = ParagraphStyle('H2', fontName='NotoSerifSC-Bold', fontSize=14, leading=20, textColor=ACCENT, spaceBefore=12, spaceAfter=6, alignment=TA_LEFT)
h3_style = ParagraphStyle('H3', fontName='NotoSerifSC-Bold', fontSize=11.5, leading=16, textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=4, alignment=TA_LEFT)
body_style = ParagraphStyle('Body', fontName='NotoSerifSC', fontSize=10.5, leading=16, textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=8, alignment=TA_LEFT, wordWrap='CJK')
bullet_style = ParagraphStyle('Bullet', fontName='NotoSerifSC', fontSize=10.5, leading=15, textColor=TEXT_PRIMARY, leftIndent=14, spaceBefore=0, spaceAfter=4, alignment=TA_LEFT, wordWrap='CJK')
caption_style = ParagraphStyle('Caption', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=14)
callout_title_style = ParagraphStyle('CalloutTitle', fontName='NotoSerifSC-Bold', fontSize=11, leading=15, textColor=colors.white, alignment=TA_LEFT)
callout_body_style = ParagraphStyle('CalloutBody', fontName='NotoSerifSC', fontSize=10, leading=15, textColor=colors.white, alignment=TA_LEFT, wordWrap='CJK')
table_header_style = ParagraphStyle('TableHeader', fontName='NotoSerifSC-Bold', fontSize=9.5, leading=12, textColor=colors.white, alignment=TA_CENTER)
table_cell_style = ParagraphStyle('TableCell', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=TEXT_PRIMARY, alignment=TA_CENTER, wordWrap='CJK')
table_cell_left_style = ParagraphStyle('TableCellLeft', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=TEXT_PRIMARY, alignment=TA_LEFT, wordWrap='CJK')
toc_h1_style = ParagraphStyle('TocH1', fontName='NotoSerifSC-Bold', fontSize=11, leading=18, textColor=TEXT_PRIMARY, leftIndent=0, spaceBefore=4)
toc_h2_style = ParagraphStyle('TocH2', fontName='NotoSerifSC', fontSize=10, leading=15, textColor=TEXT_PRIMARY, leftIndent=18, spaceBefore=2)
stat_num_style = ParagraphStyle('StatNum', fontName='NotoSerifSC-Bold', fontSize=22, leading=26, textColor=ACCENT, alignment=TA_CENTER)
stat_label_style = ParagraphStyle('StatLabel', fontName='NotoSerifSC', fontSize=9, leading=12, textColor=TEXT_MUTED, alignment=TA_CENTER)


def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key; p.bookmark_level = level; p.bookmark_text = text; p.bookmark_key = key
    return p

def h1(text): return add_heading(text, h1_style, level=0)
def h2(text): return add_heading(text, h2_style, level=1)
def h3(text): return Paragraph(f'<b>{text}</b>', h3_style)
def p(text): return Paragraph(text, body_style)
def bullet(text): return Paragraph(f'•  {text}', bullet_style)
def caption(text): return Paragraph(text, caption_style)
def spacer(h=10): return Spacer(1, h)

def fit_image(path, max_w=None, max_h=None):
    if max_w is None: max_w = CONTENT_W
    if max_h is None: max_h = PAGE_H * 0.42
    img = Image(path)
    ow, oh = img.drawWidth, img.drawHeight
    rw = max_w / ow if ow > max_w else 1.0
    rh = max_h / oh if oh > max_h else 1.0
    r = min(rw, rh)
    img.drawWidth = ow * r; img.drawHeight = oh * r; img.hAlign = 'CENTER'
    return img

def callout(title, body_text, color=ACCENT):
    data = [[Paragraph(f'<b>{title}</b>', callout_title_style)],
            [Paragraph(body_text, callout_body_style)]]
    t = Table(data, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

def stat_block(stats):
    row_nums = [Paragraph(n, stat_num_style) for n, _ in stats]
    row_lbls = [Paragraph(l, stat_label_style) for _, l in stats]
    data = [row_nums, row_lbls]
    n = len(stats); col_w = CONTENT_W / n
    t = Table(data, colWidths=[col_w] * n)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 1.2, ACCENT),
    ]))
    return t

def std_table(data, col_widths=None, header=True, repeat_header=True):
    if col_widths is None:
        col_widths = [CONTENT_W / len(data[0])] * len(data[0])
    rows = []
    for ri, row in enumerate(data):
        new_row = []
        for cell in row:
            if isinstance(cell, (Paragraph, Image, Table)):
                new_row.append(cell)
            else:
                style = table_header_style if (header and ri == 0) else table_cell_style
                new_row.append(Paragraph(str(cell), style))
        rows.append(new_row)
    t = Table(rows, colWidths=col_widths, hAlign='CENTER', repeatRows=1 if (header and repeat_header) else 0)
    style = [
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    if header:
        style.append(('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL))
        style.append(('TEXTCOLOR', (0, 0), (-1, 0), colors.white))
        for r in range(1, len(rows)):
            bg = TABLE_ROW_ODD if r % 2 == 1 else TABLE_ROW_EVEN
            style.append(('BACKGROUND', (0, r), (-1, r), bg))
    t.setStyle(TableStyle(style))
    return t


class HRule(Flowable):
    def __init__(self, width=None, thickness=1.0, color=None, space_before=4, space_after=8):
        super().__init__()
        self.width = width or CONTENT_W
        self.thickness = thickness
        self.color = color or BORDER
        self.space_before = space_before
        self.space_after = space_after
    def wrap(self, *args):
        return (self.width, self.thickness + self.space_before + self.space_after)
    def draw(self):
        self.canv.setStrokeColor(self.color); self.canv.setLineWidth(self.thickness)
        y = self.space_after
        self.canv.line(0, y, self.width, y)


class TocDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        frame = Frame(MARGIN_L, MARGIN_B, CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B,
                      id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        template = PageTemplate(id='Body', frames=frame, onPage=self._draw_footer)
        self.addPageTemplates([template])

    def _draw_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(BORDER); canvas.setLineWidth(0.5)
        canvas.line(MARGIN_L, MARGIN_B - 8, PAGE_W - MARGIN_R, MARGIN_B - 8)
        canvas.setFont('NotoSerifSC', 8); canvas.setFillColor(TEXT_MUTED)
        canvas.drawString(MARGIN_L, MARGIN_B - 18, 'RestaurantOS · Tekmovalna analiza · 2025')
        canvas.drawRightString(PAGE_W - MARGIN_R, MARGIN_B - 18, f'Stran {doc.page}')
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


print('Setup OK. Building story...')
story = []

# TOC
toc = TableOfContents()
toc.levelStyles = [toc_h1_style, toc_h2_style]
story.append(Paragraph('<b>Kazalo vsebine</b>', h1_style))
story.append(HRule(thickness=1.5, color=ACCENT, space_before=2, space_after=14))
story.append(toc)
story.append(PageBreak())

print('Now importing content module...')
