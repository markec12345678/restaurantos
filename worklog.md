---
Task ID: 3
Agent: main
Task: Implement table→order linking, search improvements, enhanced payment

Work Log:
- Added editingOrderId and editingOrderNumber to Zustand store
- Created POST /api/orders/[id]/add-items API endpoint for adding items to existing orders
- Updated TableMap: "Dodaj artikle k naročilu" button on each active order in table orders dialog
- Updated TableMap: handleAddToOrder function that sets editingOrderId and switches to OrderPanel
- Updated OrderPanel: editing mode shows "Dodaj k #XX" in cart header with back button
- Updated OrderPanel: submit button changes text between "Oddaj naročilo" and "Dodaj k naročilu #XX"
- Added Ctrl+K / Cmd+K keyboard shortcut for search toggle
- Made search button more visible (full width, dashed border, larger)
- Added Escape key to close search
- Build successful, tested add-items API directly with Node.js

Stage Summary:
- Full table→order flow: click occupied table → see orders → click "Dodaj artikle" → OrderPanel in add-to-order mode → add items → submit
- Search improvements: Ctrl+K shortcut, Escape to close, more visible search trigger button
- API: POST /api/orders/[id]/add-items recalculates order totals automatically
