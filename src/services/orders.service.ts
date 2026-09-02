import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { Order, OrderStatus } from "@/generated/prisma/client";

type OrderWithDriverLocation = Order & {
  driver: { lat: number | null; lng: number | null } | null;
};

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

async function transitionDriverOrderStatus(
  orderId: string,
  userId: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<Order> {
  const driver = await prisma.driver.findUnique({ where: { userId } });

  if (!driver) {
    throw new AppError(403, "Only drivers can update order status");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (order.driverId !== driver.id) {
    throw new AppError(403, "You can only update your own assigned orders");
  }

  if (order.status !== from) {
    throw new AppError(
      400,
      `Order must be ${from} to move to ${to}, current status is ${order.status}`,
    );
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: to },
  });
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
  
  async getCurrentOrderForClient(
    clientId: string,
  ): Promise<OrderWithDriverLocation | null> {
    const client = await prisma.user.findUnique({ where: { id: clientId } });

    if (!client) {
      throw new AppError(404, "User not found");
    }

    if (client.role !== "CLIENT") {
      throw new AppError(403, "Only clients can view client orders");
    }

    const currentOrder = prisma.order.findFirst({
      where: {
        clientId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { driver: { select: { lat: true, lng: true } } },
    });

    return currentOrder;
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

  async cancelOrderAsClient(orderId: string, clientId: string): Promise<Order> {
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

  async assignNearestPendingOrder(
    driverId: string,
    point: { lat: number; lng: number },
  ): Promise<Order | null> {
    const pendingOrders = await prisma.order.findMany({
      where: { status: "NEW", driverId: null },
    });

    let nearest: Order | null = null;
    let nearestDistance = Infinity;

    for (const order of pendingOrders) {
      const distance = distanceKm(point, {
        lat: order.fromLat,
        lng: order.fromLng,
      });

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = order;
      }
    }

    if (!nearest) {
      return null;
    }

    return prisma.order.update({
      where: { id: nearest.id },
      data: { driverId, status: "ACCEPTED" },
    });
  },

  async markOrderArrived(orderId: string, userId: string): Promise<Order> {
    return transitionDriverOrderStatus(orderId, userId, "ACCEPTED", "ARRIVED");
  },

  async startOrder(orderId: string, userId: string): Promise<Order> {
    return transitionDriverOrderStatus(orderId, userId, "ARRIVED", "STARTED");
  },

  async completeOrder(orderId: string, userId: string): Promise<Order> {
    return transitionDriverOrderStatus(orderId, userId, "STARTED", "COMPLETED");
  },

};
