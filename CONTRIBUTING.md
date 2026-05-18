# 🤝 Prispevanje k RestaurantOS

Hvala za zanimanje za prispevanje k RestaurantOS! Ta dokument vsebuje smernice za razvijalce, ki želijo sodelovati pri razvoju projekta.

---

## 📋 Vsebina

- [Kako začeti](#kako-začeti)
- [Postopek za Pull Request](#postopek-za-pull-request)
- [Standardi kodiranja](#standardi-kodiranja)
- [Struktura projekta](#struktura-projekta)
- [Dodajanje novih funkcij](#dodajanje-novih-funkcij)
- [Commit sporočila](#commit-sporočila)
- [Testiranje](#testiranje)
- [Jeziki in prevodi](#jeziki-in-prevodi)

---

## Kako začeti

### 1. Fork in kloniraj

```bash
# Fork repozitorij na GitHubu, nato:
git clone https://github.com/YOUR_USERNAME/restaurantos.git
cd restaurantos
```

### 2. Namesti odvisnosti

```bash
npm install
```

### 3. Nastavi okolje

```bash
cp .env.example .env
# Uredi .env in nastavi vsaj GEMINI_API_KEY
```

### 4. Pripravi bazo

```bash
npx prisma db push
npx prisma generate
```

### 5. Zaženi razvojni strežnik

```bash
npm run dev
```

### 6. Ustvari vejo za svojo funkcijo

```bash
git checkout -b feature/ime-tvoje-funkcije
```

---

## Postopek za Pull Request

1. **Ustvari issue** — Opiši funkcijo ali popravek, ki ga želiš dodati
2. **Veja** — Ustvari vejo iz `main` z ustreznim imenom (glej spodaj)
3. **Razvij** — Napiši kodo, upoštevaj smernice spodaj
4. **Preizkusi** — Preveri, da aplikacija deluje brez napak
5. **Commit** — Uporabi konvencionalna commit sporočila
6. **Push** — Potisni svojo vejo na GitHub
7. **PR** — Odpri Pull Request z opisom sprememb

### Imena vej

| Vrsta | Format | Primer |
|---|---|---|
| Funkcija | `feature/ime-funkcije` | `feature/delivery-tracking` |
| Popravek | `fix/ime-popravka` | `fix/order-total-calculation` |
| Dokumentacija | `docs/ime` | `docs/api-reference` |
| Refaktor | `refactor/ime` | `refactor/order-panel` |

---

## Standardi kodiranja

### TypeScript

- Uporabljaj **strog tip** za vse spremenljivke in parametre
- Izogibaj se `any` — uporabi specifične tipe ali generike
- Vse API rute morajo uporabljati **Zod validacijo** za vhodne podatke
- Uporabljaj `interface` za objektne tipe, `type` za unije in preslikave

### React komponente

- Funkcijske komponente s TypeScriptom (ne razredne)
- Imena komponent: **PascalCase** (npr. `OrderPanel`, `TableMap`)
- Props: Definiraj `interface ComponentNameProps` nad komponento
- Stanje: Uporabi `useState` za lokalno, `Zustand` za globalno
- Podatki: Uporabi `TanStack Query` za strežniške podatke
- Styled: Uporabi **Tailwind CSS** razrede, ne inline stilov

### API rute

```typescript
// Vsaka zaščitena API ruta mora:
// 1. Klicati requireAuth() za avtentikacijo
// 2. Validirati vhodne podatke z Zod shemo
// 3. Uporabljati Prisma $transaction za kritične operacije
// 4. Vrniti ustrezne HTTP statusne kode

import { requireAuth } from '@/lib/auth-middleware';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

export async function POST(request: Request) {
  const authResult = await requireAuth(request);
  if ('error' in authResult) {
    return Response.json({ error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json();
  const validated = schema.parse(body); // Zod validacija

  const result = await prisma.model.create({ data: validated });
  return Response.json(result, { status: 201 });
}
```

### Prisma modeli

- Imena modelov: **PascalCase** (ednina)
- Polja: **camelCase**
- Vsak model mora imeti `createdAt` in `updatedAt` (Prisma avtomatsko)
- Uporabljaj `enum` za konstantne vrednosti
- Relacije: Eksplicitno poimenuj `@relation` z `fields` in `references`

---

## Struktura projekta

```
src/
├── app/
│   ├── api/[modul]/        # API rute (REST)
│   └── [locale]/           # Strani z i18n podporo
├── components/
│   ├── pos/                # POS poslovne komponente
│   └── ui/                 # shadcn/ui osnovne komponente
└── lib/
    ├── auth-middleware.ts   # Avtentikacija
    ├── db.ts               # Prisma klient
    ├── store.ts            # Zustand stanje
    └── validations.ts      # Zod sheme
```

---

## Dodajanje novih funkcij

### Koraki za novo funkcijo

1. **Prisma model** — Dodaj model v `prisma/schema.prisma`
2. **DB push** — Zaženi `npx prisma db push`
3. **API route** — Ustvari `src/app/api/[modul]/route.ts`
4. **Zod validacija** — Definiraj shemo v `src/lib/validations.ts` ali v sami ruti
5. **Komponenta** — Ustvari `src/components/pos/[Komponenta].tsx`
6. **i18n** — Dodaj ključe v vseh 5 jezikih (`messages/sl.json`, `en.json`, itd.)
7. **Sidebar** — Registriraj v `src/components/pos/Sidebar.tsx`
8. **POS page** — Registriraj v `src/app/[locale]/pos/page.tsx`

### Primer nove komponente

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'next-intl';

export default function NewFeature() {
  const t = useTranslation('NewFeature');
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/new-feature')
      .then(res => res.json())
      .then(setData);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Vsebina komponente */}
      </CardContent>
    </Card>
  );
}
```

---

## Commit sporočila

Uporabljaj [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<vrsta>: <opis>

[neobvezno telo]
```

### Vrste

| Vrsta | Opis |
|---|---|
| `feat` | Nova funkcija |
| `fix` | Popravek napake |
| `docs` | Sprememba dokumentacije |
| `style` | Oblikovanje (brez spremembe logike) |
| `refactor` | Refaktoriranje (brez spremembe obnašanja) |
| `perf` | Izboljšava zmogljivosti |
| `test` | Dodajanje ali spreminjanje testov |
| `chore` | Vzdrževalna opravila |

### Primeri

```
feat: Add delivery tracking with GPS support
fix: Fix order total calculation with multiple discounts
docs: Update API documentation for reservations
refactor: Extract table status logic into shared hook
```

---

## Testiranje

### Ročno testiranje

Pred oddajo PR-ja preveri:

1. **Build** — `npm run build` mora uspeti brez napak
2. **TypeScript** — `npx tsc --noEmit` brez tipovnih napak
3. **Funkcionalnost** — Preizkusi novo funkcijo v brskalniku
4. **i18n** — Preveri, da vsi ključi obstajajo v vseh 5 jezikih
5. **Auth** — Preveri, da API rute zahtevajo avtentikacijo
6. **Offline** — Preveri, da aplikacija deluje brez internetne povezave

### Avtomatsko testiranje (načrtovano)

```bash
# Enotni testi (prihodnje)
npm run test

# E2E testi (prihodnje)
npm run test:e2e
```

---

## Jeziki in prevodi

RestaurantOS podpira 5 jezikov. Vsaka nova funkcija mora vključevati prevode za vse jezike:

| Jezik | Datoteka | Koda |
|---|---|---|
| Slovenščina | `messages/sl.json` | `sl` |
| English | `messages/en.json` | `en` |
| Italiano | `messages/it.json` | `it` |
| Hrvatski | `messages/hr.json` | `hr` |
| Deutsch | `messages/de.json` | `de` |

### Dodajanje novih prevodov

1. Dodaj ključe v `messages/sl.json` (referenčni jezik)
2. Kopiraj ključe v ostale 4 datoteke s pravilnim prevodom
3. Uporabi `useTranslation()` hook v komponentah za dostop do prevodov
4. Ključi naj bodo organizirani po modulu (npr. `"staffScheduler.title"`)

---

## Vprašanja in pomoč

- **Issues** — Odpri issue na [GitHub Issues](https://github.com/markec12345678/restaurantos/issues)
- **Diskusije** — Uporabi GitHub Discussions za splošna vprašanja
- **Email** — Kontaktiraj vzdrževalca preko GitHub profila

---

Hvala za tvoj prispevek! 🎉
