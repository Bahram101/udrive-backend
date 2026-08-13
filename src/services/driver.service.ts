import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { Driver, Order } from "@/generated/prisma/client";

interface UpdateDriverStatusInput {
  userId: string;
  isOnline: boolean;
  lat?: number;
  lng?: number;
}

export const DriverService = {
  async updateDriverStatus({
    userId,
    isOnline,
    lat,
    lng,
  }: UpdateDriverStatusInput): Promise<Driver> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can update driver status");
    }

    if (isOnline && (lat === undefined || lng === undefined)) {
      throw new AppError(400, "lat and long are required to go online");
    }

    return prisma.driver.update({
      where: { userId },
      data: {
        isOnline,
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
      },
    });
  },

  async getCurrentOrderForDriver(userId: string): Promise<Order | null> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can view driver orders");
    }

    return prisma.order.findFirst({
      where: {
        driverId: driver.id,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
