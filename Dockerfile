# ============================================
# RestaurantOS — Production Docker Image
# ============================================
# ARHITEKTURNA SPREMEMBA (deploy audit 2026-09-09):
#
#   1. BUILD NE DOSTOPA DO BAZE. Prej je "build" poganjal
#      ad-hoc DDL (nekdanji scripts/db-sync.mjs — datoteka je
#      ODSTRANJENA: trdila je, da dela samo nedestruktivne spremembe,
#      izvajala pa DROP CONSTRAINT / ALTER TYPE / UPDATE / SET NOT NULL).
#      Sdaj je build čisto `next build` — migracije aplicira LOČEN korak
#      pred zagonom: docker compose run --rm migrate
#      (prisma migrate deploy + db:verify)
#
#   2. RUNNER POGANJA CUSTOM SERVER (server.js + server-ws-core.js),
#      ne Next standalone strežnika — standalone NIMA WebSocket
#      podpore (glej DEPLOYMENT.md). Custom server = Next.js + WS
#      v enem procesu (Možnost A).
#
#   3. BUN (ne npm): projekt uporablja bun.lock (package-lock je
#      iz repoza odstranjen). En sam package manager, frozen lockfile.
#
# Build: docker build -t restaurantos .
# Run:   docker compose up -d  (glej docker-compose.yml)
# ============================================

# ── 1. Odvisnosti (full — za build + prisma generate) ──
# alpine (musl) VSAKI fazi: Prisma query engine se generira za platformo
# builda in se v runnerju (prav tako alpine/musl) dejansko zažene.
FROM oven/bun:1-alpine AS deps
WORKDIR /app
# prisma/schema.prisma je OBVEZNA za postinstall (prisma generate)
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ── 2. Build (BREZ DATABASE_URL — baza se NE dotika!) ──
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build (postbuild: copy-standalone.mjs za NE-Docker zagon).
# .next/cache (build cache, lahko >500 MB) in .next/standalone (za
# ne-WS standalone zagon) nista potrebna v sliki — ju odstranimo.
RUN bun run build && rm -rf .next/cache .next/standalone

# ── 3. Produkcijske odvisnosti (brez devDeps, brez skript) ──
# `prisma` CLI je NAMENOMO v dependencies — migrate servis ga potrebuje
# (npx prisma migrate deploy znotraj containerja).
FROM oven/bun:1-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile --production --ignore-scripts

# ── 4. Runner: Node + custom server (Next.js + WebSocket) ──
FROM node:26-alpine AS runner
WORKDIR /app
# libc6-compat: Prisma engine na alpine; tzdata: TZ=Europe/Ljubljana
RUN apk add --no-cache libc6-compat tzdata

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Europe/Ljubljana

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Produkcijski node_modules + GENERIRANI Prisma client (engine: alpine/musl,
# pride iz builder faze, kjer je `prisma generate` tekel)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Build izhod: FULL .next (custom server ga potrebuje, NE standalone)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Custom server: Next.js + WebSocket v enem procesu (DEPLOYMENT.md Možnost A)
COPY --from=builder /app/server.js /app/server-ws-core.js ./

# Prisma migracije + operacijska orodja (verify-db, deploy-test)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Upload dir (runtime zapisljiv volume)
RUN mkdir -p /app/upload /app/public/uploads
VOLUME /app/upload

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# FURS boot guard teče v server.js (produkcija + simulation → exit 1)
CMD ["node", "server.js"]
