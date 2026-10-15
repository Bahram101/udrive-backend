import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { FINISHED_ORDER_STATUSES } from "@/lib/constants";
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
        none: { status: { notIn: FINISHED_ORDER_STATUSES } },
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

  const result = await prisma.order.updateMany({
    where: { id: orderId, driverId: driver.id, status: from },
    data: { status: to, ...(to === "COMPLETED" && { completedAt: new Date() }) },
  });

  if (result.count !== 1) {
    throw new AppError(409, "Статус заказа уже изменился");
  }

  const updated = await prisma.order.findUnique({ where: { id: orderId } });
  return updated!;
}

// Assigns a NEW order to a driver if the driver is still online and free.
// The driver row lock serializes this with other assignments to the same driver.
async function tryAssignOrderToDriver(
  orderId: string,
  driverId: string,
): Promise<Order | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${driverId} FOR UPDATE`;

    const driver = await tx.driver.findUnique({
      where: { id: driverId },
      include: {
        orders: {
          where: { status: { notIn: FINISHED_ORDER_STATUSES } },
        },
      },
    });

    if (!driver || !driver.isOnline || driver.orders.length > 0) {
      return null;
    }

    const result = await tx.order.updateMany({
      where: { id: orderId, status: "NEW", driverId: null },
      data: { driverId, status: "ACCEPTED" },
    });

    if (result.count !== 1) {
      return null;
    }

    return tx.order.findUnique({ where: { id: orderId } });
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

    if (client.role !== "CLIENT" && client.role !== "ADMIN") {
      throw new AppError(403, "Only clients can create orders");
    }

    // Client row lock: parallel requests can't create two active orders.
    const order = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${clientId} FOR UPDATE`;

      const activeOrder = await tx.order.findFirst({
        where: { clientId, status: { notIn: FINISHED_ORDER_STATUSES } },
        select: { id: true },
      });

      if (activeOrder) {
        throw new AppError(409, "У вас уже есть активный заказ");
      }

      return tx.order.create({
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
    });

    const candidates = await findNearestOnlineDrivers({
      lat: fromLat,
      lng: fromLng,
    });

    for (const candidateId of candidates) {
      const assigned = await tryAssignOrderToDriver(order.id, candidateId);

      if (assigned) {
        await notifyDriverOfNewOrder(candidateId, assigned);
        return assigned;
      }
    }

    // Not assigned here: still NEW, or taken meanwhile by a driver going online.
    const current = await prisma.order.findUnique({ where: { id: order.id } });
    return current!;
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
        status: { notIn: FINISHED_ORDER_STATUSES },
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
        status: { notIn: FINISHED_ORDER_STATUSES },
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

    const result = await prisma.order.updateMany({
      where: { id: orderId, clientId, status: order.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "CLIENT" },
    });

    if (result.count !== 1) {
      throw new AppError(409, "Статус заказа уже изменился");
    }

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    return updated!;
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

    const result = await prisma.order.updateMany({
      where: { id: orderId, driverId: driver.id, status: order.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "DRIVER" },
    });

    if (result.count !== 1) {
      throw new AppError(409, "Статус заказа уже изменился");
    }

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    return updated!;
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
      const assignedOrder = await tryAssignOrderToDriver(candidate.id, driverId);

      if (assignedOrder) {
        await notifyDriverOfNewOrder(driverId, assignedOrder);
        return assignedOrder;
      }
    }

    return null;
  },

  async markOrderArrived(orderId: string, userId: string): Promise<Order> {
    const order = await transitionDriverOrderStatus(orderId, userId, "ACCEPTED", "ARRIVED");

    try {
      const orderWithClient = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true, driver: { include: { user: true } } },
      });

      if (orderWithClient?.client?.pushToken) {
        const driverName = orderWithClient.driver?.user?.name || "Водитель";
        await sendPushNotification(
          orderWithClient.client.pushToken,
          "Водитель прибыл",
          `${driverName} ждет вас`,
          { orderId, type: "ORDER_ARRIVED" },
          "order-status-v2",
          "arrived.wav"
        );
      }
    } catch (e) {
      console.error("Failed to send arrived push", e);
    }

    return order;
  },

  async startOrder(orderId: string, userId: string): Promise<Order> {
    return transitionDriverOrderStatus(orderId, userId, "ARRIVED", "STARTED");
  },

  async completeOrder(orderId: string, userId: string): Promise<Order> {
    return transitionDriverOrderStatus(orderId, userId, "STARTED", "COMPLETED");
  },

};
