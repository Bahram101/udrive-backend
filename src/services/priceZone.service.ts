import type { PriceZone } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type {
  CreatePriceZoneInput,
  UpdatePriceZoneInput,
} from "@/schemas/priceZone.schema";

export const PriceZoneService = {
  async list(): Promise<PriceZone[]> {
    return prisma.priceZone.findMany({
      orderBy: { createdAt: "asc" },
    });
  },

  async listActive(): Promise<PriceZone[]> {
    return prisma.priceZone.findMany({
      where: { isActive: true },
    });
  },

  async create(input: CreatePriceZoneInput): Promise<PriceZone> {
    return prisma.priceZone.create({
      data: input,
    });
  },

  async update(id: string, input: UpdatePriceZoneInput): Promise<PriceZone> {
    const existing = await prisma.priceZone.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, "Price zone not found");
    }

    return prisma.priceZone.update({
      where: { id },
      data: input,
    });
  },

  async delete(id: string): Promise<void> {
    const existing = await prisma.priceZone.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError(404, "Price zone not found");
    }

    await prisma.priceZone.delete({
      where: { id },
    });
  },
};
