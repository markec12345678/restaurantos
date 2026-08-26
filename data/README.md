# /data — Reference & scraped data

This directory holds **non-source data files** (JSON dumps, scraped menus, API reference
payloads, audit outputs). These files are **not** imported by the application at runtime —
they are reference material and historical seed data kept for reproducibility.

## Layout

| Subdir | Contents |
|---|---|
| `menus/` | Scraped / exported restaurant menus (`jurman_*.json`, `favola_menu.json`, `ponvica_menu.json`, …) |
| `search/` | Captured web-search results used during design research (`search_*.json`, `qr_*.json`) |
| `api-dumps/` | Reference payloads from third-party POS APIs (`toast_*.json`, `pos_*.json`) for schema inspiration |
| `slovenian/` | Slovenian food / drink reference datasets (`slo_alcohol.json`, `slovenian_food.json`, `tasteatlas_slo.json`) |
| `audit/` | One-off audit outputs (`page_allergens*.json`, `page_qr_guide.json`) |
| `misc/` | Miscellaneous reference data (`all_items.json`, `pub_food.json`) |

> Regenerable scratch files (image audits, VLM progress, missing-image lists) are
> gitignored and **not** version-controlled — see `.gitignore`.
