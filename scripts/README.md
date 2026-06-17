# /scripts — Operational & tooling scripts

Developer-side scripts for seeding, image generation, and operations. **Not** shipped
to production.

## Layout

| Subdir | Contents |
|---|---|
| `images/` | Food-image generation & replacement pipeline (AI / Pexels / stock / SVG), plus image audit reports |
| `seed/` | One-off database seeding helpers (`add_food_items.js`) |
| `ops/` | Server start / keep-alive / restart wrappers (`start.sh`, `keep-alive.sh`, `run-prod.sh`, …) |
| *(root)* | Build helpers (`copy-standalone.mjs`), category consolidation, SVG/PNG conversion, duplicate fixers, seed-expansion TS |

## Usage

```bash
# Copy standalone build output (auto-runs on `next build` via postbuild)
bun scripts/copy-standalone.mjs

# Start production via PM2
bash scripts/ops/start-production.sh

# Seed minimal menu
bun scripts/seed-minimal.mjs
```

> Runtime server entry (`server.js`), process daemon (`daemon.js`), and PM2 config
> (`ecosystem.config.js`) remain at the project root.
