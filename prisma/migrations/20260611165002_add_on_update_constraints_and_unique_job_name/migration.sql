-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📋',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Menu_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🍽️',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "menuId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vatRate" DECIMAL NOT NULL DEFAULT 22.00,
    "allergens" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "salesCategoryId" TEXT,
    "priceGroupId" TEXT,
    "revenueCenterId" TEXT,
    "prepStationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItem_salesCategoryId_fkey" FOREIGN KEY ("salesCategoryId") REFERENCES "SalesCategory" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "MenuItem_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "MenuItem_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "MenuItem_prepStationId_fkey" FOREIGN KEY ("prepStationId") REFERENCES "PrepStation" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT NOT NULL DEFAULT '',
    "modifierGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Modifier_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiningOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serviceChargeId" TEXT,
    "prepTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiningOption_serviceChargeId_fkey" FOREIGN KEY ("serviceChargeId") REFERENCES "ServiceCharge" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "RevenueCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "isAutoApply" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PrepStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'kitchen',
    "avgPrepTime" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlternatePaymentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'voucher',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VoidReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NoSaleReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'thermal',
    "location" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "printRules" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PackagingConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PackagingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL DEFAULT 0,
    "packagingConfigId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingItem_packagingConfigId_fkey" FOREIGN KEY ("packagingConfigId") REFERENCES "PackagingConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "area" TEXT NOT NULL DEFAULT 'main',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 8,
    "height" REAL NOT NULL DEFAULT 10,
    "shape" TEXT NOT NULL DEFAULT 'round',
    "rotation" REAL NOT NULL DEFAULT 0,
    "revenueCenterId" TEXT,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Table_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Table_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "diningOptionId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'dine-in',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tableId" TEXT,
    "revenueCenterId" TEXT,
    "guestId" TEXT,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "tip" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "splitCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelledAt" DATETIME,
    "cancelledBy" TEXT NOT NULL DEFAULT '',
    "inventoryDeducted" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "deliveryInfoId" TEXT,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_diningOptionId_fkey" FOREIGN KEY ("diningOptionId") REFERENCES "DiningOption" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Order_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Order_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Order_deliveryInfoId_fkey" FOREIGN KEY ("deliveryInfoId") REFERENCES "DeliveryInfo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "checkId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL NOT NULL,
    "vatRate" DECIMAL NOT NULL DEFAULT 22.00,
    "vatAmount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "modifiersJson" TEXT NOT NULL DEFAULT '[]',
    "menuItemName" TEXT NOT NULL DEFAULT '',
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidReasonId" TEXT,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "appliedDiscountId" TEXT,
    "courseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "OrderItem_voidReasonId_fkey" FOREIGN KEY ("voidReasonId") REFERENCES "VoidReason" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "OrderItem_appliedDiscountId_fkey" FOREIGN KEY ("appliedDiscountId") REFERENCES "Discount" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "OrderItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkNumber" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "tip" DECIMAL NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "appliedDiscountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Check_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Check_appliedDiscountId_fkey" FOREIGN KEY ("appliedDiscountId") REFERENCES "Discount" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "tipAmount" DECIMAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "alternatePaymentTypeId" TEXT,
    "cardType" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "authorizationCode" TEXT NOT NULL DEFAULT '',
    "giftCardId" TEXT,
    "loyaltyAccountId" TEXT,
    "loyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "employeeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_alternatePaymentTypeId_fkey" FOREIGN KEY ("alternatePaymentTypeId") REFERENCES "AlternatePaymentType" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Payment_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Payment_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'check',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "promoCode" TEXT NOT NULL DEFAULT '',
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "recipientPhone" TEXT NOT NULL DEFAULT '',
    "deliveryInstructions" TEXT NOT NULL DEFAULT '',
    "promisedTime" DATETIME,
    "estimatedTime" DATETIME,
    "actualTime" DATETIME,
    "courierName" TEXT NOT NULL DEFAULT '',
    "courierPhone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "packagingFee" DECIMAL NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL NOT NULL DEFAULT 0,
    "latitude" REAL,
    "longitude" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "hireDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pin" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "basePayRate" DECIMAL NOT NULL DEFAULT 0,
    "overtimeRate" DECIMAL NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmployeeJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "payRate" DECIMAL NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shift_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT,
    "clockIn" DATETIME NOT NULL,
    "clockOut" DATETIME,
    "breakStart" DATETIME,
    "breakEnd" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "payRate" DECIMAL NOT NULL DEFAULT 0,
    "totalPay" DECIMAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'regular',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "CashRegisterShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "startingCash" DECIMAL NOT NULL DEFAULT 0,
    "closingCash" DECIMAL NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL NOT NULL DEFAULT 0,
    "cashSales" DECIMAL NOT NULL DEFAULT 0,
    "cardSales" DECIMAL NOT NULL DEFAULT 0,
    "mobileSales" DECIMAL NOT NULL DEFAULT 0,
    "alternateSales" DECIMAL NOT NULL DEFAULT 0,
    "splitPayments" DECIMAL NOT NULL DEFAULT 0,
    "totalSales" DECIMAL NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalDiscounts" DECIMAL NOT NULL DEFAULT 0,
    "totalTips" DECIMAL NOT NULL DEFAULT 0,
    "totalVoided" DECIMAL NOT NULL DEFAULT 0,
    "cashDifference" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashRegisterShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "CashRegisterShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" DECIMAL NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL NOT NULL DEFAULT 0,
    "costPerUnit" DECIMAL NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "location" TEXT NOT NULL DEFAULT 'main',
    "expiryDate" DATETIME,
    "servingsPerUnit" DECIMAL NOT NULL DEFAULT 1,
    "servingSize" TEXT NOT NULL DEFAULT '',
    "costPerServing" DECIMAL NOT NULL DEFAULT 0,
    "menuItemId" TEXT,
    "lastRestocked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "previousQty" DECIMAL NOT NULL,
    "newQty" DECIMAL NOT NULL,
    "costPerUnit" DECIMAL NOT NULL,
    "totalCost" DECIMAL NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "supplierDoc" TEXT NOT NULL DEFAULT '',
    "employeeName" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityPerServing" DECIMAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipeItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL DEFAULT 'BLG-001',
    "zoi" TEXT NOT NULL DEFAULT '',
    "eor" TEXT NOT NULL DEFAULT '',
    "fiscalVerified" BOOLEAN NOT NULL DEFAULT false,
    "fiscalStatus" TEXT NOT NULL DEFAULT 'none',
    "verificationDate" DATETIME,
    "subtotal" DECIMAL NOT NULL,
    "vatBreakdown" TEXT NOT NULL DEFAULT '{}',
    "totalVat" DECIMAL NOT NULL,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "tip" DECIMAL NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "isCopy" BOOLEAN NOT NULL DEFAULT false,
    "isStorno" BOOLEAN NOT NULL DEFAULT false,
    "stornoOf" TEXT NOT NULL DEFAULT '',
    "printedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "checkId" TEXT,
    "monetaryValue" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyTransaction_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardNumber" TEXT NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "initialBalance" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giftCardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "balanceAfter" DECIMAL NOT NULL,
    "orderId" TEXT,
    "checkId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'RestaurantOS',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "web" TEXT NOT NULL DEFAULT '',
    "businessId" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "registerNumber" TEXT NOT NULL DEFAULT 'BLG-001',
    "fursCertPath" TEXT NOT NULL DEFAULT '',
    "fursCertPassword" TEXT NOT NULL DEFAULT '',
    "fursEnvironment" TEXT NOT NULL DEFAULT 'test',
    "defaultVatRate" DECIMAL NOT NULL DEFAULT 22.00,
    "reducedVatRate" DECIMAL NOT NULL DEFAULT 9.50,
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPointsPerEuro" INTEGER NOT NULL DEFAULT 1,
    "loyaltyPointsValue" DECIMAL NOT NULL DEFAULT 0.01,
    "receiptFooter" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'sl-SI',
    "country" TEXT NOT NULL DEFAULT 'SI',
    "autoGratuityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoGratuityPercent" DECIMAL NOT NULL DEFAULT 10.00,
    "autoGratuityThreshold" INTEGER NOT NULL DEFAULT 6,
    "allergenFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'restaurant',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'SI',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "businessId" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "registerNumber" TEXT NOT NULL DEFAULT '',
    "premisesId" TEXT NOT NULL DEFAULT '',
    "fursCertPath" TEXT NOT NULL DEFAULT '',
    "fursCertPassword" TEXT NOT NULL DEFAULT '',
    "fursEnvironment" TEXT NOT NULL DEFAULT 'test',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Ljubljana',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'sl-SI',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "latitude" REAL,
    "longitude" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "postCodes" TEXT NOT NULL DEFAULT '[]',
    "cities" TEXT NOT NULL DEFAULT '[]',
    "radiusKm" REAL,
    "centerLat" REAL,
    "centerLng" REAL,
    "deliveryFee" DECIMAL NOT NULL DEFAULT 2.50,
    "minOrderAmount" DECIMAL NOT NULL DEFAULT 10.00,
    "freeDeliveryAbove" DECIMAL NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryZone_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL DEFAULT '08:00',
    "closeTime" TEXT NOT NULL DEFAULT '22:00',
    "breakStart" TEXT NOT NULL DEFAULT '',
    "breakEnd" TEXT NOT NULL DEFAULT '',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpeningHours_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HaccpEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "employeeName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT NOT NULL DEFAULT '',
    "lastTriggered" DATETIME,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "terminalId" TEXT,
    "chainHash" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "shiftDate" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL DEFAULT 'morning',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "locationId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'server',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "confirmedAt" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "dateTime" DATETIME NOT NULL,
    "partySize" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 120,
    "tableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "notes" TEXT NOT NULL DEFAULT '',
    "specialRequests" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'walk_in',
    "employeeId" TEXT,
    "confirmedAt" DATETIME,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "actualArrival" DATETIME,
    "actualDeparture" DATETIME,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "vipSince" DATETIME,
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "dietaryPrefs" TEXT NOT NULL DEFAULT '[]',
    "dislikes" TEXT NOT NULL DEFAULT '[]',
    "favoriteItems" TEXT NOT NULL DEFAULT '[]',
    "birthday" DATETIME,
    "anniversary" DATETIME,
    "company" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL NOT NULL DEFAULT 0,
    "avgCheckAmount" DECIMAL NOT NULL DEFAULT 0,
    "lastVisitAt" DATETIME,
    "firstVisitAt" DATETIME,
    "loyaltyAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guest_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "GuestVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "orderId" TEXT,
    "tableId" TEXT,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "totalSpent" DECIMAL NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL NOT NULL DEFAULT 0,
    "feedbackScore" INTEGER,
    "feedbackComment" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "arrivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departedAt" DATETIME,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestVisit_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "contactPerson" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'Slovenija',
    "businessId" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "bank" TEXT NOT NULL DEFAULT '',
    "paymentTerms" TEXT NOT NULL DEFAULT '30 dni',
    "deliveryDays" TEXT NOT NULL DEFAULT '[]',
    "minOrderAmount" DECIMAL NOT NULL DEFAULT 0,
    "rating" DECIMAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "receivedDate" DATETIME,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    "deliveryAddress" TEXT NOT NULL DEFAULT '',
    "deliveryNotes" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT NOT NULL DEFAULT '',
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantityOrdered" DECIMAL NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitPrice" DECIMAL NOT NULL DEFAULT 0,
    "vatRate" DECIMAL NOT NULL DEFAULT 22.00,
    "totalPrice" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL DEFAULT '',
    "partySize" INTEGER NOT NULL,
    "quotedWaitMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualWaitMinutes" INTEGER NOT NULL DEFAULT 0,
    "preferredArea" TEXT NOT NULL DEFAULT '',
    "specialNeeds" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,
    "seatedAt" DATETIME,
    "leftAt" DATETIME,
    "tableId" TEXT,
    "reservationId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaitlistEntry_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "WaitlistEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE SET NULL,
    CONSTRAINT "WaitlistEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "courseNumber" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" DATETIME,
    "readyAt" DATETIME,
    "servedAt" DATETIME,
    "pacingNote" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HappyHourSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceGroupId" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "appliesToIds" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoActivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HappyHourSchedule_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "responseBody" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" DATETIME,
    "signature" TEXT NOT NULL DEFAULT '',
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "apiSecret" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 300,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT NOT NULL DEFAULT '',
    "lastSyncError" TEXT NOT NULL DEFAULT '',
    "events" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "requestData" TEXT NOT NULL DEFAULT '{}',
    "responseData" TEXT NOT NULL DEFAULT '{}',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "businessId" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "monthlyPrice" DECIMAL NOT NULL DEFAULT 0,
    "locationCount" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "trialStartsAt" DATETIME,
    "trialEndsAt" DATETIME,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelledAt" DATETIME,
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "stripeCustomerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "vatRate" DECIMAL NOT NULL DEFAULT 22,
    "vatAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdfUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuestFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "overallRating" INTEGER NOT NULL DEFAULT 0,
    "foodRating" INTEGER NOT NULL DEFAULT 0,
    "serviceRating" INTEGER NOT NULL DEFAULT 0,
    "atmosphereRating" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "wouldReturn" BOOLEAN NOT NULL DEFAULT true,
    "wouldRecommend" BOOLEAN NOT NULL DEFAULT true,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "response" TEXT NOT NULL DEFAULT '',
    "respondedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'pos',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ZReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportDate" DATETIME NOT NULL,
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "totalSales" DECIMAL NOT NULL DEFAULT 0,
    "totalNetSales" DECIMAL NOT NULL DEFAULT 0,
    "totalTax" DECIMAL NOT NULL DEFAULT 0,
    "cashSales" DECIMAL NOT NULL DEFAULT 0,
    "cardSales" DECIMAL NOT NULL DEFAULT 0,
    "mobileSales" DECIMAL NOT NULL DEFAULT 0,
    "alternateSales" DECIMAL NOT NULL DEFAULT 0,
    "dineInSales" DECIMAL NOT NULL DEFAULT 0,
    "takeoutSales" DECIMAL NOT NULL DEFAULT 0,
    "deliverySales" DECIMAL NOT NULL DEFAULT 0,
    "vatStandard" DECIMAL NOT NULL DEFAULT 0,
    "vatStandardAmount" DECIMAL NOT NULL DEFAULT 0,
    "vatReduced" DECIMAL NOT NULL DEFAULT 0,
    "vatReducedAmount" DECIMAL NOT NULL DEFAULT 0,
    "vatZero" DECIMAL NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalGuests" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL NOT NULL DEFAULT 0,
    "totalDiscounts" DECIMAL NOT NULL DEFAULT 0,
    "totalTips" DECIMAL NOT NULL DEFAULT 0,
    "totalVoided" DECIMAL NOT NULL DEFAULT 0,
    "totalStorno" DECIMAL NOT NULL DEFAULT 0,
    "startingCash" DECIMAL NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL NOT NULL DEFAULT 0,
    "actualCash" DECIMAL NOT NULL DEFAULT 0,
    "cashDifference" DECIMAL NOT NULL DEFAULT 0,
    "cashDrops" DECIMAL NOT NULL DEFAULT 0,
    "totalCost" DECIMAL NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalizedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ZReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "TipPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "shiftId" TEXT,
    "totalTips" DECIMAL NOT NULL DEFAULT 0,
    "cashTips" DECIMAL NOT NULL DEFAULT 0,
    "cardTips" DECIMAL NOT NULL DEFAULT 0,
    "distributionMethod" TEXT NOT NULL DEFAULT 'equal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TipPool_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "TipDistribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipPoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "hoursWorked" DECIMAL NOT NULL DEFAULT 0,
    "points" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TipDistribution_tipPoolId_fkey" FOREIGN KEY ("tipPoolId") REFERENCES "TipPool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryTracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryInfoId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL DEFAULT '',
    "driverPhone" TEXT NOT NULL DEFAULT '',
    "vehicleInfo" TEXT NOT NULL DEFAULT '',
    "currentLat" REAL,
    "currentLng" REAL,
    "lastUpdateAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "estimatedArrival" DATETIME,
    "assignedAt" DATETIME,
    "pickedUpAt" DATETIME,
    "onTheWayAt" DATETIME,
    "deliveredAt" DATETIME,
    "customerRating" INTEGER,
    "customerFeedback" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryTracking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE SET NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" INTEGER NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "absoluteExpiry" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "Menu_locationId_idx" ON "Menu"("locationId");

