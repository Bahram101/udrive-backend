import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { distanceKm } from "@/lib/geo";
import { Order } from "@/generated/prisma/client";

interface CreateOrderInput {
  clientId: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
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

export async function createOrder({
  clientId,
  fromAddress,
  fromLat,
  fromLng,
  price,
}: CreateOrderInput): Promise<Order> {
  const client = await prisma.user.findUnique({ where: { id: clientId } });

  if (!client) {
    throw new AppError(404, "User not found");
  }

  if (client.role !== "CLIENT") {
    throw new AppError(403, "Only clients can create orders");
  }

  console.log("fromLat", fromLat);
  console.log("fromLng", fromLng);

  const driverId = await findNearestOnlineDriverId({ lat: fromLat, lng: fromLng });

  return prisma.order.create({
    data: {
      clientId,
      fromAddress,
      fromLat,
      fromLng,
      price,
      driverId,
      status: driverId ? "ACCEPTED" : "NEW",
    },
  });
}
