# Prispevanje k RestaurantOS

Hvala za zanimanje za prispevanje! 🎉

## 🚀 Kako začeti

```bash
# 1. Fork repozitorija
# 2. Kloniraj svoj fork
git clone https://github.com/TVOJ-USERNAME/restaurantos.git
cd restaurantos

# 3. Namesti odvisnosti
bun install

# 4. Ustvari .env
cp .env.example .env
# Nastavi DATABASE_URL in NEXTAUTH_SECRET

# 5. Zaženi bazo
bun run db:push

# 6. Zaženi dev server
bun run dev
```

## 📋 Pred pošiljanjem PR-ja

- [ ] Koda opravi `bun run lint`
- [ ] Koda opravi `bun run typecheck`
- [ ] Testi opravijo `bun run test`
- [ ] Ni `console.log` v produkciji (uporabi `logger`)
- [ ] Ni `any` tipov (uporabi pravilne tipe ali `eslint-disable` z komentarjem)
- [ ] Input validacija z Zod na novih endpointih
- [ ] `requireAuth()` na novih API endpointih
- [ ] Rate limiting na občutljivih endpointih

## 🏗️ Arhitektura

Glej [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) za sistemski diagram in module.

## 🔒 Varnost

- **CRITICAL ranljivosti:** NE odpri GitHub issue — pošlji email na security@restaurantos.app
- Vse spremembe avtentikacije morajo biti fail-closed (ne fail-open)
- PIN-i se hashirajo z bcrypt (10 rounds) + HMAC-SHA256
- Audit log uporablja SHA-256 chain hash (nepopravljiv)

## 📝 Code Style

- TypeScript strict mode
- ESLint flat config
- Prettier (2 spaces, single quotes, no semicolons)
- Imena: camelCase za spremenljivke, PascalCase za komponente/tipe
- Komentarji: slovensko (za poslovno logiko), angleško (za tehnične)

## 🧪 Testiranje

```bash
# Unit testi
bun run test

# E2E testi
bun run test:e2e

# Type check
bun run typecheck

# Lint
bun run lint
```

## 📦 Commit Convention

```
type: kratki opis

type: feat, fix, chore, docs, test, refactor, perf, security
```

Primeri:
```
feat: dodaj auto-image lookup za artikle
fix: race condition v payment creation
security: dodaj rate limiting na AI endpoints
docs: posodobi ARCHITECTURE.md
```

## 🔄 PR Process

1. Ustvari feature branch: `git checkout -b feat/ime-funkcije`
2. Commit spremembe
3. Push: `git push origin feat/ime-funkcije`
4. Odpri Pull Request na `main`
5. CI mora pass-ati (Lint + Typecheck + Security Audit)
6. Code review
7. Merge

## 📄 Licenca

MIT License — prispevki so licencirani pod isto licenco.

---

Hvala za prispevanje! 🙏
