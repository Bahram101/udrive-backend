import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { OrdersService } from "@/services/orders.service";
import { handleApiError } from "@/lib/errors";

// PATCH /api/driver/orders/:id/arrive
export const PATCH = withAuth<{ id: string }>(
  async (_request: NextRequest, authUser, { params }) => {
    try {
      const { id } = await params;
      const order = await OrdersService.markOrderArrived(id, authUser.userId);

      return Response.json({ order });
    } catch (error) {
      return handleApiError(error);
    }
  },
);
