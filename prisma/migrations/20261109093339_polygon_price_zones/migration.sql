/*
  Warnings:

  - You are about to drop the column `centerLat` on the `PriceZone` table. All the data in the column will be lost.
  - You are about to drop the column `centerLng` on the `PriceZone` table. All the data in the column will be lost.
  - You are about to drop the column `radiusM` on the `PriceZone` table. All the data in the column will be lost.
  - Added the required column `points` to the `PriceZone` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PriceZone" DROP COLUMN "centerLat",
DROP COLUMN "centerLng",
DROP COLUMN "radiusM",
ADD COLUMN     "points" JSONB NOT NULL;
