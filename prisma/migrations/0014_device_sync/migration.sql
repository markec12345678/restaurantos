-- 0014_device_sync — R128 (epic #115 P0-05): offline-first POS + varen reconnect/sync
--
-- Kanon P0-5: "Vsaka queued operation mora imeti: stable client operation ID,
-- tenant/location, device/session, createdAt, operation type, payload,
-- retry count, status, server acknowledgement."
--
-- DeviceSyncOperation = STREŽNIŠKI LEDGER (server acknowledgement) offline
-- operacij: vsaka uporabljena/duplirana/zavrnjena operacija iz klient vrste
-- je zapisana z (deviceId, clientOperationId) unikatnostjo — exactly-once
-- dokaz na nivoju naprave. Domain idempotencija (Order.idempotencyKey @unique,
-- CAS status prehodi, advisory locki) ostane AVTORITATIVNA zaščita; ledger
-- je ack + forenzika + monitoring vhoda. Additivna migracija, brez data loss.

CREATE TABLE "DeviceSyncOperation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "clientOperationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "payload" JSONB,
    "clientRetryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "orderId" TEXT,
    "ack" JSONB,
    "lastError" TEXT,
    "employeeId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceSyncOperation_pkey" PRIMARY KEY ("id")
);

-- Exactly-once na nivoju (naprava, operacija): isti clientOperationId z iste
-- naprave je DUPLIKAT (ack 'duplicate' z originalnim rezultatom), ne ponovna aplikacija.
CREATE UNIQUE INDEX "DeviceSyncOperation_deviceId_clientOperationId_key" ON "DeviceSyncOperation"("deviceId", "clientOperationId");

CREATE INDEX "DeviceSyncOperation_locationId_receivedAt_idx" ON "DeviceSyncOperation"("locationId", "receivedAt");

CREATE INDEX "DeviceSyncOperation_deviceId_receivedAt_idx" ON "DeviceSyncOperation"("deviceId", "receivedAt");

CREATE INDEX "DeviceSyncOperation_status_receivedAt_idx" ON "DeviceSyncOperation"("status", "receivedAt");

-- Foreign keys
ALTER TABLE "DeviceSyncOperation" ADD CONSTRAINT "DeviceSyncOperation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
