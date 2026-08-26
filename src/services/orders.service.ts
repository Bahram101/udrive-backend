import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { Order } from "@/generated/prisma/client";

interface CreateOrderInput {
  clientId: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toAddress?: string;
  price: number;
}

async function findNearestOnlineDriverId(point: {
  lat: number;
  lng: number;
}): Promise<string | null> {
  const onlineDrivers = await prisma.driver.findMany({
    where: {
      isOnline: true,
      lat: { not: null },
      lng: { not: null },
      // A driver can only have one active order at a time.
      orders: {
        none: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      },
    },
  });

  let nearestId: string | null = null;
  let nearestDistance = Infinity;

  for (const driver of onlineDrivers) {
    const distance = distanceKm(point, {
      lat: driver.lat!,
      lng: driver.lng!,
    });

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = driver.id;
    }
  }

  return nearestId;
}

export const OrdersService = {
  async createOrder({
    clientId,
    fromAddress,
    fromLat,
    fromLng,
    toAddress,
    price,
  }: CreateOrderInput): Promise<Order> {
    const client = await prisma.user.findUnique({ where: { id: clientId } });

    if (!client) {
      throw new AppError(404, "User not found");
    }

    if (client.role !== "CLIENT") {
      throw new AppError(403, "Only clients can create orders");
    }

    const driverId = await findNearestOnlineDriverId({
      lat: fromLat,
      lng: fromLng,
    });

    return prisma.order.create({
      data: {
        clientId,
        fromAddress,
        fromLat,
        fromLng,
        toAddress,
        price,
        driverId,
        status: driverId ? "ACCEPTED" : "NEW",
      },
    });
  },

  async getCurrentOrderForClient(clientId: string): Promise<Order | null> {
    const client = await prisma.user.findUnique({ where: { id: clientId } });

    if (!client) {
      throw new AppError(404, "User not found");
    }

    if (client.role !== "CLIENT") {
      throw new AppError(403, "Only clients can view client orders");
    }

    return prisma.order.findFirst({
      where: {
        clientId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
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

  async cancelOrder(orderId: string, clientId: string): Promise<Order> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError(404, "Order not found");
    }

    if (order.clientId !== clientId) {
      throw new AppError(403, "You can only cancel your own orders");
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new AppError(400, `Order is already ${order.status.toLowerCase()}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
  },

  async cancelOrderAsDriver(orderId: string, userId: string): Promise<Order> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can cancel driver orders");
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new AppError(404, "Order not found");
    }

    if (order.driverId !== driver.id) {
      throw new AppError(403, "You can only cancel your own assigned orders");
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new AppError(400, `Order is already ${order.status.toLowerCase()}`);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
  },

  async getNewOrders(userId: string): Promise<Order[]> {
    const driver = await prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new AppError(403, "Only drivers can view driver orders");
    }

    return prisma.order.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
    });
  },
};
