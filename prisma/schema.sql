-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📋',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🍽️',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "menuId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(65,30) NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 22.00,
    "allergens" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "salesCategoryId" TEXT,
    "priceGroupId" TEXT,
    "revenueCenterId" TEXT,
    "prepStationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealtimeRule" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "daysOfWeek" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "timeFrom" TEXT NOT NULL DEFAULT '',
    "timeTo" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealtimeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT NOT NULL DEFAULT '',
    "modifierGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serviceChargeId" TEXT,
    "prepTimeMinutes" INTEGER NOT NULL DEFAULT 15,
    "taxRateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCharge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "isAutoApply" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'kitchen',
    "avgPrepTime" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternatePaymentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'voucher',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlternatePaymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoidReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoidReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoSaleReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoSaleReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'thermal',
    "location" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "printRules" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "packagingConfigId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "area" TEXT NOT NULL DEFAULT 'main',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "shape" TEXT NOT NULL DEFAULT 'round',
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueCenterId" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "diningOptionId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'dine-in',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "tableId" TEXT,
    "revenueCenterId" TEXT,
    "guestId" TEXT,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "splitCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "firedAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT NOT NULL DEFAULT '',
    "cancelledById" TEXT,
    "inventoryDeducted" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "deliveryInfoId" TEXT,
    "virtualBrandId" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "checkId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(65,30) NOT NULL,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 22.00,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "modifiersJson" TEXT NOT NULL DEFAULT '[]',
    "menuItemName" TEXT NOT NULL DEFAULT '',
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidReasonId" TEXT,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "appliedDiscountId" TEXT,
    "courseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL,
    "checkNumber" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "serviceCharge" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "appliedDiscountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
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
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'check',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "promoCode" TEXT NOT NULL DEFAULT '',
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryInfo" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "recipientPhone" TEXT NOT NULL DEFAULT '',
    "deliveryInstructions" TEXT NOT NULL DEFAULT '',
    "promisedTime" TIMESTAMP(3),
    "estimatedTime" TIMESTAMP(3),
    "actualTime" TIMESTAMP(3),
    "courierName" TEXT NOT NULL DEFAULT '',
    "courierPhone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "packagingFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pin" TEXT NOT NULL DEFAULT '',
    "pinLookup" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "basePayRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "overtimeRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeJob" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "payRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobId" TEXT,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "breakStart" TIMESTAMP(3),
    "breakEnd" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "payRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'regular',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegisterShift" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "startingCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mobileSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "alternateSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "splitPayments" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalDiscounts" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalVoided" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashDifference" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegisterShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "costPerUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "location" TEXT NOT NULL DEFAULT 'main',
    "expiryDate" TIMESTAMP(3),
    "servingsPerUnit" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "servingSize" TEXT NOT NULL DEFAULT '',
    "costPerServing" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "menuItemId" TEXT,
    "lastRestocked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "previousQty" DECIMAL(65,30) NOT NULL,
    "newQty" DECIMAL(65,30) NOT NULL,
    "costPerUnit" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "supplierDoc" TEXT NOT NULL DEFAULT '',
    "employeeName" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityPerServing" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "parentRecipeItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
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
    "verificationDate" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatBreakdown" TEXT NOT NULL DEFAULT '{}',
    "totalVat" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "tip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithTip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL,
    "isCopy" BOOLEAN NOT NULL DEFAULT false,
    "isStorno" BOOLEAN NOT NULL DEFAULT false,
    "stornoOf" TEXT NOT NULL DEFAULT '',
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "checkId" TEXT,
    "monetaryValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "orderId" TEXT,
    "checkId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL,
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
    "defaultVatRate" DECIMAL(65,30) NOT NULL DEFAULT 22.00,
    "reducedVatRate" DECIMAL(65,30) NOT NULL DEFAULT 9.50,
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPointsPerEuro" INTEGER NOT NULL DEFAULT 1,
    "loyaltyPointsValue" DECIMAL(65,30) NOT NULL DEFAULT 0.01,
    "receiptFooter" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'sl-SI',
    "country" TEXT NOT NULL DEFAULT 'SI',
    "apiKeys" TEXT NOT NULL DEFAULT '[]',
    "autoGratuityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoGratuityPercent" DECIMAL(65,30) NOT NULL DEFAULT 10.00,
    "autoGratuityThreshold" INTEGER NOT NULL DEFAULT 6,
    "allergenFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailSmtpHost" TEXT NOT NULL DEFAULT '',
    "emailSmtpPort" INTEGER NOT NULL DEFAULT 587,
    "emailSmtpUser" TEXT NOT NULL DEFAULT '',
    "emailSmtpPassword" TEXT NOT NULL DEFAULT '',
    "emailFromAddress" TEXT NOT NULL DEFAULT '',
    "emailReportRecipients" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'restaurant',
    "subscriptionId" TEXT,
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
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyPointsPerEuro" INTEGER NOT NULL DEFAULT 1,
    "loyaltyPointsValue" DECIMAL(65,30) NOT NULL DEFAULT 0.01,
    "emailReportRecipients" TEXT NOT NULL DEFAULT '[]',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postCodes" TEXT NOT NULL DEFAULT '[]',
    "cities" TEXT NOT NULL DEFAULT '[]',
    "radiusKm" DOUBLE PRECISION,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 2.50,
    "minOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 10.00,
    "freeDeliveryAbove" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL DEFAULT '08:00',
    "closeTime" TEXT NOT NULL DEFAULT '22:00',
    "breakStart" TEXT NOT NULL DEFAULT '',
    "breakEnd" TEXT NOT NULL DEFAULT '',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaccpEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ok',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "employeeName" TEXT NOT NULL DEFAULT '',
    "previousHash" TEXT NOT NULL DEFAULT '',
    "chainHash" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaccpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT NOT NULL DEFAULT '',
    "lastTriggered" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "terminalId" TEXT,
    "previousHash" TEXT NOT NULL DEFAULT '',
    "chainHash" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftType" TEXT NOT NULL DEFAULT 'morning',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "locationId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'server',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "confirmedAt" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAvailability" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'vacation',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "dateTime" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 120,
    "tableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "notes" TEXT NOT NULL DEFAULT '',
    "specialRequests" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'walk_in',
    "employeeId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "actualArrival" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "vipSince" TIMESTAMP(3),
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "dietaryPrefs" TEXT NOT NULL DEFAULT '[]',
    "dislikes" TEXT NOT NULL DEFAULT '[]',
    "favoriteItems" TEXT NOT NULL DEFAULT '[]',
    "birthday" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "company" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avgCheckAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMP(3),
    "firstVisitAt" TIMESTAMP(3),
    "loyaltyAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestVisit" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "orderId" TEXT,
    "tableId" TEXT,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "totalSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feedbackScore" INTEGER,
    "feedbackComment" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "previousHash" TEXT NOT NULL DEFAULT '',
    "chainHash" TEXT NOT NULL DEFAULT '',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
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
    "minOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rating" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryAddress" TEXT NOT NULL DEFAULT '',
    "deliveryNotes" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT NOT NULL DEFAULT '',
    "requestedById" TEXT,
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "approvedById" TEXT,
    "locationId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "accountsPayableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantityOrdered" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quantityReceived" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 22.00,
    "totalPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReorderRule" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'min_qty',
    "triggerThreshold" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "orderQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "orderUnit" TEXT NOT NULL DEFAULT 'pcs',
    "preferredSupplierId" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL DEFAULT '',
    "partySize" INTEGER NOT NULL,
    "quotedWaitMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualWaitMinutes" INTEGER NOT NULL DEFAULT 0,
    "preferredArea" TEXT NOT NULL DEFAULT '',
    "specialNeeds" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "seatedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "tableId" TEXT,
    "reservationId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courseNumber" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "pacingNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHourSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceGroupId" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "appliesToIds" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoActivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HappyHourSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "responseBody" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "signature" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "apiSecret" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncInterval" INTEGER NOT NULL DEFAULT 300,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT '',
    "lastSyncError" TEXT NOT NULL DEFAULT '',
    "events" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "requestData" TEXT NOT NULL DEFAULT '{}',
    "responseData" TEXT NOT NULL DEFAULT '{}',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "businessId" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'trial',
    "monthlyPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "locationCount" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "trialStartsAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 22,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdfUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestFeedback" (
    "id" TEXT NOT NULL,
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
    "respondedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'pos',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZReport" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "totalSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalNetSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mobileSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "alternateSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dineInSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "takeoutSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliverySales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatStandard" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatStandardAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatReduced" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatReducedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatZero" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalGuests" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDiscounts" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalVoided" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalStorno" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "startingCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actualCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashDifference" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashDrops" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalizedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipPool" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT,
    "totalTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cardTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "distributionMethod" TEXT NOT NULL DEFAULT 'equal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipDistribution" (
    "id" TEXT NOT NULL,
    "tipPoolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "previousHash" TEXT NOT NULL DEFAULT '',
    "chainHash" TEXT NOT NULL DEFAULT '',
    "hoursWorked" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "points" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTracking" (
    "id" TEXT NOT NULL,
    "deliveryInfoId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL DEFAULT '',
    "driverPhone" TEXT NOT NULL DEFAULT '',
    "vehicleInfo" TEXT NOT NULL DEFAULT '',
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastUpdateAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "estimatedArrival" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "onTheWayAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "customerRating" INTEGER,
    "customerFeedback" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiry" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricCredential" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT NOT NULL DEFAULT '[]',
    "deviceType" TEXT NOT NULL DEFAULT '',
    "backed" BOOLEAN NOT NULL DEFAULT false,
    "nickname" TEXT NOT NULL DEFAULT '',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT NOT NULL DEFAULT '',
    "referenceType" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'posted',
    "postedAt" TIMESTAMP(3),
    "postedBy" TEXT,
    "postedById" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "chartOfAccountCode" TEXT,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayable" (
    "id" TEXT NOT NULL,
    "apNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "paidAt" TIMESTAMP(3),
    "locationId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsReceivable" (
    "id" TEXT NOT NULL,
    "arNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "guestId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerTaxId" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "invoiceNumber" TEXT NOT NULL DEFAULT '',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "paidAt" TIMESTAMP(3),
    "locationId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledEmailLog" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "attachmentName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "reportDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotDocument" (
    "id" TEXT NOT NULL,
    "kotNumber" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'original',
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "orderNotes" TEXT NOT NULL DEFAULT '',
    "tableNumber" INTEGER,
    "orderType" TEXT NOT NULL DEFAULT 'dine-in',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "firedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "previousKotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KotDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "ownMenu" BOOLEAN NOT NULL DEFAULT true,
    "ownPricing" BOOLEAN NOT NULL DEFAULT true,
    "orderPrefix" TEXT NOT NULL DEFAULT '',
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarbonFactor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ingredient',
    "co2ePerKg" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "source" TEXT NOT NULL DEFAULT 'Agribalyse',
    "waterUsage" DECIMAL(65,30),
    "landUse" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarbonFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SustainabilityReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCo2e" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWater" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalLand" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "co2ePerOrder" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "co2ePerEuro" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "foodWasteKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "packagingWasteKg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SustainabilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "target" TEXT NOT NULL,
    "targetEndpoint" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL,
    "nextRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "conflictStatus" TEXT NOT NULL DEFAULT 'none',
    "conflictData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRegistry" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'pos',
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeenAt" TIMESTAMP(3),
    "appVersion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletPayment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkId" TEXT,
    "walletType" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL DEFAULT '',
    "merchantId" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentToken" TEXT NOT NULL DEFAULT '',
    "tokenType" TEXT NOT NULL DEFAULT '',
    "cardBrand" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "capturedAt" TIMESTAMP(3),
    "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksSync" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL DEFAULT '',
    "refreshToken" TEXT NOT NULL DEFAULT '',
    "realmId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL DEFAULT '',
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'never',
    "lastSyncError" TEXT NOT NULL DEFAULT '',
    "lastCustomerSync" TIMESTAMP(3),
    "lastPaymentSync" TIMESTAMP(3),
    "lastInvoiceSync" TIMESTAMP(3),
    "lastJournalSync" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickBooksSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksSyncLog" (
    "id" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "qbEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "action" TEXT NOT NULL DEFAULT 'create',
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickBooksSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnalyticsSession" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "cameraName" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "peopleIn" INTEGER NOT NULL DEFAULT 0,
    "peopleOut" INTEGER NOT NULL DEFAULT 0,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "peakOccupancy" INTEGER NOT NULL DEFAULT 0,
    "heatmapData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainAuditEntry" (
    "id" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL DEFAULT '',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minerId" TEXT,

    CONSTRAINT "BlockchainAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Menu_locationId_idx" ON "Menu"("locationId");

-- CreateIndex
CREATE INDEX "Menu_isActive_idx" ON "Menu"("isActive");

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
CREATE INDEX "MealtimeRule_menuItemId_idx" ON "MealtimeRule"("menuItemId");

-- CreateIndex
CREATE INDEX "MealtimeRule_isActive_idx" ON "MealtimeRule"("isActive");

-- CreateIndex
CREATE INDEX "Modifier_modifierGroupId_idx" ON "Modifier"("modifierGroupId");

-- CreateIndex
CREATE INDEX "Modifier_isAvailable_idx" ON "Modifier"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItemModifierGroup_modifierGroupId_idx" ON "MenuItemModifierGroup"("modifierGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemModifierGroup_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("menuItemId", "modifierGroupId");

-- CreateIndex
CREATE INDEX "TaxRate_isActive_idx" ON "TaxRate"("isActive");

-- CreateIndex
CREATE INDEX "TaxRate_locationId_idx" ON "TaxRate"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_code_key" ON "TaxRate"("code");

-- CreateIndex
CREATE INDEX "DiningOption_isActive_idx" ON "DiningOption"("isActive");

-- CreateIndex
CREATE INDEX "DiningOption_serviceChargeId_idx" ON "DiningOption"("serviceChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningOption_type_key" ON "DiningOption"("type");

-- CreateIndex
CREATE INDEX "RevenueCenter_isActive_idx" ON "RevenueCenter"("isActive");

-- CreateIndex
CREATE INDEX "ServiceCharge_isActive_idx" ON "ServiceCharge"("isActive");

-- CreateIndex
CREATE INDEX "SalesCategory_isActive_idx" ON "SalesCategory"("isActive");

-- CreateIndex
CREATE INDEX "PriceGroup_isActive_idx" ON "PriceGroup"("isActive");

-- CreateIndex
CREATE INDEX "PrepStation_isActive_idx" ON "PrepStation"("isActive");

-- CreateIndex
CREATE INDEX "PrepStation_type_idx" ON "PrepStation"("type");

-- CreateIndex
CREATE INDEX "AlternatePaymentType_isActive_idx" ON "AlternatePaymentType"("isActive");

-- CreateIndex
CREATE INDEX "AlternatePaymentType_type_idx" ON "AlternatePaymentType"("type");

-- CreateIndex
CREATE INDEX "VoidReason_isActive_idx" ON "VoidReason"("isActive");

-- CreateIndex
CREATE INDEX "NoSaleReason_isActive_idx" ON "NoSaleReason"("isActive");

-- CreateIndex
CREATE INDEX "Printer_isActive_idx" ON "Printer"("isActive");

-- CreateIndex
CREATE INDEX "Printer_type_idx" ON "Printer"("type");

-- CreateIndex
CREATE INDEX "PackagingConfig_isActive_idx" ON "PackagingConfig"("isActive");

-- CreateIndex
CREATE INDEX "PackagingItem_packagingConfigId_idx" ON "PackagingItem"("packagingConfigId");

-- CreateIndex
CREATE INDEX "PackagingItem_isActive_idx" ON "PackagingItem"("isActive");

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
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

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
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_status_idx" ON "Order"("createdAt", "status");

-- CreateIndex
CREATE INDEX "Order_diningOptionId_idx" ON "Order"("diningOptionId");

-- CreateIndex
CREATE INDEX "Order_revenueCenterId_idx" ON "Order"("revenueCenterId");

-- CreateIndex
CREATE INDEX "Order_guestId_idx" ON "Order"("guestId");

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
CREATE INDEX "OrderItem_orderId_voided_idx" ON "OrderItem"("orderId", "voided");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_status_idx" ON "OrderItem"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_voidReasonId_idx" ON "OrderItem"("voidReasonId");

-- CreateIndex
CREATE INDEX "OrderItem_appliedDiscountId_idx" ON "OrderItem"("appliedDiscountId");

-- CreateIndex
CREATE INDEX "Check_orderId_idx" ON "Check"("orderId");

-- CreateIndex
CREATE INDEX "Check_paymentStatus_idx" ON "Check"("paymentStatus");

-- CreateIndex
CREATE INDEX "Check_paymentStatus_orderId_idx" ON "Check"("paymentStatus", "orderId");

-- CreateIndex
CREATE INDEX "Check_appliedDiscountId_idx" ON "Check"("appliedDiscountId");

-- CreateIndex
CREATE UNIQUE INDEX "Check_orderId_checkNumber_key" ON "Check"("orderId", "checkNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

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
CREATE INDEX "Payment_alternatePaymentTypeId_idx" ON "Payment"("alternatePaymentTypeId");

-- CreateIndex
CREATE INDEX "Payment_giftCardId_idx" ON "Payment"("giftCardId");

-- CreateIndex
CREATE INDEX "Payment_loyaltyAccountId_idx" ON "Payment"("loyaltyAccountId");

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
CREATE UNIQUE INDEX "Employee_pin_key" ON "Employee"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_pinLookup_key" ON "Employee"("pinLookup");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "Employee"("role");

-- CreateIndex
CREATE INDEX "Employee_pin_idx" ON "Employee"("pin");

-- CreateIndex
CREATE INDEX "Employee_locationId_idx" ON "Employee"("locationId");

-- CreateIndex
CREATE INDEX "Job_isActive_idx" ON "Job"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Job_name_key" ON "Job"("name");

-- CreateIndex
CREATE INDEX "EmployeeJob_jobId_idx" ON "EmployeeJob"("jobId");

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
CREATE INDEX "Shift_jobId_idx" ON "Shift"("jobId");

-- CreateIndex
CREATE INDEX "Shift_locationId_idx" ON "Shift"("locationId");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");

-- CreateIndex
CREATE INDEX "TimeEntry_clockIn_idx" ON "TimeEntry"("clockIn");

-- CreateIndex
CREATE INDEX "TimeEntry_type_idx" ON "TimeEntry"("type");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_jobId_idx" ON "TimeEntry"("jobId");

-- CreateIndex
CREATE INDEX "TimeEntry_locationId_idx" ON "TimeEntry"("locationId");

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
CREATE INDEX "RecipeItem_inventoryItemId_idx" ON "RecipeItem"("inventoryItemId");

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
CREATE INDEX "Receipt_locationId_idx" ON "Receipt"("locationId");

-- CreateIndex
CREATE INDEX "Receipt_orderId_isStorno_idx" ON "Receipt"("orderId", "isStorno");

-- CreateIndex
CREATE INDEX "Receipt_fiscalStatus_idx" ON "Receipt"("fiscalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customerPhone_key" ON "LoyaltyAccount"("customerPhone");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_customerPhone_idx" ON "LoyaltyAccount"("customerPhone");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_customerEmail_idx" ON "LoyaltyAccount"("customerEmail");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_isActive_idx" ON "LoyaltyAccount"("isActive");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_tier_idx" ON "LoyaltyAccount"("tier");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_locationId_idx" ON "LoyaltyAccount"("locationId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyAccountId_idx" ON "LoyaltyTransaction"("loyaltyAccountId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_checkId_idx" ON "LoyaltyTransaction"("checkId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyAccountId_createdAt_idx" ON "LoyaltyTransaction"("loyaltyAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_cardNumber_key" ON "GiftCard"("cardNumber");

-- CreateIndex
CREATE INDEX "GiftCard_expiresAt_idx" ON "GiftCard"("expiresAt");

-- CreateIndex
CREATE INDEX "GiftCard_status_idx" ON "GiftCard"("status");

-- CreateIndex
CREATE INDEX "GiftCard_locationId_idx" ON "GiftCard"("locationId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCardId_idx" ON "GiftCardTransaction"("giftCardId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_orderId_idx" ON "GiftCardTransaction"("orderId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_checkId_idx" ON "GiftCardTransaction"("checkId");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_type_idx" ON "GiftCardTransaction"("type");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_createdAt_idx" ON "GiftCardTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCardId_createdAt_idx" ON "GiftCardTransaction"("giftCardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_premisesId_key" ON "Location"("premisesId");

-- CreateIndex
CREATE INDEX "Location_code_idx" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "Location_type_idx" ON "Location"("type");

-- CreateIndex
CREATE INDEX "Location_subscriptionId_idx" ON "Location"("subscriptionId");

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
CREATE INDEX "HaccpEntry_status_date_idx" ON "HaccpEntry"("status", "date");

-- CreateIndex
CREATE INDEX "HaccpEntry_locationId_idx" ON "HaccpEntry"("locationId");

-- CreateIndex
CREATE INDEX "Webhook_isActive_idx" ON "Webhook"("isActive");

-- CreateIndex
CREATE INDEX "Webhook_lastTriggered_idx" ON "Webhook"("lastTriggered");

-- CreateIndex
CREATE INDEX "Webhook_locationId_idx" ON "Webhook"("locationId");

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
CREATE INDEX "StaffShift_status_shiftDate_idx" ON "StaffShift"("status", "shiftDate");

-- CreateIndex
CREATE INDEX "StaffShift_shiftDate_locationId_idx" ON "StaffShift"("shiftDate", "locationId");

-- CreateIndex
CREATE INDEX "StaffAvailability_employeeId_idx" ON "StaffAvailability"("employeeId");

-- CreateIndex
CREATE INDEX "StaffAvailability_dayOfWeek_idx" ON "StaffAvailability"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAvailability_employeeId_dayOfWeek_startTime_endTime_key" ON "StaffAvailability"("employeeId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "TimeOffRequest_employeeId_idx" ON "TimeOffRequest"("employeeId");

-- CreateIndex
CREATE INDEX "TimeOffRequest_startDate_endDate_idx" ON "TimeOffRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "TimeOffRequest_status_idx" ON "TimeOffRequest"("status");

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
CREATE INDEX "Reservation_dateTime_status_idx" ON "Reservation"("dateTime", "status");

-- CreateIndex
CREATE INDEX "Reservation_customerPhone_idx" ON "Reservation"("customerPhone");

-- CreateIndex
CREATE INDEX "Reservation_source_idx" ON "Reservation"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_tableId_dateTime_key" ON "Reservation"("tableId", "dateTime");

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
CREATE INDEX "Guest_lastName_firstName_idx" ON "Guest"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "GuestVisit_guestId_idx" ON "GuestVisit"("guestId");

-- CreateIndex
CREATE INDEX "GuestVisit_arrivedAt_idx" ON "GuestVisit"("arrivedAt");

-- CreateIndex
CREATE INDEX "GuestVisit_employeeId_idx" ON "GuestVisit"("employeeId");

-- CreateIndex
CREATE INDEX "GuestVisit_guestId_arrivedAt_idx" ON "GuestVisit"("guestId", "arrivedAt");

-- CreateIndex
CREATE INDEX "GuestVisit_orderId_idx" ON "GuestVisit"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_status_idx" ON "PurchaseOrder"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_locationId_idx" ON "PurchaseOrder"("locationId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_inventoryItemId_idx" ON "PurchaseOrderItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_status_idx" ON "PurchaseOrderItem"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_status_idx" ON "PurchaseOrderItem"("purchaseOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReorderRule_inventoryItemId_key" ON "ReorderRule"("inventoryItemId");

-- CreateIndex
CREATE INDEX "ReorderRule_isActive_idx" ON "ReorderRule"("isActive");

-- CreateIndex
CREATE INDEX "ReorderRule_triggerType_idx" ON "ReorderRule"("triggerType");

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
CREATE INDEX "Course_orderId_status_idx" ON "Course"("orderId", "status");

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
CREATE INDEX "GuestFeedback_locationId_idx" ON "GuestFeedback"("locationId");

-- CreateIndex
CREATE INDEX "GuestFeedback_overallRating_idx" ON "GuestFeedback"("overallRating");

-- CreateIndex
CREATE INDEX "GuestFeedback_source_idx" ON "GuestFeedback"("source");

-- CreateIndex
CREATE INDEX "GuestFeedback_createdAt_idx" ON "GuestFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "GuestFeedback_responded_idx" ON "GuestFeedback"("responded");

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
CREATE INDEX "TipDistribution_employeeId_status_idx" ON "TipDistribution"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTracking_deliveryInfoId_key" ON "DeliveryTracking"("deliveryInfoId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_deliveryInfoId_idx" ON "DeliveryTracking"("deliveryInfoId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_status_idx" ON "DeliveryTracking"("status");

-- CreateIndex
CREATE INDEX "DeliveryTracking_driverName_idx" ON "DeliveryTracking"("driverName");

-- CreateIndex
CREATE INDEX "DeliveryTracking_locationId_idx" ON "DeliveryTracking"("locationId");

-- CreateIndex
CREATE INDEX "DeliveryTracking_estimatedArrival_idx" ON "DeliveryTracking"("estimatedArrival");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_employeeId_idx" ON "Session"("employeeId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_employeeId_expiresAt_idx" ON "Session"("employeeId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricCredential_credentialId_key" ON "BiometricCredential"("credentialId");

-- CreateIndex
CREATE INDEX "BiometricCredential_employeeId_idx" ON "BiometricCredential"("employeeId");

-- CreateIndex
CREATE INDEX "BiometricCredential_credentialId_idx" ON "BiometricCredential"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_reference_idx" ON "JournalEntry"("reference");

-- CreateIndex
CREATE INDEX "JournalEntry_referenceType_idx" ON "JournalEntry"("referenceType");

-- CreateIndex
CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");

-- CreateIndex
CREATE INDEX "JournalEntry_source_idx" ON "JournalEntry"("source");

-- CreateIndex
CREATE INDEX "JournalEntry_date_status_idx" ON "JournalEntry"("date", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_locationId_idx" ON "JournalEntry"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "ChartOfAccount"("code");

-- CreateIndex
CREATE INDEX "ChartOfAccount_accountType_idx" ON "ChartOfAccount"("accountType");

-- CreateIndex
CREATE INDEX "ChartOfAccount_parentId_idx" ON "ChartOfAccount"("parentId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_isActive_idx" ON "ChartOfAccount"("isActive");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountCode_idx" ON "JournalLine"("accountCode");

-- CreateIndex
CREATE INDEX "JournalLine_accountType_idx" ON "JournalLine"("accountType");

-- CreateIndex
CREATE INDEX "JournalLine_accountCode_accountType_idx" ON "JournalLine"("accountCode", "accountType");

-- CreateIndex
CREATE INDEX "JournalLine_locationId_idx" ON "JournalLine"("locationId");

-- CreateIndex
CREATE INDEX "JournalLine_chartOfAccountCode_idx" ON "JournalLine"("chartOfAccountCode");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPayable_apNumber_key" ON "AccountsPayable"("apNumber");

-- CreateIndex
CREATE INDEX "AccountsPayable_supplierId_idx" ON "AccountsPayable"("supplierId");

-- CreateIndex
CREATE INDEX "AccountsPayable_status_idx" ON "AccountsPayable"("status");

-- CreateIndex
CREATE INDEX "AccountsPayable_dueDate_idx" ON "AccountsPayable"("dueDate");

-- CreateIndex
CREATE INDEX "AccountsPayable_status_dueDate_idx" ON "AccountsPayable"("status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountsPayable_locationId_idx" ON "AccountsPayable"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsReceivable_arNumber_key" ON "AccountsReceivable"("arNumber");

-- CreateIndex
CREATE INDEX "AccountsReceivable_status_idx" ON "AccountsReceivable"("status");

-- CreateIndex
CREATE INDEX "AccountsReceivable_dueDate_idx" ON "AccountsReceivable"("dueDate");

-- CreateIndex
CREATE INDEX "AccountsReceivable_status_dueDate_idx" ON "AccountsReceivable"("status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountsReceivable_customerTaxId_idx" ON "AccountsReceivable"("customerTaxId");

-- CreateIndex
CREATE INDEX "AccountsReceivable_locationId_idx" ON "AccountsReceivable"("locationId");

-- CreateIndex
CREATE INDEX "ScheduledEmailLog_status_idx" ON "ScheduledEmailLog"("status");

-- CreateIndex
CREATE INDEX "ScheduledEmailLog_reportType_idx" ON "ScheduledEmailLog"("reportType");

-- CreateIndex
CREATE INDEX "ScheduledEmailLog_createdAt_idx" ON "ScheduledEmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "ScheduledEmailLog_recipient_idx" ON "ScheduledEmailLog"("recipient");

-- CreateIndex
CREATE INDEX "PushSubscription_employeeId_idx" ON "PushSubscription"("employeeId");

-- CreateIndex
CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_isActive_idx" ON "PushSubscription"("isActive");

-- CreateIndex
CREATE INDEX "KotDocument_orderId_idx" ON "KotDocument"("orderId");

-- CreateIndex
CREATE INDEX "KotDocument_type_idx" ON "KotDocument"("type");

-- CreateIndex
CREATE INDEX "KotDocument_status_idx" ON "KotDocument"("status");

-- CreateIndex
CREATE INDEX "KotDocument_createdAt_idx" ON "KotDocument"("createdAt");

-- CreateIndex
CREATE INDEX "KotDocument_employeeId_idx" ON "KotDocument"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualBrand_code_key" ON "VirtualBrand"("code");

-- CreateIndex
CREATE INDEX "VirtualBrand_isActive_idx" ON "VirtualBrand"("isActive");

-- CreateIndex
CREATE INDEX "VirtualBrand_locationId_idx" ON "VirtualBrand"("locationId");

-- CreateIndex
CREATE INDEX "CarbonFactor_category_idx" ON "CarbonFactor"("category");

-- CreateIndex
CREATE INDEX "CarbonFactor_isActive_idx" ON "CarbonFactor"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonFactor_name_category_key" ON "CarbonFactor"("name", "category");

-- CreateIndex
CREATE INDEX "SustainabilityReport_date_idx" ON "SustainabilityReport"("date");

-- CreateIndex
CREATE INDEX "SustainabilityReport_locationId_idx" ON "SustainabilityReport"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextRetryAt_idx" ON "OutboxEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_target_status_idx" ON "OutboxEvent"("target", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_createdAt_idx" ON "OutboxEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SyncState_lastSyncedAt_idx" ON "SyncState"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "SyncState_conflictStatus_idx" ON "SyncState"("conflictStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_entityType_entityId_key" ON "SyncState"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRegistry_deviceId_key" ON "DeviceRegistry"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceRegistry_locationId_idx" ON "DeviceRegistry"("locationId");

-- CreateIndex
CREATE INDEX "DeviceRegistry_status_idx" ON "DeviceRegistry"("status");

-- CreateIndex
CREATE INDEX "WalletPayment_paymentId_idx" ON "WalletPayment"("paymentId");

-- CreateIndex
CREATE INDEX "WalletPayment_checkId_idx" ON "WalletPayment"("checkId");

-- CreateIndex
CREATE INDEX "WalletPayment_walletType_status_idx" ON "WalletPayment"("walletType", "status");

-- CreateIndex
CREATE INDEX "WalletPayment_transactionId_idx" ON "WalletPayment"("transactionId");

-- CreateIndex
CREATE INDEX "WalletPayment_createdAt_idx" ON "WalletPayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksSync_realmId_key" ON "QuickBooksSync"("realmId");

-- CreateIndex
CREATE INDEX "QuickBooksSync_isActive_idx" ON "QuickBooksSync"("isActive");

-- CreateIndex
CREATE INDEX "QuickBooksSync_lastSyncAt_idx" ON "QuickBooksSync"("lastSyncAt");

-- CreateIndex
CREATE INDEX "QuickBooksSyncLog_syncId_idx" ON "QuickBooksSyncLog"("syncId");

-- CreateIndex
CREATE INDEX "QuickBooksSyncLog_entityType_status_idx" ON "QuickBooksSyncLog"("entityType", "status");

-- CreateIndex
CREATE INDEX "QuickBooksSyncLog_entityId_idx" ON "QuickBooksSyncLog"("entityId");

-- CreateIndex
CREATE INDEX "QuickBooksSyncLog_createdAt_idx" ON "QuickBooksSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "VideoAnalyticsSession_cameraId_idx" ON "VideoAnalyticsSession"("cameraId");

-- CreateIndex
CREATE INDEX "VideoAnalyticsSession_locationId_idx" ON "VideoAnalyticsSession"("locationId");

-- CreateIndex
CREATE INDEX "VideoAnalyticsSession_startedAt_idx" ON "VideoAnalyticsSession"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAuditEntry_blockNumber_key" ON "BlockchainAuditEntry"("blockNumber");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_blockNumber_idx" ON "BlockchainAuditEntry"("blockNumber");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_entityType_entityId_idx" ON "BlockchainAuditEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_timestamp_idx" ON "BlockchainAuditEntry"("timestamp");

-- CreateIndex
CREATE INDEX "BlockchainAuditEntry_currentHash_idx" ON "BlockchainAuditEntry"("currentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_subscriptionId_idx" ON "ApiKey"("subscriptionId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_salesCategoryId_fkey" FOREIGN KEY ("salesCategoryId") REFERENCES "SalesCategory"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_prepStationId_fkey" FOREIGN KEY ("prepStationId") REFERENCES "PrepStation"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "MealtimeRule" ADD CONSTRAINT "MealtimeRule_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "DiningOption" ADD CONSTRAINT "DiningOption_serviceChargeId_fkey" FOREIGN KEY ("serviceChargeId") REFERENCES "ServiceCharge"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "DiningOption" ADD CONSTRAINT "DiningOption_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "PackagingItem" ADD CONSTRAINT "PackagingItem_packagingConfigId_fkey" FOREIGN KEY ("packagingConfigId") REFERENCES "PackagingConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_diningOptionId_fkey" FOREIGN KEY ("diningOptionId") REFERENCES "DiningOption"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_revenueCenterId_fkey" FOREIGN KEY ("revenueCenterId") REFERENCES "RevenueCenter"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryInfoId_fkey" FOREIGN KEY ("deliveryInfoId") REFERENCES "DeliveryInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_virtualBrandId_fkey" FOREIGN KEY ("virtualBrandId") REFERENCES "VirtualBrand"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_voidReasonId_fkey" FOREIGN KEY ("voidReasonId") REFERENCES "VoidReason"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_appliedDiscountId_fkey" FOREIGN KEY ("appliedDiscountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_appliedDiscountId_fkey" FOREIGN KEY ("appliedDiscountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "Check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_alternatePaymentTypeId_fkey" FOREIGN KEY ("alternatePaymentTypeId") REFERENCES "AlternatePaymentType"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "EmployeeJob" ADD CONSTRAINT "EmployeeJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeJob" ADD CONSTRAINT "EmployeeJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "CashRegisterShift" ADD CONSTRAINT "CashRegisterShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "CashRegisterShift" ADD CONSTRAINT "CashRegisterShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_parentRecipeItemId_fkey" FOREIGN KEY ("parentRecipeItemId") REFERENCES "RecipeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "OpeningHours" ADD CONSTRAINT "OpeningHours_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HaccpEntry" ADD CONSTRAINT "HaccpEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "GuestVisit" ADD CONSTRAINT "GuestVisit_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "ReorderRule" ADD CONSTRAINT "ReorderRule_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourSchedule" ADD CONSTRAINT "HappyHourSchedule_priceGroupId_fkey" FOREIGN KEY ("priceGroupId") REFERENCES "PriceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "ZReport" ADD CONSTRAINT "ZReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "TipDistribution" ADD CONSTRAINT "TipDistribution_tipPoolId_fkey" FOREIGN KEY ("tipPoolId") REFERENCES "TipPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTracking" ADD CONSTRAINT "DeliveryTracking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "BiometricCredential" ADD CONSTRAINT "BiometricCredential_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_chartOfAccountCode_fkey" FOREIGN KEY ("chartOfAccountCode") REFERENCES "ChartOfAccount"("code") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotDocument" ADD CONSTRAINT "KotDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotDocument" ADD CONSTRAINT "KotDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualBrand" ADD CONSTRAINT "VirtualBrand_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "DeviceRegistry" ADD CONSTRAINT "DeviceRegistry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "VideoAnalyticsSession" ADD CONSTRAINT "VideoAnalyticsSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

