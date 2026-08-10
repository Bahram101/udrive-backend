/*
  Warnings:

  - Made the column `fromLat` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fromLng` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `toLat` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `toLng` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "fromLat" SET NOT NULL,
ALTER COLUMN "fromLng" SET NOT NULL,
ALTER COLUMN "toLat" SET NOT NULL,
ALTER COLUMN "toLng" SET NOT NULL;