-- CreateIndex
CREATE INDEX "Category_menuId_idx" ON "Category"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_menuId_key" ON "Category"("name", "menuId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_salesCategoryId_idx" ON "MenuItem"("salesCategoryId");

-- CreateIndex
CREATE INDEX "MenuItem_priceGroupId_idx" ON "MenuItem"("priceGroupId");

-- CreateIndex
CREATE INDEX "MenuItem_revenueCenterId_idx" ON "MenuItem"("revenueCenterId");

-- CreateIndex
CREATE INDEX "MenuItem_prepStationId_idx" ON "MenuItem"("prepStationId");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_isAvailable_idx" ON "MenuItem"("categoryId", "isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_sortOrder_idx" ON "MenuItem"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "Modifier_modifierGroupId_idx" ON "Modifier"("modifierGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemModifierGroup_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("menuItemId", "modifierGroupId");

-- CreateIndex
CREATE INDEX "TaxRate_isActive_idx" ON "TaxRate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_code_key" ON "TaxRate"("code");

-- CreateIndex
CREATE INDEX "DiningOption_isActive_idx" ON "DiningOption"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiningOption_type_key" ON "DiningOption"("type");

-- CreateIndex
CREATE INDEX "Table_revenueCenterId_idx" ON "Table"("revenueCenterId");

