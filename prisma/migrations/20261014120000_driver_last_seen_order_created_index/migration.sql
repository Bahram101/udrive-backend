-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
