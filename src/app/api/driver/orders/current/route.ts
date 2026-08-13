import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth";
import { DriverService } from "@/services/driver.service";
import { handleApiError } from "@/lib/errors";

// GET /api/driver/orders/current
export const GET = withAuth(async (_request: NextRequest, authUser) => {
  try {
    const order = await DriverService.getCurrentOrderForDriver(authUser.userId);
    

    return Response.json({ order });
  } catch (error) {
    return handleApiError(error);
  }
});
