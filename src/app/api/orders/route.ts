import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { createOrderSchema } from "@/schemas/orders.schema";
import { OrdersService } from "@/services/orders.service";
import { handleApiError } from "@/lib/errors";

// POST /api/orders
export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { fromAddress, fromLat, fromLng, toAddress } = createOrderSchema.parse(
      await request.json(),
    );
    // console.log(fromAddress, fromLat, fromLng, toAddress);

    const order = await OrdersService.createOrder({
      clientId: authUser.userId,
      fromAddress,
      fromLat,
      fromLng,
      toAddress,
      price: 400,
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
