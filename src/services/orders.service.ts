import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { getIO } from "@/lib/socket";
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
    where: { isOnline: true, lat: { not: null }, lng: { not: null } },
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

    const order = await prisma.order.create({
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

    const io = getIO();
    if (order.status === "NEW") {
      io.to("drivers").emit("order:new", order);
    } else if (order.driverId) {
      io.to(`driver:${order.driverId}`).emit("order:assigned", order);
    }

    return order;
  },
};
