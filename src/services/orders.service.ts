import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { sendPushNotification } from "@/lib/pushNotifications";
import { Order, OrderStatus } from "@/generated/prisma/client";

type OrderWithDriverLocation = Order & {
  driver: { name: string; lat: number | null; lng: number | null } | null;
};

interface CreateOrderInput {
  clientId: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toAddress?: string;
  price: number;
}

async function findNearestOnlineDrivers(
  point: { lat: number; lng: number },
  limit: number = 3,
): Promise<string[]> {
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

  const withDistance = onlineDrivers.map((driver) => ({
    id: driver.id,
    distance: distanceKm(point, {
      lat: driver.lat!,
      lng: driver.lng!,
    }),
  }));

  withDistance.sort((a, b) => a.distance - b.distance);

  return withDistance.slice(0, limit).map((d) => d.id);
}

async function notifyDriverOfNewOrder(
  driverId: string,
  order: Order,
): Promise<void> {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { pushToken: true },
  });

  await sendPushNotification(
    driver?.pushToken,
    "Новый заказ",
    order.fromAddress,
    { orderId: order.id },
  );
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

    const candidates = await findNearestOnlineDrivers({
      lat: fromLat,
      lng: fromLng,
    });

    let order: Order | null = null;

    for (const candidateId of candidates) {
      order = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${candidateId} FOR UPDATE`;

        const driver = await tx.driver.findUnique({
          where: { id: candidateId },
          include: {
            orders: {
              where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            },
          },
        });

        if (driver && driver.isOnline && driver.orders.length === 0) {
          return tx.order.create({
            data: {
              clientId,
              fromAddress,
              fromLat,
              fromLng,
              toAddress,
              price,
              driverId: candidateId,
              status: "ACCEPTED",
            },
          });
        }
        return null;
      });

      if (order) {
        break;
      }
    }

    if (!order) {
      order = await prisma.order.create({
        data: {
          clientId,
          fromAddress,
          fromLat,
          fromLng,
          toAddress,
          price,
          status: "NEW",
        },
      });
    }

    if (order.driverId) {
      await notifyDriverOfNewOrder(order.driverId, order);
    }

    return order;
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

    const currentOrder = await prisma.order.findFirst({
      where: {
        clientId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        driver: {
          select: { lat: true, lng: true, user: { select: { name: true } } },
        },
      },
    });

    if (!currentOrder) {
      return null;
    }

    return {
      ...currentOrder,
      driver: currentOrder.driver && {
        name: currentOrder.driver.user.name,
        lat: currentOrder.driver.lat,
        lng: currentOrder.driver.lng,
      },
    };
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

    const withDistance = pendingOrders.map((order) => ({
      order,
      distance: distanceKm(point, {
        lat: order.fromLat,
        lng: order.fromLng,
      }),
    }));

    withDistance.sort((a, b) => a.distance - b.distance);
    const candidates = withDistance.slice(0, 3).map((d) => d.order);

    for (const candidate of candidates) {
      const assignedOrder = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${driverId} FOR UPDATE`;

        const driver = await tx.driver.findUnique({
          where: { id: driverId },
          include: {
            orders: {
              where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            },
          },
        });

        if (!driver || !driver.isOnline || driver.orders.length > 0) {
          return null;
        }

        const result = await tx.order.updateMany({
          where: { id: candidate.id, status: "NEW", driverId: null },
          data: { driverId, status: "ACCEPTED" },
        });

        if (result.count === 1) {
          return tx.order.findUnique({ where: { id: candidate.id } });
        }

        return null;
      });

      if (assignedOrder) {
        await notifyDriverOfNewOrder(driverId, assignedOrder);
        return assignedOrder;
      }
    }

    return null;
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