-- CreateIndex
CREATE INDEX "Table_status_idx" ON "Table"("status");

-- CreateIndex
CREATE INDEX "Table_locationId_idx" ON "Table"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_number_locationId_key" ON "Table"("number", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_deliveryInfoId_key" ON "Order"("deliveryInfoId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId");

-- CreateIndex
CREATE INDEX "Order_employeeId_idx" ON "Order"("employeeId");

-- CreateIndex
CREATE INDEX "Order_status_paymentStatus_idx" ON "Order"("status", "paymentStatus");

-- CreateIndex
CREATE INDEX "Order_paidAt_paymentStatus_idx" ON "Order"("paidAt", "paymentStatus");

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");

-- CreateIndex
CREATE INDEX "OrderItem_checkId_idx" ON "OrderItem"("checkId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItem_voided_idx" ON "OrderItem"("voided");

-- CreateIndex
CREATE INDEX "OrderItem_courseId_idx" ON "OrderItem"("courseId");

-- CreateIndex
CREATE INDEX "Check_orderId_idx" ON "Check"("orderId");

-- CreateIndex
CREATE INDEX "Check_paymentStatus_idx" ON "Check"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Check_orderId_checkNumber_key" ON "Check"("orderId", "checkNumber");

-- CreateIndex
CREATE INDEX "Payment_checkId_idx" ON "Payment"("checkId");

-- CreateIndex
CREATE INDEX "Payment_type_idx" ON "Payment"("type");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_employeeId_idx" ON "Payment"("employeeId");

-- CreateIndex
CREATE INDEX "Discount_promoCode_idx" ON "Discount"("promoCode");

-- CreateIndex
CREATE INDEX "Discount_isActive_idx" ON "Discount"("isActive");

-- CreateIndex
CREATE INDEX "Discount_triggerType_idx" ON "Discount"("triggerType");

-- CreateIndex
CREATE INDEX "DeliveryInfo_status_idx" ON "DeliveryInfo"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "Employee"("role");

-- CreateIndex
CREATE INDEX "Employee_pin_idx" ON "Employee"("pin");

-- CreateIndex
CREATE INDEX "Employee_locationId_idx" ON "Employee"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_name_key" ON "Job"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeJob_employeeId_jobId_key" ON "EmployeeJob"("employeeId", "jobId");

-- CreateIndex
CREATE INDEX "Shift_employeeId_idx" ON "Shift"("employeeId");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

-- CreateIndex
CREATE INDEX "Shift_employeeId_date_idx" ON "Shift"("employeeId", "date");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");

-- CreateIndex
CREATE INDEX "TimeEntry_clockIn_idx" ON "TimeEntry"("clockIn");

-- CreateIndex
CREATE INDEX "TimeEntry_type_idx" ON "TimeEntry"("type");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "CashRegisterShift_status_idx" ON "CashRegisterShift"("status");

-- CreateIndex
CREATE INDEX "CashRegisterShift_employeeId_idx" ON "CashRegisterShift"("employeeId");

-- CreateIndex
CREATE INDEX "CashRegisterShift_openedAt_idx" ON "CashRegisterShift"("openedAt");

-- CreateIndex
CREATE INDEX "CashRegisterShift_locationId_idx" ON "CashRegisterShift"("locationId");

-- CreateIndex
CREATE INDEX "CashRegisterShift_closedAt_idx" ON "CashRegisterShift"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_menuItemId_key" ON "InventoryItem"("menuItemId");

-- CreateIndex
CREATE INDEX "InventoryItem_expiryDate_idx" ON "InventoryItem"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_locationId_idx" ON "InventoryItem"("locationId");

-- CreateIndex
CREATE INDEX "InventoryItem_supplier_idx" ON "InventoryItem"("supplier");

-- CreateIndex
CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");

-- CreateIndex
CREATE INDEX "InventoryItem_quantity_idx" ON "InventoryItem"("quantity");

-- CreateIndex
CREATE INDEX "StockTransaction_inventoryItemId_idx" ON "StockTransaction"("inventoryItemId");

-- CreateIndex
CREATE INDEX "StockTransaction_type_idx" ON "StockTransaction"("type");

-- CreateIndex
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "StockTransaction_inventoryItemId_type_idx" ON "StockTransaction"("inventoryItemId", "type");

-- CreateIndex
CREATE INDEX "StockTransaction_orderId_idx" ON "StockTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_menuItemId_inventoryItemId_key" ON "RecipeItem"("menuItemId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_orderId_idx" ON "Receipt"("orderId");

-- CreateIndex
CREATE INDEX "Receipt_fiscalVerified_idx" ON "Receipt"("fiscalVerified");

-- CreateIndex
CREATE INDEX "Receipt_createdAt_idx" ON "Receipt"("createdAt");

-- CreateIndex
CREATE INDEX "Receipt_orderId_isStorno_idx" ON "Receipt"("orderId", "isStorno");

-- CreateIndex
CREATE INDEX "Receipt_fiscalStatus_idx" ON "Receipt"("fiscalStatus");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_customerPhone_idx" ON "LoyaltyAccount"("customerPhone");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_customerEmail_idx" ON "LoyaltyAccount"("customerEmail");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyAccountId_idx" ON "LoyaltyTransaction"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_checkId_idx" ON "LoyaltyTransaction"("checkId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_cardNumber_key" ON "GiftCard"("cardNumber");

-- CreateIndex
CREATE INDEX "GiftCard_expiresAt_idx" ON "GiftCard"("expiresAt");

-- CreateIndex
CREATE INDEX "GiftCard_status_idx" ON "GiftCard"("status");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCardId_idx" ON "GiftCardTransaction"("giftCardId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_orderId_idx" ON "GiftCardTransaction"("orderId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_checkId_idx" ON "GiftCardTransaction"("checkId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_code_idx" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "DeliveryZone_locationId_idx" ON "DeliveryZone"("locationId");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_idx" ON "DeliveryZone"("isActive");

-- CreateIndex
CREATE INDEX "OpeningHours_locationId_idx" ON "OpeningHours"("locationId");

-- CreateIndex
CREATE INDEX "OpeningHours_dayOfWeek_idx" ON "OpeningHours"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHours_locationId_dayOfWeek_key" ON "OpeningHours"("locationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "HaccpEntry_category_idx" ON "HaccpEntry"("category");

-- CreateIndex
CREATE INDEX "HaccpEntry_date_idx" ON "HaccpEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_name_key" ON "Counter"("name");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "StaffShift_employeeId_idx" ON "StaffShift"("employeeId");

-- CreateIndex
CREATE INDEX "StaffShift_shiftDate_idx" ON "StaffShift"("shiftDate");

-- CreateIndex
CREATE INDEX "StaffShift_locationId_idx" ON "StaffShift"("locationId");

-- CreateIndex
CREATE INDEX "StaffShift_status_idx" ON "StaffShift"("status");

-- CreateIndex
CREATE INDEX "StaffShift_shiftType_idx" ON "StaffShift"("shiftType");

-- CreateIndex
CREATE INDEX "StaffShift_employeeId_shiftDate_idx" ON "StaffShift"("employeeId", "shiftDate");

-- CreateIndex
CREATE INDEX "Reservation_dateTime_idx" ON "Reservation"("dateTime");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_tableId_idx" ON "Reservation"("tableId");

-- CreateIndex
CREATE INDEX "Reservation_tableId_status_idx" ON "Reservation"("tableId", "status");

-- CreateIndex
CREATE INDEX "Reservation_locationId_idx" ON "Reservation"("locationId");

-- CreateIndex
CREATE INDEX "Reservation_employeeId_idx" ON "Reservation"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_loyaltyAccountId_key" ON "Guest"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "Guest_lastName_idx" ON "Guest"("lastName");

-- CreateIndex
CREATE INDEX "Guest_firstName_idx" ON "Guest"("firstName");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE INDEX "Guest_email_idx" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Guest_isVip_idx" ON "Guest"("isVip");

-- CreateIndex
CREATE INDEX "Guest_lastVisitAt_idx" ON "Guest"("lastVisitAt");

-- CreateIndex
CREATE INDEX "GuestVisit_guestId_idx" ON "GuestVisit"("guestId");

-- CreateIndex
CREATE INDEX "GuestVisit_arrivedAt_idx" ON "GuestVisit"("arrivedAt");

-- CreateIndex
CREATE INDEX "GuestVisit_employeeId_idx" ON "GuestVisit"("employeeId");

-- CreateIndex
CREATE INDEX "GuestVisit_guestId_arrivedAt_idx" ON "GuestVisit"("guestId", "arrivedAt");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_inventoryItemId_idx" ON "PurchaseOrderItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_status_idx" ON "PurchaseOrderItem"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_partySize_idx" ON "WaitlistEntry"("partySize");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_checkedInAt_idx" ON "WaitlistEntry"("checkedInAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_employeeId_idx" ON "WaitlistEntry"("employeeId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_tableId_idx" ON "WaitlistEntry"("tableId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_reservationId_idx" ON "WaitlistEntry"("reservationId");

-- CreateIndex
CREATE INDEX "Course_orderId_idx" ON "Course"("orderId");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "AIConversation_type_idx" ON "AIConversation"("type");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_employeeId_idx" ON "AIConversation"("employeeId");

-- CreateIndex
CREATE INDEX "HappyHourSchedule_isActive_idx" ON "HappyHourSchedule"("isActive");

-- CreateIndex
CREATE INDEX "HappyHourSchedule_priceGroupId_idx" ON "HappyHourSchedule"("priceGroupId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_event_idx" ON "WebhookDelivery"("event");

-- CreateIndex
CREATE INDEX "WebhookDelivery_success_idx" ON "WebhookDelivery"("success");

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_nextRetryAt_idx" ON "WebhookDelivery"("nextRetryAt");

-- CreateIndex
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

-- CreateIndex
CREATE INDEX "Integration_provider_idx" ON "Integration"("provider");

-- CreateIndex
CREATE INDEX "Integration_isActive_idx" ON "Integration"("isActive");

-- CreateIndex
CREATE INDEX "Integration_connectionStatus_idx" ON "Integration"("connectionStatus");

-- CreateIndex
CREATE INDEX "IntegrationLog_integrationId_idx" ON "IntegrationLog"("integrationId");

-- CreateIndex
CREATE INDEX "IntegrationLog_action_idx" ON "IntegrationLog"("action");

-- CreateIndex
CREATE INDEX "IntegrationLog_status_idx" ON "IntegrationLog"("status");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_email_key" ON "Subscription"("email");

-- CreateIndex
CREATE INDEX "Subscription_email_idx" ON "Subscription"("email");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_plan_idx" ON "Subscription"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON "SubscriptionInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_dueDate_idx" ON "SubscriptionInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "GuestFeedback_guestId_idx" ON "GuestFeedback"("guestId");

-- CreateIndex
CREATE INDEX "GuestFeedback_orderId_idx" ON "GuestFeedback"("orderId");

-- CreateIndex
CREATE INDEX "GuestFeedback_overallRating_idx" ON "GuestFeedback"("overallRating");

-- CreateIndex
CREATE INDEX "GuestFeedback_source_idx" ON "GuestFeedback"("source");

-- CreateIndex
CREATE INDEX "GuestFeedback_createdAt_idx" ON "GuestFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "ZReport_reportDate_idx" ON "ZReport"("reportDate");

-- CreateIndex
CREATE INDEX "ZReport_status_idx" ON "ZReport"("status");

-- CreateIndex
CREATE INDEX "ZReport_locationId_idx" ON "ZReport"("locationId");

-- CreateIndex
CREATE INDEX "ZReport_closedAt_idx" ON "ZReport"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ZReport_reportDate_locationId_key" ON "ZReport"("reportDate", "locationId");

-- CreateIndex
CREATE INDEX "TipPool_date_idx" ON "TipPool"("date");

-- CreateIndex
CREATE INDEX "TipPool_status_idx" ON "TipPool"("status");

-- CreateIndex
CREATE INDEX "TipPool_locationId_idx" ON "TipPool"("locationId");

-- CreateIndex
CREATE INDEX "TipDistribution_tipPoolId_idx" ON "TipDistribution"("tipPoolId");

-- CreateIndex
CREATE INDEX "TipDistribution_employeeId_idx" ON "TipDistribution"("employeeId");

-- CreateIndex
CREATE INDEX "TipDistribution_status_idx" ON "TipDistribution"("status");

-- CreateIndex
CREATE INDEX "TipDistribution_paidAt_idx" ON "TipDistribution"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTracking_deliveryInfoId_key" ON "DeliveryTracking"("deliveryInfoId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_deliveryInfoId_idx" ON "DeliveryTracking"("deliveryInfoId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_status_idx" ON "DeliveryTracking"("status");

-- CreateIndex
CREATE INDEX "DeliveryTracking_driverName_idx" ON "DeliveryTracking"("driverName");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_employeeId_idx" ON "Session"("employeeId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
