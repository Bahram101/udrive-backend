-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CLIENT', 'DRIVER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "completedAt" TIMESTAMP(3);
