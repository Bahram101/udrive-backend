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

interface UpdateDriverProfileInput {
  userId: string;
  carBrand?: string;
  carModel?: string;
  carColor?: string;
  email?: string;
}

export interface DriverProfile {
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  email: string | null;
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
        lastSeenAt: new Date(),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
      },
    });

    if (isOnline && lat !== undefined && lng !== undefined) {
      await OrdersService.assignNearestPendingOrder(updated.id, { lat, lng });
    }

    return updated;
  },

  async updatePushToken(userId: string, pushToken: string): Promise<Driver> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can register a push token");
    }

    return prisma.driver.update({
      where: { userId },
      data: { pushToken },
    });
  },

  async updateDriverLocation(userId: string, lat: number, lng: number): Promise<Driver> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can update driver location");
    }

    if (!driver.isOnline) {
      throw new AppError(409, "Driver is offline");
    }

    return prisma.driver.update({
      where: { userId },
      data: { lat, lng, lastSeenAt: new Date() },
    });
  },

  async getDriverProfile(userId: string): Promise<DriverProfile> {
    const driver = await prisma.driver.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driver) {
      throw new AppError(403, "Only drivers can view driver profile");
    }

    return {
      carBrand: driver.carBrand,
      carModel: driver.carModel,
      carColor: driver.carColor,
      email: driver.user.email,
    };
  },

  async updateDriverProfile({
    userId,
    carBrand,
    carModel,
    carColor,
    email,
  }: UpdateDriverProfileInput): Promise<DriverProfile> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can update driver profile");
    }

    return prisma.$transaction(async (tx) => {
      const updatedDriver = await tx.driver.update({
        where: { userId },
        data: {
          ...(carBrand !== undefined && { carBrand }),
          ...(carModel !== undefined && { carModel }),
          ...(carColor !== undefined && { carColor }),
        },
        include: { user: true },
      });

      const updatedEmail =
        email !== undefined
          ? (
              await tx.user.update({
                where: { id: userId },
                data: { email: email === "" ? null : email },
              })
            ).email
          : updatedDriver.user.email;

      return {
        carBrand: updatedDriver.carBrand,
        carModel: updatedDriver.carModel,
        carColor: updatedDriver.carColor,
        email: updatedEmail,
      };
    });
  },
};
