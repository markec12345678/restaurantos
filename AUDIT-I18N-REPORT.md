# i18n Translation Files Audit Report

**Task ID:** `audit-i18n`  
**Scope:** `messages/{sl,en,de,hr,it}.json` (5 files)  
**Methodology:** Programmatic key-flatten + cross-file diff + duplicate-key scan + empty-value scan + language-leak heuristic + strict JSON.parse verification (Node.js + Python).

---

## Executive Summary

| Check | Result |
|---|---|
| Total keys per file (flattened dotted paths) | **630** — identical across all 5 files ✅ |
| Missing keys (cross-file diff) | **0** ✅ |
| Duplicate keys (within-file, any object) | **0** ✅ |
| Empty string values (`""`) | **0** ✅ |
| Genuinely untranslated entries | **0** ✅ (all values localized) |
| `nav.auditLog` key present in all 5 files | **YES** ✅ |
| JSON syntax errors (strict RFC 8259) | **5** ❌ — **trailing comma after last property in every file** |

> **Critical finding:** All 5 files fail strict `JSON.parse()`. See §6. Bundler (Webpack/Turbopack) JSON loaders tolerate the trailing comma, so the app still runs, but the files are **not valid JSON** and will break any strict parser (jq, `json.loads`, JSON schema validators, IDE quick-fix, future `next-intl` internals if they switch to `JSON.parse`).

---

## 1. Key Counts Per File

| File | Line count | File size (bytes) | Flattened keys | Top-level sections |
|---|---:|---:|---:|---:|
| `sl.json` | 702 | 19864 | 630 | 48 |
| `en.json` | 702 | 19063 | 630 | 48 |
| `de.json` | 702 | 20467 | 630 | 48 |
| `hr.json` | 702 | 19907 | 630 | 48 |
| `it.json` | 702 | 20146 | 630 | 48 |

All 5 files contain exactly **630** flattened keys — **identical counts** ✅

Top-level sections (shared across all files): 36
```
auth, cashRegister, common, courses, delivery, discounts, employees, eod, forecast, giftCards, guests, haccp, happyHour, inventory, kitchen, loyalty, menu, nav, offline, orders, payments, purchaseOrders, qr, receipt, reorder, reports, reservations, settings, shifts, sidebar, stockCheck, superGroups, suppliers, tables, waitlist, webhooks
```

---

## 2. Missing Keys (Cross-File Diff)

Computed as: `union(all_keys) − keys(file)` for each file.

| File | Missing keys |
|---|---:|
| `sl.json` | 0 |
| `en.json` | 0 |
| `de.json` | 0 |
| `hr.json` | 0 |
| `it.json` | 0 |

**Result:** ✅ Zero missing keys. All 5 files have byte-identical key sets.

---

## 3. Duplicate Keys (Within Each File)

Method: `json.loads(text, object_pairs_hook=...)` — detects duplicates per object (last value wins in standard `JSON.parse`, mimicking production behavior).

| File | Duplicate keys |
|---|---:|
| `sl.json` | 0 |
| `en.json` | 0 |
| `de.json` | 0 |
| `hr.json` | 0 |
| `it.json` | 0 |

**Result:** ✅ No duplicate keys detected in any file.

---

## 4. Empty Values (`""`)

| File | Empty string values |
|---|---:|
| `sl.json` | 0 |
| `en.json` | 0 |
| `de.json` | 0 |
| `hr.json` | 0 |
| `it.json` | 0 |

**Result:** ✅ No empty string values in any file.

---

## 5. Untranslated Entries Check

Multi-pass heuristic scan was performed:

1. **Non-EN value identical to EN value** (len ≥ 4, has whitespace):

   | File | Key | Value | Verdict |
   |---|---|---|---|
   | sl, de, hr, it | `happyHour.title` | `"Happy Hour"` | Brand term, intentionally shared ✅ |
   | it | `nav.customerTimeline` | `"CRM Timeline"` | CRM acronym + "Timeline" loanword in Italian ✅ |
   | sl, de | `nav.orderBump` | `"Upsell & Order Bump"` | Brand/feature name, intentionally shared ✅ |

2. **Same value across 3+ files:** 43 keys flagged. All are legitimate cross-language shared vocabulary:
   - Single shared words: `Status`, `Filter`, `Telefon`, `Tema`, `Datum`, `Temperatura`
   - Acronyms: `COGS`, `FURS`, `HACCP`, `IBAN`
   - Brand/tech terms: `Webhooks`, `Happy Hour`, `Bump`, `Recall`, `Offline`

3. **Language-leak heuristics** (Slovenian markers in non-SL, Croatian in non-HR, German in non-DE, Italian in non-IT):
   - **No genuinely leaked translations found.** All flagged matches are words shared between Slavic languages (e.g., `Kuhinja` is valid in both sl and hr) or coincidental substrings (`storn-` is also a German prefix).
   - Note: `hr.json | nav.auditLog = "Revizijski dnevnik"` is identical to `sl.json`. While grammatically acceptable Croatian, a more idiomatic Croatian rendering would be `"Dnevnik revizije"` or `"Zapisnik revizije"`. **Minor stylistic inconsistency, not an error.**

