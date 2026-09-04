#!/usr/bin/env python3
"""Generate all charts for the RestaurantOS competitive analysis PDF."""
import os
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
from matplotlib.patches import FancyBboxPatch, Rectangle

fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Liberation Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10

# Palette (from cascade output)
ACCENT = '#86702b'
HEADER_FILL = '#685f46'
ACCENT_2 = '#613ecc'
BORDER = '#d1c9b3'
TEXT_PRIMARY = '#1d1c1a'
TEXT_MUTED = '#8a8881'
SEM_SUCCESS = '#3c7a50'
SEM_WARNING = '#a98846'
SEM_ERROR = '#9b4a43'
SEM_INFO = '#426990'

OUT_DIR = '/home/z/my-project/scripts/charts'
os.makedirs(OUT_DIR, exist_ok=True)


def chart_market_share():
    fig, ax = plt.subplots(figsize=(8, 5.5), constrained_layout=True)
    labels = ['Toast', 'Square', 'Lightspeed', 'Clover', 'TouchBistro', 'Drugi']
    sizes = [28, 18, 12, 15, 7, 20]
    colors = ['#86702b', '#685f46', '#9f8e5c', '#7d7354', '#d1c9b3', '#ececeb']
    explode = (0.06, 0, 0, 0, 0, 0)
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, colors=colors, autopct='%1.0f%%',
        startangle=90, explode=explode, textprops={'fontsize': 11, 'color': TEXT_PRIMARY},
        wedgeprops={'edgecolor': 'white', 'linewidth': 2}
    )
    for at in autotexts:
        at.set_color('white'); at.set_fontweight('bold'); at.set_fontsize(11)
    ax.set_title('Tržni delež globalnih POS ponudnikov za restavracije (ocena 2025)',
                 fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    plt.savefig(f'{OUT_DIR}/market_share.png', dpi=180, facecolor='white'); plt.close()
    print('OK market_share.png')


def chart_feature_radar():
    categories = ['Core POS', 'Restaurant\nmgmt', 'Inventory', 'Analytics\n& BI', 'Multi-tenant', 'Večjezičnost']
    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)] + [0]
    data = {
        'RestaurantOS': [8.5, 8.0, 7.5, 8.5, 9.5, 9.0],
        'Toast':        [9.5, 9.0, 8.5, 9.0, 9.0, 5.0],
        'Square':       [8.0, 7.0, 6.5, 7.5, 7.0, 4.0],
        'Lightspeed':   [8.5, 8.5, 9.0, 8.5, 8.5, 6.0],
    }
    colors_map = {'RestaurantOS': ACCENT, 'Toast': '#9b4a43', 'Square': SEM_INFO, 'Lightspeed': SEM_SUCCESS}
    fig, ax = plt.subplots(figsize=(9, 7), subplot_kw=dict(polar=True), constrained_layout=True)
    for name, vals in data.items():
        v = vals + vals[:1]
        ax.plot(angles, v, linewidth=2.2, label=name, color=colors_map[name])
        ax.fill(angles, v, alpha=0.15, color=colors_map[name])
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=11, color=TEXT_PRIMARY)
    ax.set_ylim(0, 10)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(['2', '4', '6', '8', '10'], fontsize=9, color=TEXT_MUTED)
    ax.grid(color=BORDER, linewidth=0.8, alpha=0.6)
    ax.spines['polar'].set_color(BORDER)
    ax.set_title('Primerjava funkcionalne pokritosti (0-10)',
                 fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=25)
    ax.legend(loc='upper right', bbox_to_anchor=(1.25, 1.10), fontsize=10, frameon=False)
    plt.savefig(f'{OUT_DIR}/feature_radar.png', dpi=180, facecolor='white'); plt.close()
    print('OK feature_radar.png')


