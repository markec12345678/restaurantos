# Task 3 - PackagingConfig and PackagingItem API Routes

## Summary
Created two API route files for packaging CRUD operations in the Slovenian restaurant POS system.

## Files Created
1. `/src/app/api/packaging/route.ts` — GET all, POST new
2. `/src/app/api/packaging/[id]/route.ts` — GET, PUT, DELETE single

## API Endpoints

### GET /api/packaging
- Returns all packaging configs with nested items
- Supports `?isActive=true|false` query filter
- Items ordered by `sortOrder: asc`

### POST /api/packaging
- Creates new packaging config with nested items in one request
- Validates `name` is required (400 if missing)
- Supports nested `items` array with name, price, isActive, sortOrder
- Returns created config with items, status 201

### GET /api/packaging/[id]
- Returns single packaging config with items
- 404 "Embalaža ni najdena" if not found

### PUT /api/packaging/[id]
- Updates config fields (name, isActive)
- Replaces all items when `items` array provided (deleteMany + create pattern)
- 404 check before update
- Returns updated config with items

### DELETE /api/packaging/[id]
- Deletes config (cascade deletes items via Prisma schema)
- 404 check before delete
- Returns `{ success: true }`

## Conventions Followed
- `db` imported from `@/lib/db`
- `NextResponse` from `next/server`
- `params: Promise<{ id: string }>` pattern (Next.js 16)
- All error messages in Slovenian
- Consistent with existing routes (discounts, gift-cards patterns)

## Validation
- `bun run db:push` — database in sync
- ESLint on new files — 0 errors
