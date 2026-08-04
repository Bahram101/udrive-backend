import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { createOrderSchema } from "@/schemas/orders.schema";
import { createOrder } from "@/services/orders.service";
import { handleApiError } from "@/lib/errors";

// POST /api/orders
export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { fromAddress, toAddress } = createOrderSchema.parse(
      await request.json(),
    );

    const order = await createOrder({
      clientId: authUser.userId,
      fromAddress,
      toAddress,
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
