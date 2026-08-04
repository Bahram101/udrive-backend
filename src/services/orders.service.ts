import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { Order } from "@/generated/prisma/client";

interface CreateOrderInput {
  clientId: string;
  fromAddress: string;
  toAddress: string;
}

export async function createOrder({
  clientId,
  fromAddress,
  toAddress,
}: CreateOrderInput): Promise<Order> {
  const client = await prisma.user.findUnique({ where: { id: clientId } });

  if (!client) {
    throw new AppError(404, "User not found");
  }

  if (client.role !== "CLIENT") {
    throw new AppError(403, "Only clients can create orders");
  }

  return prisma.order.create({
    data: { clientId, fromAddress, toAddress },
  });
}
