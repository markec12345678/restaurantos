---
Task ID: 1
Agent: main
Task: Implement next-intl multilingualism, enhance QR ordering, generate missing images

Work Log:
- Created next-intl infrastructure: src/i18n/request.ts, src/i18n/provider.tsx, src/middleware.ts
- Updated next.config.ts with next-intl plugin
- Created translation files for 5 languages: messages/sl.json, en.json, it.json, de.json, hr.json
- Updated layout.tsx with NextIntlClientProvider and I18nProvider
- Added language switcher to Sidebar.tsx with Globe icon and locale selection dropdown
- Enhanced QR ordering page with:
  - Search bar (filters across all categories)
  - Item detail modal (click to see full details + add note)
  - Call waiter button (with 30s cooldown, POST to /api/public/call-waiter)
  - Super-groups for drinks (Vina, Piva, Žgane pijače, Napitki, Brezalkoholne)
  - Locale-aware placeholders (t.optional, t.notePlaceholder, t.statusAutoUpdates)
  - New translation keys: search, searchResults, callWaiter, waiterCalled, itemDetail, addItemNote, statusAutoUpdates, optional, notePlaceholder, wines, beers, spirits, beverages, nonAlcoholic
- Created /api/public/call-waiter API endpoint (WebSocket broadcast + audit log)
- Updated Service Worker cache to v10
- Analyzed missing images: 54 items have image paths pointing to non-existent files
- Created gen_missing_images.sh script for later batch generation (API rate-limited)

Stage Summary:
- next-intl configured and working (build passes)
- 5-language translations for all POS modules
- QR ordering page significantly enhanced (1520 lines, was 1103)
- Language switcher in admin Sidebar
- Call waiter API and UI button
- 54 images still need generation (API 429 rate limit)
- Build: SUCCESS
