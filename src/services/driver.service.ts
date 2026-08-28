import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { Driver } from "@/generated/prisma/client";
import { OrdersService } from "@/services/orders.service";

interface UpdateDriverStatusInput {
  userId: string;
  isOnline: boolean;
  lat?: number;
  lng?: number;
}

export const DriverService = {
  async getDriverStatus(userId: string): Promise<Driver> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can view driver status");
    }

    return driver;
  },

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

    const updated = await prisma.driver.update({
      where: { userId },
      data: {
        isOnline,
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
      },
    });

    if (isOnline && lat !== undefined && lng !== undefined) {
      await OrdersService.assignNearestPendingOrder(updated.id, { lat, lng });
    }

    return updated;
  },
};