def chart_pricing_comparison():
    competitors = ['RestaurantOS', 'Toast', 'Square', 'Lightspeed', 'Clover', 'TouchBistro', 'Lavu', 'GloriaFood', 'Shopify', 'EdiPlug', 'Racuni.com']
    base_monthly = [49, 165, 60, 89, 105, 70, 60, 0, 89, 35, 25]
    transaction_pct = [0, 0, 2.6, 0, 2.6, 0, 0, 1.5, 0, 0, 0]
    est_transaction_cost = [p * 50 for p in transaction_pct]
    x = np.arange(len(competitors))
    width = 0.38
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    bars1 = ax.bar(x - width/2, base_monthly, width, label='Mesečna licenca (EUR)', color=ACCENT, edgecolor='white', linewidth=1)
    bars2 = ax.bar(x + width/2, est_transaction_cost, width, label='Strošek transakcij (ocena, EUR/mes)', color=HEADER_FILL, edgecolor='white', linewidth=1)
    ax.set_ylabel('EUR / mesec', fontsize=11, color=TEXT_PRIMARY)
    ax.set_title('Cenovna primerjava - mesečni stroški (osnovni paket, ocena 2025)',
                 fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(competitors, rotation=35, ha='right', fontsize=9, color=TEXT_PRIMARY)
    ax.legend(loc='upper left', fontsize=10, frameon=False)
    ax.grid(axis='y', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(TEXT_MUTED); ax.spines['bottom'].set_color(TEXT_MUTED)
    bars1[0].set_color(SEM_SUCCESS)
    for bar in bars1:
        h = bar.get_height()
        ax.annotate(f'{int(h)}', xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 4), textcoords='offset points', ha='center', fontsize=8, color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/pricing_comparison.png', dpi=180, facecolor='white'); plt.close()
    print('OK pricing_comparison.png')


def chart_design_radar():
    categories = ['Barvna\npaleta', 'Tipografija', 'Komponentni\nsistem', 'Spacing\n& razmik', 'Ikonografija', 'Animacije', 'Responsive\ndesign']
    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)] + [0]
    data = {
        'RestaurantOS': [8.5, 7.5, 8.0, 8.0, 7.0, 7.5, 9.0],
        'Toast':        [9.0, 9.0, 9.5, 9.0, 8.5, 8.5, 9.0],
        'Square':       [8.5, 8.5, 9.0, 8.5, 9.0, 8.0, 9.5],
        'Lightspeed':   [9.0, 8.5, 8.5, 8.0, 8.0, 7.0, 8.5],
    }
    colors_map = {'RestaurantOS': ACCENT, 'Toast': '#9b4a43', 'Square': SEM_INFO, 'Lightspeed': SEM_SUCCESS}
    fig, ax = plt.subplots(figsize=(9, 7), subplot_kw=dict(polar=True), constrained_layout=True)
    for name, vals in data.items():
        v = vals + vals[:1]
        ax.plot(angles, v, linewidth=2.2, label=name, color=colors_map[name])
        ax.fill(angles, v, alpha=0.15, color=colors_map[name])
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=10, color=TEXT_PRIMARY)
    ax.set_ylim(0, 10)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(['2', '4', '6', '8', '10'], fontsize=9, color=TEXT_MUTED)
    ax.grid(color=BORDER, linewidth=0.8, alpha=0.6)
    ax.spines['polar'].set_color(BORDER)
    ax.set_title('Zrelost design sistema (0-10)', fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=25)
    ax.legend(loc='upper right', bbox_to_anchor=(1.30, 1.10), fontsize=10, frameon=False)
    plt.savefig(f'{OUT_DIR}/design_radar.png', dpi=180, facecolor='white'); plt.close()
    print('OK design_radar.png')


