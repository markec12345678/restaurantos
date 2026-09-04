#!/usr/bin/env python3
"""Generate GAP analysis charts for RestaurantOS P0 implementation."""
import os
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle

fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Liberation Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10

# Palette
ACCENT = '#86702b'
HEADER_FILL = '#685f46'
BORDER = '#d1c9b3'
TEXT_PRIMARY = '#1d1c1a'
TEXT_MUTED = '#8a8881'
SEM_SUCCESS = '#3c7a50'
SEM_WARNING = '#a98846'
SEM_ERROR = '#9b4a43'
SEM_INFO = '#426990'

OUT_DIR = '/home/z/my-project/scripts/charts'
os.makedirs(OUT_DIR, exist_ok=True)


def gap_overview():
    """Horizontal bar chart - implementation readiness per P0 priority."""
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    items = [
        ('P0-1: FURS produkcijska certifikacija', 85, SEM_WARNING),
        ('P0-2: Stripe plačilni gateway',        70, SEM_WARNING),
        ('P0-3: Mobilna PWA aplikacija',          65, SEM_WARNING),
        ('P0-4: Sentry monitoring',              100, SEM_SUCCESS),
        ('P0-5: Custom domena',                  100, SEM_SUCCESS),
    ]
    y_pos = np.arange(len(items))
    for i, (label, pct, color) in enumerate(items):
        ax.barh(i, pct, height=0.55, color=color, edgecolor='white', linewidth=1.5)
        # Background track (100%)
        ax.barh(i, 100, height=0.55, color=BORDER, alpha=0.3, zorder=0)
        # Label
        ax.text(pct + 2, i, f'{pct}%', va='center', fontsize=11, fontweight='bold', color=TEXT_PRIMARY)
    ax.set_yticks(y_pos)
    ax.set_yticklabels([it[0] for it in items], fontsize=11, color=TEXT_PRIMARY)
    ax.invert_yaxis()
    ax.set_xlim(0, 115)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(['0%', '25%', '50%', '75%', '100%'], fontsize=10, color=TEXT_MUTED)
    ax.set_title('P0 prioritete - stopnja implementacije (september 2025)',
                 fontsize=13, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.grid(axis='x', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(TEXT_MUTED); ax.spines['bottom'].set_color(TEXT_MUTED)
    # Vertical line at 80%
    ax.axvline(x=80, color=SEM_SUCCESS, linestyle='--', linewidth=1.5, alpha=0.7)
    ax.text(80, -0.7, 'produkcija-ready (80%)', fontsize=9, color=SEM_SUCCESS, ha='center', fontweight='bold')
    plt.savefig(f'{OUT_DIR}/gap_overview.png', dpi=180, facecolor='white'); plt.close()
    print('OK gap_overview.png')


def furs_module_status():
    """Visual matrix of FURS sub-modules and their production-readiness."""
    fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
    ax.set_xlim(0, 10); ax.set_ylim(0, 7); ax.axis('off')

    modules = [
        # (x, y, w, h, name, status, color)
        (0.3, 5.0, 2.8, 1.5, 'PKCS12 Loader', 'Production-ready', SEM_SUCCESS),
        (3.4, 5.0, 2.8, 1.5, 'ZOI Generator', 'Production-ready', SEM_SUCCESS),
        (6.5, 5.0, 3.2, 1.5, 'Config Resolver', 'Production-ready', SEM_SUCCESS),
        (0.3, 3.2, 2.8, 1.5, 'Token Manager', 'Production-ready', SEM_SUCCESS),
        (3.4, 3.2, 2.8, 1.5, 'Build Request', 'Production-ready', SEM_SUCCESS),
        (6.5, 3.2, 3.2, 1.5, 'Verify Invoice', 'Production-ready', SEM_SUCCESS),
        (0.3, 1.4, 2.8, 1.5, 'PEM Loader', 'Production-ready', SEM_SUCCESS),
        (3.4, 1.4, 2.8, 1.5, 'Cert Status API', 'Production-ready', SEM_SUCCESS),
        (6.5, 1.4, 3.2, 1.5, 'Test certifikat', 'MANJKA', SEM_ERROR),
    ]
    for x, y, w, h, name, status, color in modules:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                                     facecolor=color, alpha=0.15, edgecolor=color, linewidth=2))
        ax.text(x + w/2, y + h - 0.35, name, ha='center', va='center',
                fontsize=11, fontweight='bold', color=TEXT_PRIMARY)
        ax.text(x + w/2, y + 0.4, status, ha='center', va='center',
                fontsize=10, color=color, fontweight='600')

    ax.text(5, 6.7, 'FURS modul - status implementacije',
            ha='center', va='center', fontsize=14, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/furs_modules.png', dpi=180, facecolor='white'); plt.close()
    print('OK furs_modules.png')


def stripe_module_status():
    """Visual matrix of Stripe sub-modules."""
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis('off')

    modules = [
        (0.3, 3.5, 2.8, 1.5, 'StripeGateway class', 'Production-ready', SEM_SUCCESS),
        (3.4, 3.5, 2.8, 1.5, 'Gateway Factory', 'Production-ready', SEM_SUCCESS),
        (6.5, 3.5, 3.2, 1.5, 'Webhook (HMAC)', 'Production-ready', SEM_SUCCESS),
        (0.3, 1.5, 2.8, 1.5, 'Health Check', 'Production-ready', SEM_SUCCESS),
        (3.4, 1.5, 2.8, 1.5, 'Outbox Processor', 'Production-ready', SEM_SUCCESS),
        (6.5, 1.5, 3.2, 1.5, 'POS UI za kartice', 'MANJKA', SEM_ERROR),
    ]
    for x, y, w, h, name, status, color in modules:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                                     facecolor=color, alpha=0.15, edgecolor=color, linewidth=2))
        ax.text(x + w/2, y + h - 0.35, name, ha='center', va='center',
                fontsize=11, fontweight='bold', color=TEXT_PRIMARY)
        ax.text(x + w/2, y + 0.4, status, ha='center', va='center',
                fontsize=10, color=color, fontweight='600')

    ax.text(5, 5.5, 'Stripe plačilni gateway - status implementacije',
            ha='center', va='center', fontsize=14, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/stripe_modules.png', dpi=180, facecolor='white'); plt.close()
    print('OK stripe_modules.png')


def pwa_module_status():
    """Visual matrix of PWA sub-modules."""
    fig, ax = plt.subplots(figsize=(11, 5), constrained_layout=True)
    ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis('off')

    modules = [
        (0.3, 3.5, 2.8, 1.5, 'Service Worker (sw.js)', 'Production-ready', SEM_SUCCESS),
        (3.4, 3.5, 2.8, 1.5, 'manifest.json', 'Production-ready', SEM_SUCCESS),
        (6.5, 3.5, 3.2, 1.5, 'Offline Orders Queue', 'Production-ready', SEM_SUCCESS),
        (0.3, 1.5, 2.8, 1.5, 'Offline FURS Queue', 'Production-ready', SEM_SUCCESS),
        (3.4, 1.5, 2.8, 1.5, 'Push Notifications', 'MANJKA', SEM_ERROR),
        (6.5, 1.5, 3.2, 1.5, 'Install Prompt UI', 'MANJKA', SEM_WARNING),
    ]
    for x, y, w, h, name, status, color in modules:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                                     facecolor=color, alpha=0.15, edgecolor=color, linewidth=2))
        ax.text(x + w/2, y + h - 0.35, name, ha='center', va='center',
                fontsize=11, fontweight='bold', color=TEXT_PRIMARY)
        ax.text(x + w/2, y + 0.4, status, ha='center', va='center',
                fontsize=10, color=color, fontweight='600')

    ax.text(5, 5.5, 'PWA aplikacija - status implementacije',
            ha='center', va='center', fontsize=14, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/pwa_modules.png', dpi=180, facecolor='white'); plt.close()
    print('OK pwa_modules.png')


def effort_estimate():
    """Bar chart - estimated effort per gap (in person-days)."""
    fig, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
    gaps = [
        ('FURS: .p12 cert upload UI', 3, SEM_ERROR),
        ('FURS: Test env validation', 5, SEM_ERROR),
        ('FURS: Produkcija preklop', 2, SEM_ERROR),
        ('Stripe: POS UI komponenta', 8, SEM_ERROR),
        ('Stripe: Test kartice', 3, SEM_ERROR),
        ('Stripe: Webhook produkcija', 2, SEM_WARNING),
        ('PWA: Push notifications', 6, SEM_ERROR),
        ('PWA: Install prompt', 3, SEM_WARNING),
        ('PWA: App icon set', 2, SEM_WARNING),
        ('E2E testi', 5, SEM_INFO),
        ('Dokumentacija', 3, SEM_INFO),
    ]
    names = [g[0] for g in gaps]
    days = [g[1] for g in gaps]
    colors = [g[2] for g in gaps]
    x = np.arange(len(gaps))
    bars = ax.bar(x, days, color=colors, edgecolor='white', linewidth=1.2)
    ax.set_ylabel('Časovni napor (človek-dnevi)')
    ax.set_title('Ocena napor za zmankajoče komponente (skupaj ~42 človek-dnevov = 8 tednov)',
                 fontsize=12, fontweight='bold', color=TEXT_PRIMARY, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(names, rotation=35, ha='right', fontsize=9, color=TEXT_PRIMARY)
    ax.grid(axis='y', color=BORDER, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    for bar, val in zip(bars, days):
        ax.annotate(f'{val}d', xy=(bar.get_x() + bar.get_width() / 2, val),
                    xytext=(0, 4), textcoords='offset points', ha='center',
                    fontsize=9, fontweight='bold', color=TEXT_PRIMARY)
    plt.savefig(f'{OUT_DIR}/effort_estimate.png', dpi=180, facecolor='white'); plt.close()
    print('OK effort_estimate.png')


if __name__ == '__main__':
    gap_overview()
    furs_module_status()
    stripe_module_status()
    pwa_module_status()
    effort_estimate()
    print('\nVsi GAP grafikonki generirani v:', OUT_DIR)