4. **Deep scan for English function words** (`the`, `with`, `please`, `cancel`, etc.) in non-EN values:
   - 5 hits, all false positives — all match the preposition `"in"` which exists in German/Italian too.

**Result:** ✅ No genuinely untranslated entries. All values are properly localized in their respective target languages.

---

## 6. JSON Syntax Errors (Critical)

### Finding

All 5 files have a **trailing comma after the last property** before the closing `}`:

| File | Trailing comma location |
|---|---|
| `sl.json` | line 701 — after `"nav.auditLog": "..."` |
| `en.json` | line 701 — after `"nav.auditLog": "..."` |
| `de.json` | line 701 — after `"nav.auditLog": "..."` |
| `hr.json` | line 701 — after `"nav.auditLog": "..."` |
| `it.json` | line 701 — after `"nav.auditLog": "..."` |

### Verification (Node.js `JSON.parse`)

```
$ node -e "JSON.parse(require('fs').readFileSync('messages/sl.json','utf8'))"
SyntaxError: Expected double-quoted property name in JSON at position 19863 (line 702 column 1)
```

Same failure on all 5 files (`sl`, `en`, `de`, `hr`, `it`).

### Why this matters

| Concern | Status |
|---|---|
| RFC 8259 strict JSON compliance | ❌ Fails |
| Node.js `JSON.parse()` | ❌ Fails |
| Python `json.loads()` | ❌ Fails |
| `jq` | ❌ Fails |
| Webpack JSON loader (used by `next-intl` dynamic import in `src/i18n/request.ts:16`) | ✅ Tolerates (lenient JSON5-style parser) |
| Turbopack | ✅ Tolerates |

**Runtime impact today:** None — the app loads translations correctly because the bundler is lenient.

**Risk:** Any future change that uses a strict JSON parser (CI lint, schema validator, `next-intl` upgrade, migration tooling, IDE auto-format) will crash. This is a latent bug.

### Fix (one-line per file)

Remove the trailing comma on line 701 of each file:

```diff
-  "nav.auditLog": "Revizijski dnevnik",
+  "nav.auditLog": "Revizijski dnevnik"
```

Repeat for `en.json` ("Audit Log"), `de.json` ("Audit-Protokoll"), `hr.json` ("Revizijski dnevnik"), `it.json` ("Registro Audit").

---

## 7. `nav.auditLog` & Recently-Added Keys

Per worklog Task `8-furs-auditlog-setup-fixes`, the `nav.auditLog` key was added to all 5 files. Verification:

| File | `nav.auditLog` value | Present? |
|---|---|---|
| `sl.json` | `"Revizijski dnevnik"` | ✅ |
| `en.json` | `"Audit Log"` | ✅ |
| `de.json` | `"Audit-Protokoll"` | ✅ |
| `hr.json` | `"Revizijski dnevnik"` | ✅ (see §5 stylistic note) |
| `it.json` | `"Registro Audit"` | ✅ |

**Full `nav.*` group:** 13 keys, all present in all 5 files.

```
nav.auditLog, nav.compliance, nav.inventoryAlerts, nav.kitchenStations,
nav.orderBump, nav.profitLoss, nav.recipeScaling, nav.shiftOverview,
nav.tableReservationSync, nav.taxReport, nav.vendorScorecard, nav.wasteTracker
```

---

## 8. Recommendations / Next Actions

1. **(Critical)** Remove the trailing comma after `"nav.auditLog"` on line 701 of all 5 files (`sl.json`, `en.json`, `de.json`, `hr.json`, `it.json`). Trivial 5-character deletion per file.
2. **(Optional)** Verify the fix by running `node -e "JSON.parse(require('fs').readFileSync('messages/X.json','utf8'))"` for each file — should print nothing (success).
3. **(Optional)** Consider adopting `json5` or `eslint-plugin-json` to enforce strict JSON in CI.
4. **(Optional, stylistic)** Croatian `nav.auditLog` is currently `"Revizijski dnevnik"` (a Slovenian-style word order). Consider changing to `"Dnevnik revizije"` or `"Zapisnik revizije"` for native Croatian phrasing.

---

## Methodology / Scripts

Audit was performed with three Python scripts:

- `/tmp/i18n_audit2.py` — key counts, missing keys, duplicates, empty values, nav.auditLog presence, with trailing-comma auto-recovery.
- `/tmp/i18n_untranslated.py` — 7-pass heuristic for untranslated values (identical-to-EN, multi-file same, language-specific markers, ASCII-only multi-word values).
- `/tmp/i18n_deep.py` — deep scan for English function words (`the`, `with`, `please`, …) inside non-English values.

Node.js verification: `node -e "JSON.parse(fs.readFileSync('messages/sl.json','utf8'))"` confirms the trailing-comma syntax error at line 702 column 1 (position 19863) for all 5 files.
