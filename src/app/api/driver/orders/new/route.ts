import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// GET /api/driver/orders/new
export const GET = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const orders = await DriverService.getNewOrders(authUser.userId);

    return Response.json({ orders });
  } catch (error) {
    return handleApiError(error);
  }
});
