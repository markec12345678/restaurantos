---
Task ID: 1
Agent: Main Agent
Task: Implement professional POS menu hierarchy based on industry research

Work Log:
- Researched how professional POS systems (Toast POS, Square, Lightspeed, Revel) organize menus
- Key finding: Toast POS uses Menu → Category → MenuItem → ModifierGroup → Modifier hierarchy
- Updated Prisma schema with new models: Menu, Category (with menuId), ModifierGroup, Modifier, MenuItemModifierGroup
- Added modifiersJson field to OrderItem for storing selected modifiers per order item
- Updated seed data with professional structure:
  - 2 Menus: Hrana (🍽️) and Pijača (🥤)
  - 8 Food categories: Predjedi, Juhe, Glavne jedi, Testenine, Pica, Burgerji, Sladice, Priloge
  - 4 Drink categories: Vroče pijače, Hladne pijače, Alkoholne pijače, Koktajli
  - 10 Modifier groups: Način pečenja, Priloga, Omaka, Sir, Mleko, Sladilo, Alkoholni dodatek, Velikost pice, Velikost burgerja, Velikost pijače
  - 40+ menu items with proper modifier group associations
- Created new API routes: /api/menus, /api/menus/[id], /api/modifier-groups, /api/modifier-groups/[id]
- Updated existing API routes: /api/categories (with menuId), /api/menu-items (with modifier groups), /api/orders (with modifiersJson)
- Updated store.ts with modifier support in cart (SelectedModifier type, cartKey for same item with different modifiers)
- Rewrote OrderPanel with:
  - Menu tabs (Hrana/Pijača) at the top
  - Category pills filtered by active menu
  - Modifier selection dialog when adding items with modifiers
  - Modifier badges in cart items
  - Slovenian status labels (Čakajoče, V obdelavi, Pripravljeno, Zaključeno)
  - Currency changed from $ to € throughout
- Rewrote MenuManager with 4 tabs: Artikli, Kategorije, Meniji, Dodatki
  - Category creation now requires selecting a menu
  - Item form includes modifier group checkboxes
  - Categories displayed grouped by menu
  - Modifier groups tab shows all groups with their options and usage
- Updated Dashboard, ReportsView, InventoryManager to use € instead of $
- Updated Dashboard status labels to Slovenian
- Build successful, all 24 API routes working

Stage Summary:
- Professional menu hierarchy implemented following Toast POS standard
- Food and drinks are separated at the top level (Menu tabs)
- Modifier system allows items like steaks to have cooking level, side choice, sauce choice
- Coffee drinks support milk type, sweetener, and alcohol additions
- Pizza supports size selection with price differences
- All UI in Slovenian, all currency in €
