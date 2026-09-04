#!/usr/bin/env python3
"""Merge cover PDF + body PDF into final PDF."""
import os
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
COVER_PDF = '/home/z/my-project/scripts/cover.pdf'
BODY_PDF = '/home/z/my-project/scripts/body.pdf'
OUTPUT_FINAL = '/home/z/my-project/download/RestaurantOS-Tekmovalna-analiza.pdf'

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    return page

def insert_cover(cover_pdf, body_pdf, output_pdf):
    writer = PdfWriter()
    cover_page = PdfReader(cover_pdf).pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))
    body_reader = PdfReader(body_pdf)
    for page in body_reader.pages:
        writer.add_page(normalize_page_to_a4(page))
    writer.add_metadata({
        '/Title': 'RestaurantOS - Tekmovalna analiza in vizualni benchmark',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Benchmark analiza RestaurantOS proti 11 tekmecem',
    })
    os.makedirs(os.path.dirname(output_pdf), exist_ok=True)
    with open(output_pdf, 'wb') as f:
        writer.write(f)

if __name__ == '__main__':
    insert_cover(COVER_PDF, BODY_PDF, OUTPUT_FINAL)
    size_kb = os.path.getsize(OUTPUT_FINAL) / 1024
    reader = PdfReader(OUTPUT_FINAL)
    n_pages = len(reader.pages)
    print(f'Final PDF: {OUTPUT_FINAL}')
    print(f'Pages: {n_pages}')
    print(f'Size: {size_kb:.1f} KB ({size_kb/1024:.2f} MB)')
