import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { OrdersService } from "@/services/orders.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/driver/orders/:id/complete
export const PATCH = withAuth<{ id: string }>(
  async (_request: NextRequest, authUser, { params }) => {
    try {
      const { id } = await params;
      const order = await OrdersService.completeOrder(id, authUser.userId);

      return Response.json({ order });
    } catch (error) {
      return handleApiError(error);
    }
  },
);