def chart_language_support():
    competitors = ['RestaurantOS', 'Toast', 'Square', 'Lightspeed', 'Clover', 'TouchBistro', 'EdiPlug', 'Racuni.com']
    slovenian = [1, 0, 0, 0, 0, 0, 1, 1]
    english = [1, 1, 1, 1, 1, 1, 1, 1]
    other_eu = [3, 4, 3, 6, 5, 2, 0, 0]
    other_global = [0, 8, 5, 12, 10, 3, 0, 0]
    x = np.arange(len(competitors))
    width = 0.55
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    p1 = ax.bar(x, slovenian, width, label='Slovenščina', color=SEM_SUCCESS, edgecolor='white', linewidth=1)
    p2 = ax.bar(x, english, width, bottom=slovenian, label='Angleščina', color=ACCENT, edgecolor='white', linewidth=1)
    bottom2 = [s + e for s, e in zip(slovenian, english)]
    p3 = ax.bar(x, other_eu, width, bottom=bottom2, label='Druge EU (it/hr/de/fr/es)', color=HEADER_FILL, edgecolor='white', linewidth=1)
    bottom3 = [b + o for b, o in zip(bottom2, other_eu)]
    p4 = ax.bar(x, other_global, width, bottom=bottom3, label='Druge globalne', color=BORDER, edgecolor='white', linewidth=1)
    ax.set_ylabel('Število podprtih jezikov', fontsize=11, color=TEXT_PRIMARY)
    ax.set_title('Večjezičnost - pokritost jezikov', fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(competitors, rotation=25, ha='right', fontsize=9, color=TEXT_PRIMARY)
    ax.legend(loc='upper left', fontsize=9, frameon=False, ncol=2)
    ax.grid(axis='y', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    totals = [s + e + oe + og for s, e, oe, og in zip(slovenian, english, other_eu, other_global)]
    for i, t in enumerate(totals):
        ax.annotate(f'{t}', xy=(i, t), xytext=(0, 4), textcoords='offset points', ha='center', fontsize=10, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/language_support.png', dpi=180, facecolor='white'); plt.close()
    print('OK language_support.png')


def chart_roadmap_gantt():
    items = [
        ('P0: FURS testno okolje',         0, 1.5, SEM_ERROR),
        ('P0: Stripe/SummOpay plačilni gateway', 0.5, 2, SEM_ERROR),
        ('P0: Mobilna POS aplikacija (PWA)', 0, 3, SEM_ERROR),
        ('P1: Mobile-responsive dashboard', 2, 3, SEM_WARNING),
        ('P1: Kitchin display (KDS) v2',    2, 3, SEM_WARNING),
        ('P1: Spletne naročilne form na domeni', 3, 2, SEM_WARNING),
        ('P1: Loyalty program',             3, 3, SEM_WARNING),
        ('P2: AI napovedi prodaje',         6, 4, SEM_INFO),
        ('P2: Catering module',             6, 3, SEM_INFO),
        ('P2: Multi-currency (EU širitev)', 7, 4, SEM_INFO),
        ('P2: White-label SaaS',            8, 4, SEM_INFO),
    ]
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    y_pos = np.arange(len(items))
    for i, (label, start, dur, color) in enumerate(items):
        ax.barh(i, dur, left=start, height=0.55, color=color, edgecolor='white', linewidth=1.5)
        ax.text(start + dur + 0.1, i, f'{dur:.0f}m', va='center', fontsize=9, color=TEXT_MUTED)
    ax.set_yticks(y_pos)
    ax.set_yticklabels([it[0] for it in items], fontsize=10, color=TEXT_PRIMARY)
    ax.invert_yaxis()
    ax.set_xlabel('Mesec od lansiranja', fontsize=11, color=TEXT_PRIMARY)
    ax.set_title('RestaurantOS - Roadmap prioritete (6-12 mesecev)', fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.set_xlim(0, 14)
    ax.set_xticks(range(0, 13, 1))
    ax.grid(axis='x', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    for q in [3, 6, 9, 12]:
        ax.axvline(x=q, color=TEXT_MUTED, linestyle='--', linewidth=0.8, alpha=0.5)
    from matplotlib.patches import Patch
    legend_elems = [
        Patch(facecolor=SEM_ERROR, label='P0 - Kritično (0-3 meseci)'),
        Patch(facecolor=SEM_WARNING, label='P1 - Visoka prioriteta (3-6 meseci)'),
        Patch(facecolor=SEM_INFO, label='P2 - Srednja prioriteta (6-12 mesecev)'),
    ]
    ax.legend(handles=legend_elems, loc='lower right', fontsize=9, frameon=False)
    plt.savefig(f'{OUT_DIR}/roadmap_gantt.png', dpi=180, facecolor='white'); plt.close()
    print('OK roadmap_gantt.png')


def chart_tco_3yr():
    competitors = ['RestaurantOS', 'Toast', 'Square', 'Lightspeed', 'Clover', 'TouchBistro', 'Lavu', 'GloriaFood', 'Shopify', 'EdiPlug', 'Racuni.com']
    tco_3yr = [2200, 8500, 5400, 6800, 7200, 5800, 4500, 2800, 6200, 1800, 1400]
    colors_list = [SEM_SUCCESS] + [ACCENT] * 4 + [HEADER_FILL] * 3 + [ACCENT_2] * 2 + [SEM_SUCCESS] * 2
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    bars = ax.bar(competitors, tco_3yr, color=colors_list, edgecolor='white', linewidth=1.2)
    ax.set_ylabel('TCO za 3 leta (EUR)', fontsize=11, color=TEXT_PRIMARY)
    ax.set_title('Skupni lastniški strošek (TCO) za 3 leta - licenca + transakcije + setup',
                 fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    plt.xticks(rotation=35, ha='right', fontsize=9, color=TEXT_PRIMARY)
    ax.grid(axis='y', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    for bar, val in zip(bars, tco_3yr):
        ax.annotate(f'{val:,} EUR'.replace(',', '.'), xy=(bar.get_x() + bar.get_width() / 2, val),
                    xytext=(0, 4), textcoords='offset points', ha='center', fontsize=9, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/tco_3yr.png', dpi=180, facecolor='white'); plt.close()
    print('OK tco_3yr.png')


def chart_swot_matrix():
    fig, ax = plt.subplots(figsize=(11, 8), constrained_layout=True)
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis('off')
    quads = [
        (0.2, 5.1, 4.7, 4.7, SEM_SUCCESS, 'S - MOČNE TOČKE (Strengths)',
         ['FURS-certificiran (edini Next.js)', 'Multi-tenant arhitektura (8 lokacij)',
          '5 jezikov (sl/en/it/hr/de)', 'Optimistično zaklepanje',
          'A++ varnostna ocena (0 XSS/SQLi)', '211 API rutin, 92 Prisma modeli',
          'Cena 49 EUR/mes (najnižja v razredu)']),
        (5.1, 5.1, 4.7, 4.7, SEM_ERROR, 'W - ŠIBKE TOČKE (Weaknesses)',
         ['Brez plačilnega integratorja (Stripe/Sumup)', 'Brez mobilne aplikacije (PWA)',
          'Brez KDS (Kitchen Display System)', 'Majhna baza uporabnikov',
          'Brez loyalty programa', 'Brez catering modula',
          'Omejen ekosistem partnerjev']),
        (0.2, 0.2, 4.7, 4.7, SEM_INFO, 'O - PRILIKE (Opportunities)',
         ['Slovenski trg (25k+ restavracij)', 'Širitev v EU (Italija, Hrvaška)',
          'SaaS model za franšize', 'AI napovedi prodaje',
          'White-label za distributerje', 'QR meni + spletna naročila',
          'Integracija z računovodskimi ERP']),
        (5.1, 0.2, 4.7, 4.7, SEM_WARNING, 'T - GROŽNJE (Threats)',
         ['Toast vstop v EU trg', 'Lightspeed agresivna cenovna politika',
          'FURS spremembe predpisov', 'Microsoft / Google vstop v POS',
          'Odprt kod (OpenSource POS) konkurenca', 'Gospodarska recesija',
          'Spremembe v davčni zakonodaji EU']),
    ]
    for x, y, w, h, color, title, items in quads:
        ax.add_patch(Rectangle((x, y), w, h, facecolor=color, alpha=0.10, edgecolor=color, linewidth=2))
        ax.add_patch(Rectangle((x, y + h - 0.5), w, 0.5, facecolor=color, edgecolor=color, linewidth=0))
        ax.text(x + w/2, y + h - 0.25, title, ha='center', va='center', fontsize=12, fontweight='bold', color='white')
        for i, item in enumerate(items):
            ax.text(x + 0.25, y + h - 0.95 - i * 0.42, f'•  {item}', ha='left', va='top', fontsize=9.5, color=TEXT_PRIMARY)
    ax.text(5, 9.7, 'SWOT analiza - RestaurantOS', ha='center', va='center', fontsize=15, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/swot_matrix.png', dpi=180, facecolor='white'); plt.close()
    print('OK swot_matrix.png')


def chart_visual_score():
    competitors = ['RestaurantOS', 'Toast', 'Square', 'Lightspeed', 'Clover']
    categories = ['UI\nestetika', 'UX\nflow', 'Tipografija', 'Barvna\npaleta', 'Informacijska\ngostota', 'Mobilna\nizkušnja']
    scores = {
        'RestaurantOS': [8.0, 8.5, 7.5, 8.5, 8.0, 7.0],
        'Toast':        [9.0, 9.0, 9.0, 9.0, 8.5, 9.0],
        'Square':       [8.5, 8.5, 8.5, 8.5, 8.0, 9.0],
        'Lightspeed':   [8.5, 8.0, 8.5, 8.5, 7.5, 7.5],
        'Clover':       [7.5, 7.5, 7.0, 7.5, 7.5, 7.0],
    }
    colors_map = {'RestaurantOS': ACCENT, 'Toast': '#9b4a43', 'Square': SEM_INFO, 'Lightspeed': SEM_SUCCESS, 'Clover': TEXT_MUTED}
    x = np.arange(len(categories))
    width = 0.16
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    for i, (name, vals) in enumerate(scores.items()):
        offset = (i - 2) * width
        ax.bar(x + offset, vals, width, label=name, color=colors_map[name], edgecolor='white', linewidth=1)
    ax.set_ylabel('Ocena (0-10)', fontsize=11, color=TEXT_PRIMARY)
    ax.set_title('Vizualna zrelost - primerjava ocen', fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=10, color=TEXT_PRIMARY)
    ax.set_ylim(0, 10)
    ax.legend(loc='upper right', fontsize=9, frameon=False, ncol=5)
    ax.grid(axis='y', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    plt.savefig(f'{OUT_DIR}/visual_score.png', dpi=180, facecolor='white'); plt.close()
    print('OK visual_score.png')


if __name__ == '__main__':
    chart_market_share(); chart_feature_radar(); chart_pricing_comparison()
    chart_design_radar(); chart_language_support(); chart_roadmap_gantt()
    chart_tco_3yr(); chart_swot_matrix(); chart_visual_score()
    print('\nVsi grafikonki generirani v:', OUT_DIR)
