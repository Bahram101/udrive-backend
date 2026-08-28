import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { OrdersService } from "@/services/orders.service";
import { handleApiError } from "@/lib/errors";

// GET /api/client/orders/current
export const GET = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const order = await OrdersService.getCurrentOrderForClient(authUser.userId);

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
