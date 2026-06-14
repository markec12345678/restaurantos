# Task 1: Add Authentication and Zod Validation to API Routes

## Summary
Added `requireAuth` authentication checks and Zod `validateBody` validation to 10 API route files that were missing them. This ensures all mutating operations (POST/PUT/DELETE) require authentication, sensitive read operations require appropriate permissions, and all request bodies are validated before processing.

## Files Edited

### 1. `/src/app/api/menu-items/route.ts`
- **Added**: `requireAuth(req)` to POST handler — unauthenticated menu item creation blocked
- **Added**: `validateBody(createMenuItemSchema, body)` to POST — validates name, price, categoryId etc.
- **Added**: Imports for `requireAuth` and `validateBody`/`createMenuItemSchema`
- **GET**: Left public (menu items are public read data)

### 2. `/src/app/api/menu-items/[id]/route.ts`
- **Added**: `requireAuth(req)` to both PUT and DELETE handlers
- **Added**: `validateBody(updateMenuItemSchema, body)` to PUT handler
- **Added**: 404 check via `findUnique` before both update and delete — returns 404 if menu item not found
- **Added**: Wrapped `deleteMany` + `createMany` for modifier groups inside `db.$transaction()` in PUT handler — ensures atomicity
- **Added**: Imports for `requireAuth`, `validateBody`, `updateMenuItemSchema`

### 3. `/src/app/api/categories/route.ts`
- **Added**: `requireAuth(req)` to POST handler
- **Added**: `validateBody(createCategorySchema, body)` to POST with inline schema:
  - `name`: string min(1) max(100)
  - `icon`: string max(10), default '🍽️'
  - `color`: string max(20), default '#f59e0b'
  - `sortOrder`: number int min(0), default 0
  - `menuId`: string min(1)
- **Added**: Imports for `z`, `requireAuth`, `validateBody`
- **GET**: Left public (categories are public read data)

### 4. `/src/app/api/recipes/route.ts`
- **Added**: `requireAuth(req, { permission: 'manage_inventory' })` to GET handler
- **Added**: `requireAuth(req)` to POST, PUT, DELETE handlers
- **Added**: `validateBody(createRecipeSchema, body)` to POST with inline schema:
  - `menuItemId`: string min(1)
  - `inventoryItemId`: string min(1)
  - `quantityPerServing`: number positive()
  - `unit`: string max(30), default ''
  - `notes`: string max(500), default ''
- **Added**: `validateBody(updateRecipeSchema, body)` to PUT with inline schema:
  - `id`: string min(1)
  - `quantityPerServing`: number positive(), optional
  - `unit`: string max(30), optional
  - `notes`: string max(500), optional
- **Added**: Imports for `z`, `requireAuth`, `validateBody`

### 5. `/src/app/api/inventory/transactions/route.ts`
- **Added**: `requireAuth(req)` to GET handler — inventory transaction history requires authentication
- **Added**: Import for `requireAuth`

### 6. `/src/app/api/inventory/menu-stock/route.ts`
- **Added**: `requireAuth(req, { permission: 'manage_inventory' })` to GET handler — menu stock data requires manage_inventory permission
- **Added**: Import for `requireAuth`

### 7. `/src/app/api/tables/route.ts`
- **Added**: `requireAuth(req)` to POST handler — table creation requires authentication
- **Added**: Import for `requireAuth`
- **GET**: Left public (already was)
- Note: Zod validation via `createTableSchema` was already present

### 8. `/src/app/api/tables/[id]/route.ts`
- **Added**: `requireAuth(req)` to PUT handler — table updates require authentication
- **DELETE**: Already had `requireAuth` with `take_orders` permission
- Note: Zod validation via `updateTableSchema` was already present; 404 check was already present

### 9. `/src/app/api/payments/route.ts`
- **Added**: `requireAuth(req, { permission: 'manage_cash' })` to GET handler — payment listing requires manage_cash permission
- Note: POST already had auth + validation

### 10. `/src/app/api/kitchen/route.ts`
- **Added**: `try/catch` wrapper around the entire GET handler body — previously the DB queries and enrichment logic ran without error handling, risking unhandled exceptions
- **Added**: Proper error response: `{ error: 'Napaka pri pridobivanju kuhinjskih naročil' }` with status 500
- Note: `requireAuth` was already present with `take_orders` permission

## Lint Status
No new lint errors introduced. All existing lint errors in the project are pre-existing and unrelated to these changes.
